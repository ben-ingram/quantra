"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { analyzeCompliance } from "@/app/actions/analyzeCompliance";
import { performSuperRAGAnalysis } from "@/app/actions/performSuperRAGAnalysis";
import type { FullComplianceResponse } from "@/app/lib/types/compliance";

// Extended type for Super RAG response
interface SuperRAGResponse extends FullComplianceResponse {
  result: FullComplianceResponse["result"] & {
    allCitations?: string[];
    dataSourceUsed?: "text" | "table" | "both";
    specificRuleApplied?: string | null;
  };
  retrievalStats?: {
    textChunksFound: number;
    tablesFound: number;
    embeddingTime: number;
    searchTime: number;
  };
}

// =============================================================================
// Types
// =============================================================================

interface ComplianceAnalyzerProps {
  projectId?: string;
  scanId?: string;
  jurisdiction?: string;
  /** Initial query to pre-fill and auto-run */
  initialQuery?: string;
  /** If true, shows inline instead of as a modal trigger button */
  inline?: boolean;
}

type AnalysisState = "idle" | "analyzing" | "success" | "error";

// =============================================================================
// Sample Defects for Demo
// =============================================================================

const SAMPLE_DEFECTS = [
  {
    id: "1",
    description: "Detected exposed electrical wiring in Zone B, ceiling area near HVAC unit",
    area: "Zone B - Ceiling",
  },
  {
    id: "2",
    description: "Ramp slope measured at 1:10 gradient at main entrance",
    area: "Main Entrance",
  },
  {
    id: "3",
    description: "Fire exit door swing direction appears to open inward instead of outward",
    area: "Floor 3 - East Wing",
  },
  {
    id: "4",
    description: "Stairwell handrail height measured at 30 inches, below minimum requirement",
    area: "Stairwell A",
  },
  {
    id: "5",
    description: "Emergency lighting spacing exceeds maximum allowed distance in corridor",
    area: "Floor 2 - North Corridor",
  },
];

// =============================================================================
// Component
// =============================================================================

