"use server";

import { openai, MODELS } from "@/app/lib/openai";
import { retrieveRelevantCodes } from "@/app/lib/regulatory-codes";
import type {
  ComplianceAnalysisInput,
  ComplianceAnalysisResult,
  FullComplianceResponse,
  RegulatoryCodeSnippet,
} from "@/app/lib/types/compliance";

/**
 * System prompt for the Strict Code Compliance Auditor
 */
const COMPLIANCE_AUDITOR_SYSTEM_PROMPT = `You are a Strict Code Compliance Auditor for the construction industry. Your role is to evaluate building conditions against regulatory codes with precision and objectivity.

## Your Responsibilities:
1. Analyze the reported condition against the provided building code sections
2. Determine compliance status with strict interpretation of code requirements
3. Identify specific code citations for any violations
4. Assess risk based on life safety implications and remediation costs

## Evaluation Criteria:
- PASS: The condition fully complies with all applicable code requirements
- FAIL: The condition violates one or more code requirements and requires correction
- WARNING: The condition is borderline, may require interpretation, or needs additional inspection

## Risk Scoring (1-10):
- 1-2: Minor cosmetic or documentation issues, no safety impact
- 3-4: Minor code deviation, low rework cost, no immediate safety concern
- 5-6: Moderate violation, significant rework required, potential safety concern
- 7-8: Serious violation, major rework required, direct safety implications
- 9-10: Critical life-safety violation, immediate hazard, work stoppage recommended

## Risk Factors Assessment:
- Life Safety: How does this affect occupant safety? (LOW/MEDIUM/HIGH/CRITICAL)
- Rework Cost: What is the estimated remediation effort? (LOW/MEDIUM/HIGH)
- Schedule Impact: How will correction affect project timeline? (LOW/MEDIUM/HIGH)

## Response Requirements:
- Always cite the specific code section number (e.g., "FBC 1012.2")
- Provide clear, technical reasoning
- Include practical recommendations for remediation when applicable
- Be conservative in your assessments - when in doubt, flag as WARNING
- Consider the intent of the code, not just the letter

You must respond with a valid JSON object matching the specified schema. Do not include any text outside the JSON object.`;

/**
 * Builds the user prompt with defect description and code context
 */
function buildUserPrompt(
  defectDescription: string,
  jurisdiction: string,
  codeSnippets: RegulatoryCodeSnippet[],
  projectContext?: ComplianceAnalysisInput["projectContext"]
): string {
  const codeContext = codeSnippets
    .map(
      (snippet) =>
        `### ${snippet.codeName} - Section ${snippet.section}: ${snippet.sectionTitle}
${snippet.content}
${snippet.relatedSections?.length ? `Related sections: ${snippet.relatedSections.join(", ")}` : ""}`
    )
    .join("\n\n");

  let prompt = `## Compliance Analysis Request

### Jurisdiction: ${jurisdiction}

### Reported Condition:
${defectDescription}
`;

  if (projectContext) {
    prompt += `
### Project Context:
- Building Type: ${projectContext.buildingType || "Not specified"}
- Occupancy Type: ${projectContext.occupancyType || "Not specified"}
- Construction Phase: ${projectContext.constructionPhase || "Not specified"}
`;
  }

  prompt += `
### Applicable Regulatory Codes:
${codeContext}

### Required Response Format:
Analyze the reported condition against the provided code sections and return a JSON object with the following structure:

{
  "status": "PASS" | "FAIL" | "WARNING",
  "citation": "Specific code section (e.g., FBC 1012.2)",
  "reasoning": "Technical explanation of the compliance determination",
  "riskScore": 1-10,
  "riskFactors": {
    "lifeSafety": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    "reworkCost": "LOW" | "MEDIUM" | "HIGH",
    "scheduleImpact": "LOW" | "MEDIUM" | "HIGH"
  },
  "recommendations": ["Array of recommended corrective actions"],
  "confidence": 0.0-1.0
}`;

  return prompt;
}

/**
 * Parses and validates the AI response
 */
