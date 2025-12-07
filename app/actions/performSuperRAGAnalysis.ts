"use server";

import { openai, MODELS } from "@/app/lib/openai";
import { retrieveComplianceData } from "./retrieveComplianceData";
import type {
  ComplianceAnalysisResult,
  FullComplianceResponse,
  RegulatoryCodeSnippet,
} from "@/app/lib/types/compliance";

// =============================================================================
// Phase 4: The Analyst System Prompt
// =============================================================================

const SUPER_RAG_SYSTEM_PROMPT = `You are a Quality Assurance Auditor specializing in Florida Building Codes. Your role is to evaluate building conditions against regulatory codes with precision, objectivity, and strict adherence to the provided data.

## DATA HIERARCHY (CRITICAL - FOLLOW THIS ORDER)

### 1. STRUCTURED TABLE DATA (Highest Priority)
If you are provided with "Structured Table Data" (JSON), you MUST use that data for any calculations, numeric lookups, or threshold determinations. The JSON data is machine-extracted and verified - it OVERRIDES general text descriptions.

**Example:** If the text says "occupancy load varies by use" but the JSON table provides specific values like {"Assembly - Standing": 5, "Assembly - Seated": 7}, you MUST use the JSON values (5 and 7 sq ft per occupant).

### 2. SPECIFIC RULES (Second Priority)
When analyzing a defect, first identify the SPECIFIC type of building element:
- "Spiral Stairway" is more specific than "Stairway"
- "Accessible Ramp" is more specific than "Ramp"
- "Assembly Occupancy" is more specific than "General Occupancy"

**Exception Logic:** If you find BOTH a Specific Rule (e.g., Section 1011.10 "Spiral Stairways") AND a General Rule (e.g., Section 1011.5 "Stairway Construction"), the SPECIFIC RULE ALWAYS TAKES PRECEDENCE.

### 3. GENERAL TEXT CONTEXT (Third Priority)
Use the retrieved text context for:
- Understanding requirements not covered by tables
- Interpreting exceptions and conditions
- Providing context for your reasoning

## QUERY INTERPRETATION (CRITICAL)

Users will describe EXISTING CONDITIONS or ASK QUESTIONS. Your job is to determine if those conditions comply with code requirements.

### Condition Statements vs. Requirement Questions
- **"The room has 50 occupants"** → CONDITION. Check if 50 is within the allowed limit.
- **"The occupant load is 50"** → CONDITION. This is the ACTUAL occupancy, not a claimed maximum. Check if it's within limits.
- **"What is the maximum occupant load?"** → QUESTION. Calculate and provide the code-required maximum.
- **"Is 50 occupants compliant?"** → CONDITION CHECK. Compare 50 against the code maximum.

### Key Interpretation Rule
When a user states a number (e.g., "50 occupants", "30 inches wide", "7-inch risers"), treat this as the ACTUAL CONDITION being inspected, NOT as their assertion of what the code requires. Your job is to:
1. Determine the code requirement from retrieved data
2. Compare the stated condition against that requirement
3. Return PASS if condition meets requirement, FAIL if it doesn't

**Example:**
- Query: "A 500 sq ft standing assembly room has 50 occupants"
- Code: Table 1004.5 says 5 sq ft per person → max = 100 occupants
- Analysis: 50 occupants < 100 maximum → **PASS** (the condition is compliant)
- Do NOT say "your calculation is wrong" - the user isn't calculating, they're stating a condition!

**Example:**
- Query: "A 500 sq ft standing assembly room has 150 occupants"
- Code: Table 1004.5 says 5 sq ft per person → max = 100 occupants
- Analysis: 150 occupants > 100 maximum → **FAIL** (over capacity)

## CRITICAL RULES

1. **USE ONLY PROVIDED DATA**: Base your determination solely on the retrieved context. If the context doesn't contain relevant information, respond with status "INSUFFICIENT_CONTEXT".

2. **NEVER HALLUCINATE**: Do NOT invent code requirements, section numbers, or values not explicitly present in the provided context. Your training data may be outdated - trust ONLY what is retrieved.

3. **CITE PRECISELY**:
   - For text rules: Cite the exact section number (e.g., "FBC 1011.10")
   - For table data: Cite the Table ID (e.g., "Table 1004.5")
   - Include both if using multiple sources

4. **BE CONSERVATIVE**: When requirements are ambiguous or borderline, flag as WARNING rather than PASS.

5. **SHOW YOUR WORK**: In your reasoning, explicitly state:
   - Which data source you used (text vs table)
   - Why you chose a specific rule over a general rule (if applicable)
   - The exact values from tables used in calculations
   - The comparison between the stated condition and the code requirement

## EVALUATION CRITERIA

- **PASS**: The condition fully complies with all applicable code requirements found in the context
- **FAIL**: The condition violates one or more code requirements found in the context
- **WARNING**: The condition is borderline, requires interpretation, or needs additional inspection
- **INSUFFICIENT_CONTEXT**: The provided context doesn't contain enough information to make a determination

## RISK SCORING (1-10)

- **1-2**: Minor cosmetic or documentation issues, no safety impact
- **3-4**: Minor code deviation, low rework cost, no immediate safety concern
- **5-6**: Moderate violation, significant rework required, potential safety concern
- **7-8**: Serious violation, major rework required, direct safety implications
- **9-10**: Critical life-safety violation, immediate hazard, work stoppage recommended

## RESPONSE FORMAT

You must respond with a valid JSON object containing:
{
  "status": "PASS" | "FAIL" | "WARNING" | "INSUFFICIENT_CONTEXT",
  "citation": "Primary code reference (e.g., 'FBC 1011.10' or 'Table 1004.5')",
  "allCitations": ["Array of all code sections and tables referenced"],
  "reasoning": "Detailed technical explanation showing your work",
  "dataSourceUsed": "text" | "table" | "both",
  "specificRuleApplied": "Section number of specific rule if one was used over a general rule, or null",
  "riskScore": 1-10,
  "riskFactors": {
    "lifeSafety": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    "reworkCost": "LOW" | "MEDIUM" | "HIGH",
    "scheduleImpact": "LOW" | "MEDIUM" | "HIGH"
  },
  "recommendations": ["Array of specific corrective actions"],
  "confidence": 0.0-1.0
}

Do not include any text outside the JSON object.`;

