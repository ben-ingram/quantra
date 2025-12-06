/**
 * Compliance Analysis Types
 * Types for the Regulatory Reasoning Engine
 */

export type ComplianceStatus = "PASS" | "FAIL" | "WARNING";

export interface ComplianceAnalysisInput {
  /** Description of the defect or condition found in the scan */
  defectDescription: string;
  /** Project location/jurisdiction (e.g., "Florida", "California") */
  jurisdiction: string;
  /** Optional: Specific building codes to check against */
  codeIds?: string[];
  /** Optional: Additional context about the project */
  projectContext?: {
    buildingType?: string;
    occupancyType?: string;
    constructionPhase?: string;
  };
}

export interface ComplianceAnalysisResult {
  /** Overall compliance status */
  status: ComplianceStatus;
  /** Specific code section citation (e.g., "FBC 1012.2") */
  citation: string;
  /** Brief explanation of the compliance determination */
  reasoning: string;
  /** Risk score from 1-10 based on life safety and rework cost */
  riskScore: number;
  /** Detailed breakdown of risk factors */
  riskFactors?: {
    lifeSafety: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    reworkCost: "LOW" | "MEDIUM" | "HIGH";
    scheduleImpact: "LOW" | "MEDIUM" | "HIGH";
  };
  /** Recommended corrective actions if status is FAIL or WARNING */
  recommendations?: string[];
  /** The regulatory code that was referenced */
  codeReference: {
    name: string;
    version: string;
    jurisdiction: string;
  };
  /** Confidence level of the analysis (0-1) */
  confidence: number;
}

export interface RegulatoryCodeSnippet {
  /** Code identifier (e.g., "FBC") */
  codeId: string;
  /** Full name of the code */
  codeName: string;
  /** Version/year */
  version: string;
  /** Jurisdiction this code applies to */
  jurisdiction: string;
  /** Relevant section number */
  section: string;
  /** Section title */
  sectionTitle: string;
  /** Full text of the relevant code section */
  content: string;
  /** Related sections for context */
  relatedSections?: string[];
}

export interface ComplianceCheckMetadata {
  /** Timestamp of the analysis */
  timestamp: string;
  /** AI model used for analysis */
  modelVersion: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Tokens used for the request */
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface FullComplianceResponse {
  /** The analysis result */
  result: ComplianceAnalysisResult;
  /** Metadata about the analysis */
  metadata: ComplianceCheckMetadata;
  /** The code snippets that were referenced */
  codeSnippets: RegulatoryCodeSnippet[];
}
