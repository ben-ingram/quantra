"use server";

import { getServiceClient } from "@/app/lib/supabase";
import { openai, MODELS } from "@/app/lib/openai";
import {
  retrieveComplianceData,
  type TextChunk,
  type CodeTable,
} from "@/app/actions/retrieveComplianceData";

// =============================================================================
// Types
// =============================================================================

export interface ChatSession {
  id: string;
  user_id: string | null;
  title: string;
  jurisdiction: string;
  created_at: string;
  updated_at: string;
}

export interface Citation {
  section: string;
  title: string | null;
  content: string;
  source: string | null;
  score: number;
}

export interface TableData {
  tableId: string;
  title: string | null;
  summary: string;
  data: Record<string, unknown> | unknown[];
  sectionReference: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: Citation[];
  tables: TableData[];
  compliance_result: ComplianceResult | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ComplianceResult {
  status: "PASS" | "FAIL" | "WARNING" | "INFO";
  summary: string;
  details: string;
  confidence: number;
}

export interface AskCodeExpertInput {
  sessionId?: string;
  query: string;
  jurisdiction?: string;
}

export interface AskCodeExpertResponse {
  sessionId: string;
  message: ChatMessage;
  isNewSession: boolean;
}

// =============================================================================
// System Prompt
// =============================================================================

const CODE_EXPERT_SYSTEM_PROMPT = `You are an expert Building Code Compliance Analyst specializing in the Florida Building Code (FBC).

Your role is to answer questions about building code requirements with precision and clarity. You have access to relevant code sections and tables retrieved from the FBC database.

GUIDELINES:
1. **Accuracy**: Base your answers ONLY on the provided code sections and tables. Never make up or assume code requirements.

2. **Citations**: Always cite the specific FBC section (e.g., "FBC 1011.5.2") when referencing a requirement. Include the full section reference.

3. **Tables**: When the answer involves dimensional requirements or specifications from a table, explicitly mention the table data. Say things like "According to Table 1011.5.2..." and reference the specific values.

4. **Clarity**: Structure your response clearly:
   - Start with a direct answer to the question
   - Provide the specific code requirements with citations
   - If applicable, explain any conditions or exceptions
   - If table data is relevant, describe what the table shows

5. **Uncertainty**: If the provided context doesn't fully answer the question, say so clearly. Never guess at code requirements.

6. **Format**: Use markdown for formatting. Use bullet points for lists of requirements. Use **bold** for important values and section numbers.

RESPONSE STRUCTURE:
- Begin with a brief, direct answer
- Follow with detailed requirements and citations
- Include any relevant exceptions or conditions
- End with a summary if the answer is complex`;

// =============================================================================
// Chat Session Operations
// =============================================================================

/**
 * Create a new chat session
 */
export async function createChatSession(
  jurisdiction: string = "Florida"
): Promise<ChatSession> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      title: "New Conversation",
      jurisdiction,
    })
    .select()
    .single();

  if (error) {
    console.error("[Chat] Error creating session:", error);
    throw new Error(`Failed to create chat session: ${error.message}`);
  }

  return data;
}

/**
 * Get all chat sessions
 */
