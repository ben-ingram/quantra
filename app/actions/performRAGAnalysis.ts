"use server";

import { createClient } from "@supabase/supabase-js";
import { openai, MODELS } from "@/app/lib/openai";
import type {
  ComplianceAnalysisResult,
  FullComplianceResponse,
  RegulatoryCodeSnippet,
} from "@/app/lib/types/compliance";

// =============================================================================
// Configuration
// =============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const EMBEDDING_MODEL = "text-embedding-3-small";

// =============================================================================
// Types
// =============================================================================

interface RAGAnalysisInput {
  query: string;
  jurisdiction?: string;
  codeName?: string;
  matchThreshold?: number;
  matchCount?: number;
}

interface DocumentMatch {
  id: string;
  content: string;
  metadata: {
    source?: string;
    page_number?: number;
    section?: string;
    jurisdiction?: string;
    code_name?: string;
    code_version?: string;
    chunk_index?: number;
  };
  similarity: number;
}

// =============================================================================
// System Prompt - Strict RAG Compliance Officer
// =============================================================================

const RAG_COMPLIANCE_SYSTEM_PROMPT = `You are a Strict QA Compliance Officer for the construction industry. Your role is to evaluate building conditions against regulatory codes with precision and objectivity.

## CRITICAL RULES:
1. Use ONLY the provided regulatory code context to make your determination
2. If the context doesn't contain relevant code sections, respond with status "INSUFFICIENT_CONTEXT"
3. NEVER invent or assume code requirements not explicitly stated in the context
4. Always cite the specific code section from the provided context
5. Be conservative - when in doubt, flag as WARNING

## SPECIFICITY HIERARCHY (IMPORTANT):
When analyzing a potential defect, first identify the specific type of building element mentioned (e.g., "Spiral Stairway" vs "Stairway", "Accessible Ramp" vs "Ramp").
- You MUST search for specific code sections tailored to that element before applying general code sections
- If a specific section exists (like 1011.10 for Spiral Stairways), it OVERRIDES the general section (like 1011.5.2 for general stairways)
- Exceptions and specific provisions always take precedence over general requirements
- When citing, prefer the most specific applicable section

## Evaluation Criteria:
- PASS: The condition fully complies with all applicable code requirements found in the context
- FAIL: The condition violates one or more code requirements found in the context
- WARNING: The condition is borderline, may require interpretation, or needs additional inspection
- INSUFFICIENT_CONTEXT: The provided context doesn't contain enough information to make a determination

## Risk Scoring (1-10):
- 1-2: Minor cosmetic or documentation issues, no safety impact
- 3-4: Minor code deviation, low rework cost, no immediate safety concern
- 5-6: Moderate violation, significant rework required, potential safety concern
- 7-8: Serious violation, major rework required, direct safety implications
- 9-10: Critical life-safety violation, immediate hazard, work stoppage recommended

## Response Requirements:
- Always cite the EXACT code section from the provided context
- Include the similarity score of the most relevant match in your reasoning
- Provide clear, technical reasoning based ONLY on provided context
- Include practical recommendations for remediation when applicable

You must respond with a valid JSON object. Do not include any text outside the JSON object.`;

// =============================================================================
// Supabase Client
// =============================================================================

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// =============================================================================
// Embedding Generation
// =============================================================================

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  return response.data[0].embedding;
}

// =============================================================================
// Vector Search
// =============================================================================

async function searchDocuments(
  queryEmbedding: number[],
  options: {
    matchThreshold?: number;
    matchCount?: number;
    jurisdiction?: string;
    codeName?: string;
  } = {}
): Promise<DocumentMatch[]> {
  const supabase = getSupabaseClient();

  const { matchThreshold = 0.5, matchCount = 5, jurisdiction, codeName } = options;

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
    filter_jurisdiction: jurisdiction || null,
    filter_code_name: codeName || null,
  });

  if (error) {
    console.error("Vector search error:", error);
    throw new Error(`Vector search failed: ${error.message}`);
  }

  return (data || []) as DocumentMatch[];
}

// =============================================================================
// Build RAG Prompt
// =============================================================================

