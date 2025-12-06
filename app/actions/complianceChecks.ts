"use server";

import { headers } from "next/headers";
import { prisma } from "@/app/lib/db";
import { logComplianceCheckChange } from "@/app/lib/audit";
import { openai, MODELS } from "@/app/lib/openai";
import { retrieveRelevantCodes } from "@/app/lib/regulatory-codes";
import type {
  ComplianceAnalysisInput,
  FullComplianceResponse,
  RegulatoryCodeSnippet,
} from "@/app/lib/types/compliance";

// ============================================================================
// Types
// ============================================================================

interface RunComplianceCheckInput {
  scanId: string;
  regulatoryCodeId: string;
  defectDescription: string;
  jurisdiction: string;
  userId: string;
  projectContext?: {
    buildingType?: string;
    occupancyType?: string;
    constructionPhase?: string;
  };
}

interface RunComplianceCheckResult {
  success: boolean;
  complianceCheck?: {
    id: string;
    status: string;
    overallScore: number | null;
  };
  analysis?: FullComplianceResponse;
  auditLogId?: string;
  error?: string;
}

// ============================================================================
// System Prompt
// ============================================================================

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

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Runs a compliance check with full audit trail.
 *
 * This action:
 * 1. Creates a ComplianceCheck record in PENDING status
 * 2. Logs the start of the check
 * 3. Runs the AI analysis
 * 4. Updates the record with results
 * 5. Logs the completion/failure
 *
 * @example
 * ```tsx
 * const result = await runComplianceCheck({
 *   scanId: "scan_123",
 *   regulatoryCodeId: "code_fbc_2023",
 *   defectDescription: "Ramp slope detected at 1:10",
 *   jurisdiction: "Florida",
 *   userId: currentUser.id,
 * });
 * ```
 */
export async function runComplianceCheck(
  input: RunComplianceCheckInput
): Promise<RunComplianceCheckResult> {
  const headersList = await headers();
  const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip");
  const userAgent = headersList.get("user-agent");

  let complianceCheckId: string | undefined;

  try {
    // Step 1: Create the compliance check record
    const complianceCheck = await prisma.complianceCheck.create({
      data: {
        scanId: input.scanId,
        regulatoryCodeId: input.regulatoryCodeId,
        status: "PENDING",
        aiModelVersion: MODELS.REASONING,
      },
    });
    complianceCheckId = complianceCheck.id;

    // Step 2: Log the start of the check
    await logComplianceCheckChange({
      complianceCheckId: complianceCheck.id,
      action: "COMPLIANCE_CHECK_STARTED",
      previousState: {},
      newState: {
        id: complianceCheck.id,
        status: "PENDING",
        scanId: input.scanId,
        regulatoryCodeId: input.regulatoryCodeId,
      },
      userId: input.userId,
      ipAddress,
      userAgent,
    });

    // Step 3: Update status to IN_PROGRESS
    const startedAt = new Date();
    await prisma.complianceCheck.update({
      where: { id: complianceCheck.id },
      data: {
        status: "IN_PROGRESS",
        startedAt,
      },
    });

    // Step 4: Run the AI analysis
    const codeSnippets = await retrieveRelevantCodes(
      input.defectDescription,
      input.jurisdiction
    );

    if (codeSnippets.length === 0) {
      throw new Error(`No regulatory codes found for jurisdiction: ${input.jurisdiction}`);
    }

    const userPrompt = buildUserPrompt(
      input.defectDescription,
      input.jurisdiction,
      codeSnippets,
      input.projectContext
    );

    const completion = await openai.chat.completions.create({
      model: MODELS.REASONING,
      messages: [
        { role: "system", content: COMPLIANCE_AUDITOR_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response received from AI model");
    }

    // Parse the response
    const analysisResult = parseComplianceResponse(responseContent, codeSnippets);

    // Step 5: Update the compliance check with results
    const completedAt = new Date();
    const processingTimeMs = completedAt.getTime() - startedAt.getTime();

    // Calculate overall score (0-100)
    const overallScore = calculateOverallScore(analysisResult);

    const updatedCheck = await prisma.complianceCheck.update({
      where: { id: complianceCheck.id },
      data: {
        status: "COMPLETED",
        overallScore,
        summary: analysisResult.reasoning,
        findings: {
          status: analysisResult.status,
          citation: analysisResult.citation,
          riskScore: analysisResult.riskScore,
          riskFactors: analysisResult.riskFactors,
          recommendations: analysisResult.recommendations,
          confidence: analysisResult.confidence,
        },
        rawAiResponse: JSON.parse(responseContent),
        completedAt,
        processingTimeMs,
      },
      select: {
        id: true,
        status: true,
        overallScore: true,
      },
    });

    // Step 6: Log the completion
    const auditLog = await logComplianceCheckChange({
      complianceCheckId: complianceCheck.id,
      action: "COMPLIANCE_CHECK_COMPLETED",
      previousState: {
        status: "IN_PROGRESS",
        startedAt: startedAt.toISOString(),
      },
      newState: {
        status: "COMPLETED",
        overallScore,
        completedAt: completedAt.toISOString(),
        processingTimeMs,
        analysisStatus: analysisResult.status,
        citation: analysisResult.citation,
        riskScore: analysisResult.riskScore,
      },
      userId: input.userId,
      ipAddress,
      userAgent,
    });

    // Build the full response
    const fullResponse: FullComplianceResponse = {
      result: analysisResult,
      metadata: {
        timestamp: completedAt.toISOString(),
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

    return {
      success: true,
      complianceCheck: updatedCheck,
      analysis: fullResponse,
      auditLogId: auditLog.id,
    };
  } catch (error) {
    console.error("Compliance check failed:", error);

    // If we created a record, mark it as failed
    if (complianceCheckId) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await prisma.complianceCheck.update({
        where: { id: complianceCheckId },
        data: {
          status: "FAILED",
          errorMessage,
          completedAt: new Date(),
        },
      });

      // Log the failure
      await logComplianceCheckChange({
        complianceCheckId,
        action: "COMPLIANCE_CHECK_FAILED",
        previousState: { status: "IN_PROGRESS" },
        newState: {
          status: "FAILED",
          errorMessage,
        },
        userId: input.userId,
        ipAddress,
        userAgent,
      });
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Compliance check failed",
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

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

function parseComplianceResponse(
  content: string,
  codeSnippets: RegulatoryCodeSnippet[]
) {
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

  const primaryCode = codeSnippets[0];

  return {
    status: status as "PASS" | "FAIL" | "WARNING",
    citation: String(parsed.citation || ""),
    reasoning: String(parsed.reasoning || ""),
    riskScore,
    riskFactors: parsed.riskFactors as {
      lifeSafety: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      reworkCost: "LOW" | "MEDIUM" | "HIGH";
      scheduleImpact: "LOW" | "MEDIUM" | "HIGH";
    },
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

function calculateOverallScore(result: { status: string; riskScore: number }): number {
  // Base score based on status
  let baseScore: number;
  switch (result.status) {
    case "PASS":
      baseScore = 100;
      break;
    case "WARNING":
      baseScore = 75;
      break;
    case "FAIL":
      baseScore = 40;
      break;
    default:
      baseScore = 50;
  }

  // Adjust based on risk score (lower risk = higher score)
  const riskAdjustment = ((10 - result.riskScore) / 10) * 20;

  return Math.round(Math.min(100, Math.max(0, baseScore + riskAdjustment - 10)));
}