// =============================================================================
// Types
// =============================================================================

interface SuperRAGInput {
  query: string;
  jurisdiction?: string;
  codeName?: string;
  textMatchCount?: number;
  tableMatchThreshold?: number;
}

interface ExtendedAnalysisResult extends ComplianceAnalysisResult {
  allCitations?: string[];
  dataSourceUsed?: "text" | "table" | "both";
  specificRuleApplied?: string | null;
}

interface SuperRAGResponse extends Omit<FullComplianceResponse, "result"> {
  result: ExtendedAnalysisResult;
  retrievalStats: {
    textChunksFound: number;
    tablesFound: number;
    embeddingTime: number;
    searchTime: number;
  };
}

// =============================================================================
// Build the User Prompt with Retrieved Data
// =============================================================================

function buildAnalystPrompt(
  query: string,
  textContext: string,
  tableContext: Array<{
    tableId: string;
    tableTitle: string | null;
    summary: string;
    data: unknown;
    combinedScore: number;
  }>
): string {
  // Format table context as JSON blocks
  const tableSection =
    tableContext.length > 0
      ? tableContext
          .map(
            (table, i) => `### Table ${i + 1}: ${table.tableId}${table.tableTitle ? ` - ${table.tableTitle}` : ""}
**Relevance Score:** ${(table.combinedScore * 100).toFixed(1)}%
**Summary:** ${table.summary}
**Structured Data (USE THIS FOR CALCULATIONS):**
\`\`\`json
${JSON.stringify(table.data, null, 2)}
\`\`\``
          )
          .join("\n\n")
      : "NO RELEVANT TABLES FOUND";

  return `## COMPLIANCE ANALYSIS REQUEST

### User Query:
${query}

---

## RETRIEVED REGULATORY DATA

### Section A: Structured Table Data (HIGHEST PRIORITY FOR CALCULATIONS)
${tableSection}

---

### Section B: Text Context (Code Sections)
${textContext}

---

## YOUR TASK
Analyze the user query against the retrieved data above. Remember:
1. If table data is relevant, USE IT for any numeric determinations
2. Prefer SPECIFIC rules over GENERAL rules
3. Cite your sources precisely
4. Show your reasoning

Respond with a JSON object only.`;
}

// =============================================================================
// Parse the LLM Response
// =============================================================================