function buildRAGPrompt(
  query: string,
  documents: DocumentMatch[]
): string {
  if (documents.length === 0) {
    return `## Compliance Analysis Request

### User Query:
${query}

### Retrieved Regulatory Code Context:
NO RELEVANT CODE SECTIONS FOUND IN DATABASE

### Instructions:
Since no relevant code sections were found, respond with:
{
  "status": "INSUFFICIENT_CONTEXT",
  "citation": "No applicable codes found",
  "reasoning": "The vector database did not return any relevant building code sections for this query. This could mean the specific code hasn't been ingested, or the query doesn't match any indexed content.",
  "riskScore": 5,
  "riskFactors": {
    "lifeSafety": "MEDIUM",
    "reworkCost": "MEDIUM",
    "scheduleImpact": "MEDIUM"
  },
  "recommendations": ["Consult the relevant building code directly", "Contact a licensed code official for interpretation"],
  "confidence": 0.0
}`;
  }

  const contextBlocks = documents.map((doc, index) => {
    const meta = doc.metadata;
    return `### Match ${index + 1} (Similarity: ${(doc.similarity * 100).toFixed(1)}%)
**Source:** ${meta.code_name || "Unknown Code"} ${meta.code_version || ""} - ${meta.jurisdiction || "Unknown Jurisdiction"}
**Section:** ${meta.section || "N/A"} | **Page:** ${meta.page_number || "N/A"}

${doc.content}
---`;
  }).join("\n\n");

  return `## Compliance Analysis Request

### User Query:
${query}

### Retrieved Regulatory Code Context:
${contextBlocks}

### Required Response Format:
Analyze the user query against ONLY the provided code sections above. Return a JSON object:

{
  "status": "PASS" | "FAIL" | "WARNING" | "INSUFFICIENT_CONTEXT",
  "citation": "Exact code section from context (e.g., 'FBC 1012.2' or 'IBC 2021 Section 1907.2')",
  "reasoning": "Technical explanation based ONLY on the provided context. Reference the similarity scores.",
  "riskScore": 1-10,
  "riskFactors": {
    "lifeSafety": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    "reworkCost": "LOW" | "MEDIUM" | "HIGH",
    "scheduleImpact": "LOW" | "MEDIUM" | "HIGH"
  },
  "recommendations": ["Array of recommended corrective actions based on the code context"],
  "confidence": 0.0-1.0
}`;
}

// =============================================================================
// Parse Response
// =============================================================================