export function ComplianceAnalyzer({
  projectId,
  scanId,
  jurisdiction = "Florida",
  initialQuery,
  inline = false,
}: ComplianceAnalyzerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [state, setState] = useState<AnalysisState>("idle");
  const [selectedDefect, setSelectedDefect] = useState(SAMPLE_DEFECTS[0]);
  const [customDefect, setCustomDefect] = useState(initialQuery || "");
  const [useCustom, setUseCustom] = useState(!!initialQuery);
  const [useRAG, setUseRAG] = useState(true); // Default to SUPER RAG analysis
  const [result, setResult] = useState<SuperRAGResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(inline); // Auto-open if inline mode

  // Track if we've auto-run for this initialQuery
  const hasAutoRun = useRef(false);
  const lastInitialQuery = useRef(initialQuery);

  // Auto-run analysis when initialQuery changes
  useEffect(() => {
    if (initialQuery && initialQuery !== lastInitialQuery.current) {
      // Reset for new query
      hasAutoRun.current = false;
      lastInitialQuery.current = initialQuery;
      setCustomDefect(initialQuery);
      setUseCustom(true);
      setState("idle");
      setResult(null);
      setError(null);
    }

    if (initialQuery && !hasAutoRun.current && state === "idle") {
      hasAutoRun.current = true;
      // Auto-run after a short delay to allow UI to render
      const timer = setTimeout(() => {
        handleAnalyzeWithQuery(initialQuery);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [initialQuery, state]);

  const handleAnalyzeWithQuery = async (query: string) => {
    if (!query.trim()) {
      setError("Please enter a defect description");
      return;
    }

    setState("analyzing");
    setError(null);
    setResult(null);

    try {
      let response: SuperRAGResponse;

      if (useRAG) {
        response = await performSuperRAGAnalysis({
          query,
          jurisdiction,
          textMatchCount: 8,
          tableMatchThreshold: 0.82,
        });
      } else {
        const mockResponse = await analyzeCompliance({
          defectDescription: query,
          jurisdiction,
          projectContext: {
            buildingType: "Mixed-use Transit Development",
            occupancyType: "Assembly/Residential",
            constructionPhase: "Active Construction",
          },
        });
        response = mockResponse as SuperRAGResponse;
      }

      setResult(response);
      setState("success");

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error("[ComplianceAnalyzer] Analysis failed:", err);
      setError(err instanceof Error ? err.message : "Analysis failed");
      setState("error");
    }
  };

  const handleAnalyze = async () => {
    const defectDescription = useCustom ? customDefect : selectedDefect.description;

    if (!defectDescription.trim()) {
      setError("Please enter a defect description");
      return;
    }

    setState("analyzing");
    setError(null);
    setResult(null);

    try {
      let response: SuperRAGResponse;

      if (useRAG) {
        // Use SUPER RAG with hybrid search (semantic + keyword + tables)
        response = await performSuperRAGAnalysis({
          query: defectDescription,
          jurisdiction,
          textMatchCount: 8,
          tableMatchThreshold: 0.82,
        });
      } else {
        // Use mock-based analysis (fallback)
        const mockResponse = await analyzeCompliance({
          defectDescription,
          jurisdiction,
          projectContext: {
            buildingType: "Mixed-use Transit Development",
            occupancyType: "Assembly/Residential",
            constructionPhase: "Active Construction",
          },
        });
        response = mockResponse as SuperRAGResponse;
      }

      setResult(response);
      setState("success");

      // Refresh the page data
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error("Analysis failed:", err);
      setError(err instanceof Error ? err.message : "Analysis failed");
      setState("error");
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setState("idle");
    setResult(null);
    setError(null);
  };

  // Inline mode - render directly without modal wrapper
  if (inline) {
    return (
      <div className="rounded-xl border border-border bg-surface shadow-lg overflow-hidden">
        {/* Inline Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border bg-surface-hover/30">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/20 text-accent">
            <SparklesIcon />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">
              AI Compliance Analysis
            </h2>
            <p className="text-sm text-foreground-muted">
              Analyzing against {jurisdiction} building codes
            </p>
          </div>
        </div>

        {/* Query Display */}
        {initialQuery && (
          <div className="px-4 py-3 bg-primary/5 border-b border-border">
            <p className="text-xs text-foreground-muted uppercase tracking-wide mb-1">Query</p>
            <p className="text-sm text-foreground font-medium">{initialQuery}</p>
          </div>
        )}

        {/* Body */}
        <div className="p-4">
          {state === "analyzing" ? (
            <AnalyzingState />
          ) : state === "success" && result ? (
            <ResultView result={result} />
          ) : state === "error" ? (
            <div className="p-4 rounded-lg bg-danger/10 border border-danger/30">
              <p className="text-danger text-sm">{error}</p>
              <button
                onClick={() => initialQuery && handleAnalyzeWithQuery(initialQuery)}
                className="mt-3 px-4 py-2 text-sm font-medium rounded-lg bg-danger/20 text-danger hover:bg-danger/30 transition-colors"
              >
                Retry Analysis
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-foreground-muted">
              <p>Select an element and click &quot;Run Compliance Check&quot;</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Modal mode (original behavior)
  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors"
      >
        <SparklesIcon />
        Run Compliance Check
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border bg-surface">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/20 text-accent">
                  <SparklesIcon />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    AI Compliance Analysis
                  </h2>
                  <p className="text-sm text-foreground-muted">
                    Analyze a defect against {jurisdiction} building codes
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                <XIcon />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              {state === "idle" || state === "error" ? (
                <>
                  {/* Analysis Mode Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface-hover/50 border border-border">
                    <div className="flex items-center gap-3">
                      <DatabaseIcon />
                      <div>
                        <p className="text-sm font-medium text-foreground">SUPER RAG (Hybrid Search)</p>
                        <p className="text-xs text-foreground-muted">
                          Semantic + keyword search with structured table data
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUseRAG(!useRAG)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        useRAG ? "bg-primary" : "bg-foreground-muted/30"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          useRAG ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Defect Selection */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Select a defect to analyze
                    </label>
                    <div className="space-y-2">
                      {SAMPLE_DEFECTS.map((defect) => (
                        <label
                          key={defect.id}
                          className={`
                            flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                            ${!useCustom && selectedDefect.id === defect.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-border-strong hover:bg-surface-hover"
                            }
                          `}
                        >
                          <input
                            type="radio"
                            name="defect"
                            checked={!useCustom && selectedDefect.id === defect.id}
                            onChange={() => {
                              setSelectedDefect(defect);
                              setUseCustom(false);
                            }}
                            className="mt-1"
                          />
                          <div>
                            <p className="text-sm text-foreground">{defect.description}</p>
                            <p className="text-xs text-foreground-muted mt-1">
                              {defect.area}
                            </p>
                          </div>
                        </label>
                      ))}

                      {/* Custom Input */}
                      <label
                        className={`
                          flex flex-col gap-2 p-3 rounded-lg border cursor-pointer transition-all
                          ${useCustom
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-border-strong hover:bg-surface-hover"
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="defect"
                            checked={useCustom}
                            onChange={() => setUseCustom(true)}
                          />
                          <span className="text-sm font-medium text-foreground">
                            Custom defect description
                          </span>
                        </div>
                        {useCustom && (
                          <textarea
                            value={customDefect}
                            onChange={(e) => setCustomDefect(e.target.value)}
                            placeholder="Describe the defect or condition to analyze..."
                            rows={3}
                            className="w-full mt-2 p-2 text-sm rounded-lg bg-surface border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                          />
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
                      {error}
                    </div>
                  )}
                </>
              ) : state === "analyzing" ? (
                <AnalyzingState />
              ) : state === "success" && result ? (
                <ResultView result={result} />
              ) : null}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex items-center justify-end gap-3 p-4 border-t border-border bg-surface">
              {state === "idle" || state === "error" ? (
                <>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAnalyze}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors"
                  >
                    <SparklesIcon />
                    Analyze with AI
                  </button>
                </>
              ) : state === "analyzing" ? (
                <button
                  disabled
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary/50 text-white/70 cursor-not-allowed"
                >
                  <LoadingSpinner />
                  Analyzing...
                </button>
              ) : (
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function AnalyzingState() {
  return (
    <div className="py-12 flex flex-col items-center justify-center">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <SparklesIcon className="w-6 h-6 text-primary animate-pulse" />
        </div>
      </div>
      <h3 className="mt-6 text-lg font-semibold text-foreground">
        Analyzing Compliance
      </h3>
      <p className="mt-2 text-sm text-foreground-muted text-center max-w-sm">
        The AI is evaluating the defect against applicable building codes. This typically takes 5-10 seconds.
      </p>

      {/* Animated Steps */}
      <div className="mt-6 space-y-2 text-sm">
        <div className="flex items-center gap-2 text-success">
          <CheckIcon />
          <span>Retrieved relevant code sections</span>
        </div>
        <div className="flex items-center gap-2 text-primary animate-pulse">
          <LoadingSpinner />
          <span>Running compliance analysis...</span>
        </div>
        <div className="flex items-center gap-2 text-foreground-muted">
          <div className="w-4 h-4" />
          <span>Generate recommendations</span>
        </div>
      </div>
    </div>
  );
}

function ResultView({ result }: { result: SuperRAGResponse }) {
  const {
    status,
    citation,
    reasoning,
    riskScore,
    riskFactors,
    recommendations,
    confidence,
    allCitations,
    dataSourceUsed,
    specificRuleApplied,
  } = result.result;

  const retrievalStats = result.retrievalStats;

  const statusConfig = {
    PASS: {
      bg: "bg-success/10",
      border: "border-success/30",
      text: "text-success",
      label: "Compliant",
      icon: <CheckIcon className="w-5 h-5" />,
    },
    FAIL: {
      bg: "bg-danger/10",
      border: "border-danger/30",
      text: "text-danger",
      label: "Non-Compliant",
      icon: <XIcon className="w-5 h-5" />,
    },
    WARNING: {
      bg: "bg-warning/10",
      border: "border-warning/30",
      text: "text-warning",
      label: "Needs Review",
      icon: <AlertIcon className="w-5 h-5" />,
    },
  };

  const config = statusConfig[status];

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className={`p-4 rounded-lg ${config.bg} border ${config.border}`}>
        <div className="flex items-center gap-3">
          <div className={config.text}>{config.icon}</div>
          <div>
            <p className={`text-lg font-semibold ${config.text}`}>{config.label}</p>
            <p className="text-sm text-foreground-secondary">{citation}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm text-foreground-muted">Risk Score</p>
            <p className={`text-2xl font-bold ${config.text}`}>{riskScore}/10</p>
          </div>
        </div>
      </div>

      {/* Reasoning */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-2">Analysis</h4>
        <p className="text-sm text-foreground-secondary">{reasoning}</p>
      </div>

      {/* Risk Factors */}
      {riskFactors && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Risk Factors</h4>
          <div className="grid grid-cols-3 gap-2">
            <RiskBadge label="Life Safety" level={riskFactors.lifeSafety} />
            <RiskBadge label="Rework Cost" level={riskFactors.reworkCost} />
            <RiskBadge label="Schedule" level={riskFactors.scheduleImpact} />
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Recommendations</h4>
          <ul className="space-y-1">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground-secondary">
                <span className="text-primary mt-0.5">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Data Source Info */}
      {(dataSourceUsed || specificRuleApplied || allCitations) && (
        <div className="p-3 rounded-lg bg-surface-hover/50 border border-border">
          <h4 className="text-xs font-medium text-foreground-muted mb-2 uppercase tracking-wide">
            Analysis Details
          </h4>
          <div className="space-y-1 text-sm">
            {dataSourceUsed && (
              <div className="flex items-center gap-2">
                <span className="text-foreground-muted">Data Source:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  dataSourceUsed === "table"
                    ? "bg-primary/10 text-primary"
                    : dataSourceUsed === "both"
                    ? "bg-accent/10 text-accent"
                    : "bg-foreground-muted/10 text-foreground-secondary"
                }`}>
                  {dataSourceUsed === "table" ? "Structured Table" :
                   dataSourceUsed === "both" ? "Text + Table" : "Text Context"}
                </span>
              </div>
            )}
            {specificRuleApplied && (
              <div className="flex items-center gap-2">
                <span className="text-foreground-muted">Specific Rule Applied:</span>
                <span className="font-mono text-xs text-primary">{specificRuleApplied}</span>
              </div>
            )}
            {allCitations && allCitations.length > 1 && (
              <div className="flex items-start gap-2">
                <span className="text-foreground-muted">All Citations:</span>
                <span className="text-foreground-secondary">
                  {allCitations.join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-center justify-between text-xs text-foreground-muted">
          <span>Confidence: {Math.round(confidence * 100)}%</span>
          <span>Model: {result.metadata.modelVersion}</span>
          <span>Time: {result.metadata.processingTimeMs}ms</span>
        </div>
        {retrievalStats && (
          <div className="flex items-center justify-between text-xs text-foreground-muted mt-1 pt-1 border-t border-border/50">
            <span>Text Chunks: {retrievalStats.textChunksFound}</span>
            <span>Tables: {retrievalStats.tablesFound}</span>
            <span>Search: {retrievalStats.searchTime}ms</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RiskBadge({ label, level }: { label: string; level: string }) {
  const levelColors: Record<string, string> = {
    LOW: "bg-success/10 text-success border-success/30",
    MEDIUM: "bg-warning/10 text-warning border-warning/30",
    HIGH: "bg-accent/10 text-accent border-accent/30",
    CRITICAL: "bg-danger/10 text-danger border-danger/30",
  };

  return (
    <div className={`p-2 rounded-lg border text-center ${levelColors[level] || levelColors.MEDIUM}`}>
      <p className="text-xs text-foreground-muted">{label}</p>
      <p className="text-sm font-medium">{level}</p>
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function SparklesIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function XIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function AlertIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function LoadingSpinner({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function DatabaseIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  );
}