function parseAnalystResponse(
  content: string
): ExtendedAnalysisResult {
  // Extract JSON from response
  let jsonString = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonString = jsonMatch[1];
  }

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

  // Validate risk score - default to 5 if null/missing (for INSUFFICIENT_CONTEXT cases)
  let riskScore = Number(parsed.riskScore);
  if (isNaN(riskScore) || parsed.riskScore === null || parsed.riskScore === undefined) {
    // Default risk score based on status
    riskScore = status === "INSUFFICIENT_CONTEXT" ? 5 : 5;
  }
  // Clamp to valid range
  riskScore = Math.max(1, Math.min(10, riskScore));

  // Validate confidence - default to 0.5 if null/missing
  let confidence = Number(parsed.confidence);
  if (isNaN(confidence) || parsed.confidence === null || parsed.confidence === undefined) {
    confidence = status === "INSUFFICIENT_CONTEXT" ? 0.3 : 0.5;
  }
  // Clamp to valid range
  confidence = Math.max(0, Math.min(1, confidence));

  // Default risk factors if missing
  const defaultRiskFactors = {
    lifeSafety: "MEDIUM" as const,
    reworkCost: "MEDIUM" as const,
    scheduleImpact: "LOW" as const,
  };

  const riskFactors = parsed.riskFactors
    ? {
        lifeSafety: (parsed.riskFactors as Record<string, string>).lifeSafety || defaultRiskFactors.lifeSafety,
        reworkCost: (parsed.riskFactors as Record<string, string>).reworkCost || defaultRiskFactors.reworkCost,
        scheduleImpact: (parsed.riskFactors as Record<string, string>).scheduleImpact || defaultRiskFactors.scheduleImpact,
      }
    : defaultRiskFactors;

  return {
    status: mappedStatus as ExtendedAnalysisResult["status"],
    citation: String(parsed.citation || "N/A - Insufficient information"),
    reasoning: String(parsed.reasoning || "Unable to make a determination with the provided information."),
    riskScore,
    riskFactors: riskFactors as ExtendedAnalysisResult["riskFactors"],
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map(String)
      : ["Provide more specific details about the building element for accurate analysis."],
    codeReference: {
      name: "Florida Building Code",
      version: "8th Edition (2023)",
      jurisdiction: "Florida",
    },
    confidence,
    allCitations: Array.isArray(parsed.allCitations)
      ? parsed.allCitations.map(String)
      : undefined,
    dataSourceUsed: parsed.dataSourceUsed as "text" | "table" | "both" | undefined,
    specificRuleApplied: parsed.specificRuleApplied as string | null | undefined,
  };
}

// =============================================================================
// Main Super RAG Analysis Function
// =============================================================================

/**
 * Performs SUPER RAG analysis with hybrid search and structured data support.
 *
 * Flow:
 * 1. Retrieve compliance data (text + tables) using hybrid search
 * 2. Build analyst prompt with both data types
 * 3. Call GPT-4o with the Analyst system prompt
 * 4. Parse and return structured result
 *
 * @param input - The analysis input
 * @returns Full compliance response with enhanced metadata
 */
export async function performSuperRAGAnalysis(
  input: SuperRAGInput
): Promise<SuperRAGResponse> {
  const startTime = Date.now();

  // Validate input
  if (!input.query?.trim()) {
    throw new Error("Query is required");
  }

  // Step 1: Retrieve compliance data using hybrid search
  console.log("[SuperRAG] Retrieving compliance data...");
  const retrievalResult = await retrieveComplianceData(input.query, undefined, {
    jurisdiction: input.jurisdiction,
    codeName: input.codeName,
    textMatchCount: input.textMatchCount ?? 8,
    tableMatchThreshold: input.tableMatchThreshold ?? 0.82,
  });

  console.log(
    `[SuperRAG] Retrieved ${retrievalResult.textChunks.length} text chunks, ${retrievalResult.tableContext.length} tables`
  );

  // Step 2: Build the analyst prompt
  const userPrompt = buildAnalystPrompt(
    input.query,
    retrievalResult.textContext,
    retrievalResult.tableContext
  );

  // Step 3: Call GPT-4o for analysis
  console.log("[SuperRAG] Running analyst LLM...");
  const completion = await openai.chat.completions.create({
    model: MODELS.REASONING,
    messages: [
      { role: "system", content: SUPER_RAG_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  });

  const responseContent = completion.choices[0]?.message?.content;
  if (!responseContent) {
    throw new Error("No response received from AI model");
  }

  // Step 4: Parse the response
  const result = parseAnalystResponse(responseContent);

  // Step 5: Build code snippets from retrieved text chunks
  const codeSnippets: RegulatoryCodeSnippet[] = retrievalResult.textChunks.map(
    (chunk) => ({
      codeId: chunk.codeName || "FBC",
      codeName: chunk.codeName || "Unknown",
      version: chunk.codeVersion || "Unknown",
      jurisdiction: chunk.jurisdiction || "Unknown",
      section: chunk.sectionNumber || "Unknown",
      sectionTitle: chunk.sectionTitle || `Page ${chunk.pageNumber || "N/A"}`,
      content: chunk.content,
      relevanceScore: chunk.combinedScore,
    })
  );

  // Get code reference from best matching chunk
  const primaryChunk = retrievalResult.textChunks[0];

  // Build response
  const processingTimeMs = Date.now() - startTime;

  return {
    result: {
      ...result,
      codeReference: primaryChunk
        ? {
            name: primaryChunk.codeName || "Unknown",
            version: primaryChunk.codeVersion || "Unknown",
            jurisdiction: primaryChunk.jurisdiction || "Unknown",
          }
        : {
            name: "Florida Building Code",
            version: "8th Edition (2023)",
            jurisdiction: "Florida",
          },
    },
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
    retrievalStats: {
      textChunksFound: retrievalResult.textChunks.length,
      tablesFound: retrievalResult.tableContext.length,
      embeddingTime: retrievalResult.embeddingTime,
      searchTime: retrievalResult.searchTime,
    },
  };
}