export async function getChatSessions(): Promise<ChatSession[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[Chat] Error fetching sessions:", error);
    throw new Error(`Failed to fetch chat sessions: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a chat session with messages
 */
export async function getChatSession(
  sessionId: string
): Promise<{ session: ChatSession; messages: ChatMessage[] } | null> {
  const supabase = getServiceClient();

  // Get session
  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError) {
    if (sessionError.code === "PGRST116") return null;
    console.error("[Chat] Error fetching session:", sessionError);
    throw new Error(`Failed to fetch chat session: ${sessionError.message}`);
  }

  // Get messages
  const { data: messages, error: messagesError } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (messagesError) {
    console.error("[Chat] Error fetching messages:", messagesError);
    throw new Error(`Failed to fetch chat messages: ${messagesError.message}`);
  }

  return {
    session,
    messages: messages || [],
  };
}

/**
 * Delete a chat session
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) {
    console.error("[Chat] Error deleting session:", error);
    throw new Error(`Failed to delete chat session: ${error.message}`);
  }
}

/**
 * Update session title based on first message
 */
async function updateSessionTitle(
  sessionId: string,
  query: string
): Promise<void> {
  const supabase = getServiceClient();

  // Generate a short title from the query
  const title = query.length > 50 ? query.slice(0, 47) + "..." : query;

  await supabase
    .from("chat_sessions")
    .update({ title })
    .eq("id", sessionId);
}

// =============================================================================
// Main Ask Code Expert Function
// =============================================================================

/**
 * Ask a question to the Code Expert
 * This is the main function that handles RAG retrieval and LLM response
 */
export async function askCodeExpert(
  input: AskCodeExpertInput
): Promise<AskCodeExpertResponse> {
  const { query, jurisdiction = "Florida" } = input;
  let { sessionId } = input;
  let isNewSession = false;

  const supabase = getServiceClient();

  // Create session if needed
  if (!sessionId) {
    const session = await createChatSession(jurisdiction);
    sessionId = session.id;
    isNewSession = true;
  }

  // Save user message
  const { data: userMessage, error: userMsgError } = await supabase
    .from("chat_messages")
    .insert({
      session_id: sessionId,
      role: "user",
      content: query,
      citations: [],
      tables: [],
    })
    .select()
    .single();

  if (userMsgError) {
    console.error("[Chat] Error saving user message:", userMsgError);
    throw new Error(`Failed to save message: ${userMsgError.message}`);
  }

  // Update session title on first message
  if (isNewSession) {
    await updateSessionTitle(sessionId, query);
  }

  try {
    // Retrieve compliance data using SUPER RAG
    console.log("[Chat] Retrieving compliance data...");
    const startTime = Date.now();

    const complianceData = await retrieveComplianceData(query, undefined, {
      jurisdiction,
      textMatchCount: 8,
      tableMatchThreshold: 0.75,
      tableMatchCount: 5,
    });

    const retrievalTime = Date.now() - startTime;
    console.log(
      `[Chat] Retrieved ${complianceData.textChunks.length} chunks, ${complianceData.tableContext.length} tables in ${retrievalTime}ms`
    );

    // Format context for LLM
    const tableContext = formatTableContext(complianceData.tableContext);

    const userPrompt = `USER QUESTION:
${query}

RELEVANT CODE SECTIONS:
${complianceData.textContext}

${tableContext ? `\nRELEVANT CODE TABLES:\n${tableContext}` : ""}

Please answer the user's question based on the code sections and tables above. Cite specific sections when referencing requirements.`;

    // Call LLM
    console.log("[Chat] Calling LLM...");
    const llmStart = Date.now();

    const completion = await openai.chat.completions.create({
      model: MODELS.REASONING,
      messages: [
        { role: "system", content: CODE_EXPERT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    });

    const llmTime = Date.now() - llmStart;
    const responseContent = completion.choices[0]?.message?.content || "";

    // Extract citations from the retrieved chunks
    const citations: Citation[] = complianceData.textChunks.map((chunk) => ({
      section: chunk.sectionNumber || "Unknown",
      title: chunk.sectionTitle,
      content: chunk.content,
      source: chunk.codeName,
      score: chunk.combinedScore,
    }));

    // Format table data
    const tables: TableData[] = complianceData.tableContext.map((table) => ({
      tableId: table.tableId,
      title: table.tableTitle,
      summary: table.summary,
      data: table.data,
      sectionReference: table.sectionReference,
    }));

    // Determine if this is a compliance result
    const complianceResult = detectComplianceResult(responseContent);

    // Save assistant message
    const { data: assistantMessage, error: assistantMsgError } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        role: "assistant",
        content: responseContent,
        citations,
        tables,
        compliance_result: complianceResult,
        metadata: {
          retrievalTime,
          llmTime,
          textChunksUsed: complianceData.textChunks.length,
          tablesUsed: complianceData.tableContext.length,
          model: MODELS.REASONING,
          tokensUsed: completion.usage?.total_tokens,
        },
      })
      .select()
      .single();

    if (assistantMsgError) {
      console.error("[Chat] Error saving assistant message:", assistantMsgError);
      throw new Error(`Failed to save response: ${assistantMsgError.message}`);
    }

    return {
      sessionId,
      message: assistantMessage,
      isNewSession,
    };
  } catch (error) {
    console.error("[Chat] Error in askCodeExpert:", error);

    // Save error message
    const { data: errorMessage } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        role: "assistant",
        content: "I apologize, but I encountered an error while processing your question. Please try again.",
        citations: [],
        tables: [],
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      })
      .select()
      .single();

    return {
      sessionId,
      message: errorMessage!,
      isNewSession,
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatTableContext(tables: CodeTable[]): string {
  if (tables.length === 0) return "";

  return tables
    .map((table) => {
      const dataStr =
        typeof table.data === "object"
          ? JSON.stringify(table.data, null, 2)
          : String(table.data);

      return `### Table: ${table.tableId}
**Title:** ${table.tableTitle || "Untitled"}
**Section:** ${table.sectionReference || "N/A"}
**Summary:** ${table.summary}
**Data:**
\`\`\`json
${dataStr}
\`\`\``;
    })
    .join("\n\n---\n\n");
}

function detectComplianceResult(content: string): ComplianceResult | null {
  // Simple heuristic to detect if the response contains a compliance determination
  const lowerContent = content.toLowerCase();

  if (
    lowerContent.includes("compliant") ||
    lowerContent.includes("non-compliant") ||
    lowerContent.includes("meets the requirements") ||
    lowerContent.includes("does not meet")
  ) {
    let status: ComplianceResult["status"] = "INFO";

    if (
      lowerContent.includes("non-compliant") ||
      lowerContent.includes("does not meet") ||
      lowerContent.includes("violation")
    ) {
      status = "FAIL";
    } else if (
      lowerContent.includes("compliant") ||
      lowerContent.includes("meets the requirements")
    ) {
      status = "PASS";
    } else if (lowerContent.includes("may") || lowerContent.includes("depends")) {
      status = "WARNING";
    }

    return {
      status,
      summary: "Compliance determination made",
      details: content.slice(0, 200),
      confidence: 0.8,
    };
  }

  return null;
}

// =============================================================================
// Utility: Get chat history for a session (for continuing conversations)
// =============================================================================

export async function getChatHistory(
  sessionId: string
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[Chat] Error fetching history:", error);
    return [];
  }

  return (data || []).filter(
    (m) => m.role === "user" || m.role === "assistant"
  ) as Array<{ role: "user" | "assistant"; content: string }>;
}