function parseRAGResponse(
  content: string,
  documents: DocumentMatch[]
): ComplianceAnalysisResult {
  // Extract JSON from the response
  let jsonString = content;

  // Remove markdown code blocks if present
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonString = jsonMatch[1];
  }

  // Parse JSON
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonString.trim());
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${content.substring(0, 200)}`);
  }

  // Validate status
  const status = parsed.status as string;
  const validStatuses = ["PASS", "FAIL", "WARNING", "INSUFFICIENT_CONTEXT"];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  // Map INSUFFICIENT_CONTEXT to WARNING for the result type
  const mappedStatus = status === "INSUFFICIENT_CONTEXT" ? "WARNING" : status;

  // Validate risk score
  const riskScore = Number(parsed.riskScore);
  if (isNaN(riskScore) || riskScore < 1 || riskScore > 10) {
    throw new Error(`Invalid risk score: ${parsed.riskScore}`);
  }

  // Validate confidence
  const confidence = Number(parsed.confidence);
  if (isNaN(confidence) || confidence < 0 || confidence > 1) {
    throw new Error(`Invalid confidence: ${parsed.confidence}`);
  }

  // Get code reference from the best matching document
  const primaryDoc = documents[0];
  const meta = primaryDoc?.metadata || {};

  return {
    status: mappedStatus as ComplianceAnalysisResult["status"],
    citation: String(parsed.citation || ""),
    reasoning: String(parsed.reasoning || ""),
    riskScore,
    riskFactors: parsed.riskFactors as ComplianceAnalysisResult["riskFactors"],
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map(String)
      : undefined,
    codeReference: {
      name: meta.code_name || "Unknown",
      version: meta.code_version || "Unknown",
      jurisdiction: meta.jurisdiction || "Unknown",
    },
    confidence,
  };
}

// =============================================================================
// Main RAG Analysis Function
// =============================================================================

/**
 * Performs RAG-based compliance analysis using vector search.
 *
 * Flow:
 * 1. Embed the user query using text-embedding-3-small
 * 2. Search Supabase for top matching code chunks using match_documents RPC
 * 3. Pass query + retrieved context to GPT-4o for reasoning
 * 4. Return structured compliance result
 *
 * @param input - The analysis input
 * @returns Full compliance response with result, metadata, and retrieved snippets
 *
 * @example
 * ```ts
 * const result = await performRAGAnalysis({
 *   query: "The ramp slope is 1:10",
 *   jurisdiction: "Florida",
 * });
 * ```
 */
export async function performRAGAnalysis(
  input: RAGAnalysisInput
): Promise<FullComplianceResponse> {
  const startTime = Date.now();

  // Validate input
  if (!input.query?.trim()) {
    throw new Error("Query is required");
  }

  // Step 1: Generate embedding for the query
  console.log("[RAG] Generating embedding for query...");
  const queryEmbedding = await generateEmbedding(input.query);

  // Step 2: Search for relevant documents
  console.log("[RAG] Searching vector database...");
  const documents = await searchDocuments(queryEmbedding, {
    matchThreshold: input.matchThreshold ?? 0.5,
    matchCount: input.matchCount ?? 5,
    jurisdiction: input.jurisdiction,
    codeName: input.codeName,
  });

  console.log(`[RAG] Found ${documents.length} matching documents`);

  // Step 3: Build RAG prompt with retrieved context
  const userPrompt = buildRAGPrompt(input.query, documents);

  // Step 4: Call OpenAI for reasoning
  console.log("[RAG] Calling GPT-4o for compliance reasoning...");
  const completion = await openai.chat.completions.create({
    model: MODELS.REASONING,
    messages: [
      { role: "system", content: RAG_COMPLIANCE_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 1500,
    response_format: { type: "json_object" },
  });

  const responseContent = completion.choices[0]?.message?.content;
  if (!responseContent) {
    throw new Error("No response received from AI model");
  }

  // Step 5: Parse the response
  const result = parseRAGResponse(responseContent, documents);

  // Step 6: Build code snippets from retrieved documents
  const codeSnippets: RegulatoryCodeSnippet[] = documents.map((doc) => ({
    codeId: doc.metadata.code_name || "FBC",
    codeName: doc.metadata.code_name || "Unknown",
    version: doc.metadata.code_version || "Unknown",
    jurisdiction: doc.metadata.jurisdiction || "Unknown",
    section: doc.metadata.section || "Unknown",
    sectionTitle: `Page ${doc.metadata.page_number || "N/A"}`,
    content: doc.content,
    relevanceScore: doc.similarity,
  }));

  // Build response
  const processingTimeMs = Date.now() - startTime;

  return {
    result,
    metadata: {
      timestamp: new Date().toISOString(),
      modelVersion: MODELS.REASONING,
      processingTimeMs,
      tokensUsed: {
        prompt: completion.usage?.prompt_tokens || 0,
        completion: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0,
      },
    },
    codeSnippets,
  };
}

// =============================================================================
// Convenience Function for Quick Analysis
// =============================================================================

/**
 * Quick RAG analysis with sensible defaults
 */
export async function quickRAGAnalysis(
  query: string,
  jurisdiction?: string
): Promise<{
  status: string;
  citation: string;
  reasoning: string;
  riskScore: number;
  confidence: number;
  sourcesFound: number;
}> {
  const response = await performRAGAnalysis({
    query,
    jurisdiction,
    matchThreshold: 0.5,
    matchCount: 3,
  });

  return {
    status: response.result.status,
    citation: response.result.citation,
    reasoning: response.result.reasoning,
    riskScore: response.result.riskScore,
    confidence: response.result.confidence,
    sourcesFound: response.codeSnippets.length,
  };
}