function parseComplianceResponse(
  content: string,
  codeSnippets: RegulatoryCodeSnippet[]
): ComplianceAnalysisResult {
  // Extract JSON from the response (handle potential markdown code blocks)
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

  // Validate required fields
  const status = parsed.status as string;
  if (!["PASS", "FAIL", "WARNING"].includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const riskScore = Number(parsed.riskScore);
  if (isNaN(riskScore) || riskScore < 1 || riskScore > 10) {
    throw new Error(`Invalid risk score: ${parsed.riskScore}`);
  }

  const confidence = Number(parsed.confidence);
  if (isNaN(confidence) || confidence < 0 || confidence > 1) {
    throw new Error(`Invalid confidence: ${parsed.confidence}`);
  }

  // Get code reference from the first relevant code snippet
  const primaryCode = codeSnippets[0];

  return {
    status: status as ComplianceAnalysisResult["status"],
    citation: String(parsed.citation || ""),
    reasoning: String(parsed.reasoning || ""),
    riskScore,
    riskFactors: parsed.riskFactors as ComplianceAnalysisResult["riskFactors"],
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map(String)
      : undefined,
    codeReference: {
      name: primaryCode?.codeName || "Unknown",
      version: primaryCode?.version || "Unknown",
      jurisdiction: primaryCode?.jurisdiction || "Unknown",
    },
    confidence,
  };
}

/**
 * Main compliance analysis server action
 *
 * Analyzes a defect description against relevant building codes for a given jurisdiction.
 *
 * @param input - The analysis input containing defect description and jurisdiction
 * @returns Full compliance response with result, metadata, and code references
 *
 * @example
 * ```ts
 * const result = await analyzeCompliance({
 *   defectDescription: "Ramp slope detected at 1:10",
 *   jurisdiction: "Florida",
 * });
 * ```
 */
export async function analyzeCompliance(
  input: ComplianceAnalysisInput
): Promise<FullComplianceResponse> {
  const startTime = Date.now();

  // Validate input
  if (!input.defectDescription?.trim()) {
    throw new Error("Defect description is required");
  }
  if (!input.jurisdiction?.trim()) {
    throw new Error("Jurisdiction is required");
  }

  // Step 1: Retrieve relevant code snippets
  const codeSnippets = await retrieveRelevantCodes(
    input.defectDescription,
    input.jurisdiction
  );

  if (codeSnippets.length === 0) {
    throw new Error(`No regulatory codes found for jurisdiction: ${input.jurisdiction}`);
  }

  // Step 2: Build the prompt
  const userPrompt = buildUserPrompt(
    input.defectDescription,
    input.jurisdiction,
    codeSnippets,
    input.projectContext
  );

  // Step 3: Call OpenAI API
  const completion = await openai.chat.completions.create({
    model: MODELS.REASONING,
    messages: [
      { role: "system", content: COMPLIANCE_AUDITOR_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1, // Low temperature for consistent, deterministic responses
    max_tokens: 1000,
    response_format: { type: "json_object" },
  });

  const responseContent = completion.choices[0]?.message?.content;
  if (!responseContent) {
    throw new Error("No response received from AI model");
  }

  // Step 4: Parse and validate the response
  const result = parseComplianceResponse(responseContent, codeSnippets);

  // Step 5: Build the full response with metadata
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

/**
 * Batch compliance analysis for multiple defects
 *
 * @param inputs - Array of analysis inputs
 * @returns Array of compliance responses
 */
export async function analyzeComplianceBatch(
  inputs: ComplianceAnalysisInput[]
): Promise<FullComplianceResponse[]> {
  // Process in parallel with concurrency limit
  const CONCURRENCY_LIMIT = 5;
  const results: FullComplianceResponse[] = [];

  for (let i = 0; i < inputs.length; i += CONCURRENCY_LIMIT) {
    const batch = inputs.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.all(
      batch.map((input) => analyzeCompliance(input))
    );
    results.push(...batchResults);
  }

  return results;
}
