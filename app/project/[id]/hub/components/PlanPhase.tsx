"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Flag,
} from "lucide-react";
import {
  getOrCreateQualityManual,
  generateITPs,
  approveQualityManual,
  type QualityManual,
  type InspectionTestPlan,
} from "@/app/actions/quality-manual";

interface PlanPhaseProps {
  projectId: string;
  onAdvancePhase: () => void;
}

export function PlanPhase({ projectId, onAdvancePhase }: PlanPhaseProps) {
  const [manual, setManual] = useState<QualityManual | null>(null);
  const [itps, setItps] = useState<InspectionTestPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  // Load or create quality manual
  useEffect(() => {
    async function loadManual() {
      try {
        const result = await getOrCreateQualityManual(projectId);
        if (result.success && result.manual) {
          setManual(result.manual);
          setItps(result.itps || []);
        } else {
          setError(result.error || "Failed to load quality manual");
        }
      } catch (err) {
        console.error("Error loading manual:", err);
        setError("Failed to load quality manual");
      } finally {
        setIsLoading(false);
      }
    }

    loadManual();
  }, [projectId]);

  // Generate ITPs
  const handleGenerateITPs = useCallback(async () => {
    if (!manual) return;

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateITPs(projectId, manual.id);
      if (result.success) {
        setItps(result.itps || []);
        // Expand all phases by default
        const phases = new Set(result.itps?.map((itp) => itp.construction_phase) || []);
        setExpandedPhases(phases);
      } else {
        setError(result.error || "Failed to generate ITPs");
      }
    } catch (err) {
      console.error("Error generating ITPs:", err);
      setError("Failed to generate ITPs");
    } finally {
      setIsGenerating(false);
    }
  }, [projectId, manual]);

  // Approve manual and advance
  const handleApprove = useCallback(async () => {
    if (!manual) return;

    setIsApproving(true);
    setError(null);

    try {
      // approveQualityManual now also calls activateInspectionPlan internally
      // and advances the project phase to "execute"
      const result = await approveQualityManual(manual.id, projectId);
      if (result.success) {
        setManual((prev) =>
          prev ? { ...prev, status: "approved", approved_at: new Date().toISOString() } : null
        );
        // The phase has been advanced to "execute" in the server action
        onAdvancePhase();
      } else {
        setError(result.error || "Failed to approve manual");
      }
    } catch (err) {
      console.error("Error approving manual:", err);
      setError("Failed to approve manual");
    } finally {
      setIsApproving(false);
    }
  }, [manual, projectId, onAdvancePhase]);

  // Toggle phase expansion
  const togglePhase = (phase: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) {
        next.delete(phase);
      } else {
        next.add(phase);
      }
      return next;
    });
  };

  // Group ITPs by construction phase
  const itpsByPhase = itps.reduce(
    (acc, itp) => {
      const phase = itp.construction_phase;
      if (!acc[phase]) acc[phase] = [];
      acc[phase].push(itp);
      return acc;
    },
    {} as Record<string, InspectionTestPlan[]>
  );

  const phaseOrder = [
    "Foundation",
    "Structure",
    "Rough-In",
    "Envelope",
    "MEP",
    "Interior",
    "Final",
  ];

  const sortedPhases = Object.keys(itpsByPhase).sort(
    (a, b) => phaseOrder.indexOf(a) - phaseOrder.indexOf(b)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left Panel - ITPs */}
      <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border bg-surface-hover/30">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Inspection Test Plans
              </h2>
              <p className="text-sm text-foreground-muted">
                {itps.length} inspection points across {sortedPhases.length} phases
              </p>
            </div>
            <button
              onClick={handleGenerateITPs}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {itps.length === 0 ? "Generate ITPs" : "Regenerate"}
            </button>
          </div>
        </div>

        {/* ITP List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {itps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <FileCheck className="w-16 h-16 text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No ITPs Generated Yet
              </h3>
              <p className="text-sm text-foreground-muted max-w-md mb-6">
                Click &quot;Generate ITPs&quot; to create inspection test plans based on
                your project specifications and applicable building codes.
              </p>
            </div>
          ) : (
            sortedPhases.map((phase) => (
              <div
                key={phase}
                className="rounded-lg border border-border bg-surface overflow-hidden"
              >
                {/* Phase Header */}
                <button
                  onClick={() => togglePhase(phase)}
                  className="w-full flex items-center justify-between p-4 hover:bg-surface-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedPhases.has(phase) ? (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                    <span className="font-semibold text-foreground">{phase}</span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                      {itpsByPhase[phase].length} items
                    </span>
                  </div>
                </button>

                {/* Phase Items */}
                {expandedPhases.has(phase) && (
                  <div className="border-t border-border">
                    {itpsByPhase[phase].map((itp, idx) => (
                      <ITPItem key={itp.id} itp={itp} isLast={idx === itpsByPhase[phase].length - 1} />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Approval */}
      <div className="w-80 flex flex-col bg-surface-hover/20">
        {/* Manual Status */}
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Quality Manual
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground-muted">Status</span>
              <StatusBadge status={manual?.status || "draft"} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground-muted">Version</span>
              <span className="text-sm font-medium text-foreground">
                v{manual?.version || 1}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground-muted">ITPs</span>
              <span className="text-sm font-medium text-foreground">
                {itps.length} items
              </span>
            </div>

            {manual?.approved_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground-muted">Approved</span>
                <span className="text-sm font-medium text-foreground">
                  {new Date(manual.approved_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Approval Checklist */}
        <div className="flex-1 p-6">
          <h4 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider mb-4">
            Pre-Approval Checklist
          </h4>

          <div className="space-y-3">
            <ChecklistItem
              complete={itps.length > 0}
              label="ITPs Generated"
              description="Inspection test plans created"
            />
            <ChecklistItem
              complete={itps.some((itp) => itp.is_hold_point)}
              label="Hold Points Defined"
              description="Critical inspection points marked"
            />
            <ChecklistItem
              complete={itps.every((itp) => itp.frequency)}
              label="Frequencies Set"
              description="Inspection schedules defined"
            />
            <ChecklistItem
              complete={itps.every((itp) => itp.responsibility)}
              label="Responsibilities Assigned"
              description="Parties assigned to each ITP"
            />
          </div>
        </div>

        {/* Approve Button */}
        <div className="p-6 border-t border-border">
          <button
            onClick={handleApprove}
            disabled={isApproving || itps.length === 0 || manual?.status === "approved"}
            className={`
              w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl
              font-semibold text-lg transition-all duration-300
              ${manual?.status === "approved"
                ? "bg-emerald-500/20 text-emerald-400 cursor-default"
                : itps.length === 0
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30"
              }
            `}
          >
            {isApproving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : manual?.status === "approved" ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Approved
              </>
            ) : (
              <>
                Approve & Activate
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          {manual?.status !== "approved" && itps.length > 0 && (
            <p className="mt-3 text-xs text-foreground-muted text-center">
              Approving will lock the manual and generate daily checklists
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function ITPItem({ itp, isLast }: { itp: InspectionTestPlan; isLast: boolean }) {
  return (
    <div
      className={`
        p-4 hover:bg-surface-hover/50 transition-colors
        ${!isLast ? "border-b border-border/50" : ""}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Hold Point Indicator */}
        <div
          className={`
            mt-0.5 w-2 h-2 rounded-full flex-shrink-0
            ${itp.is_hold_point ? "bg-amber-500" : "bg-slate-600"}
          `}
        />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {itp.activity}
          </p>

          {itp.acceptance_criteria && (
            <p className="text-xs text-foreground-muted mt-1 line-clamp-2">
              {itp.acceptance_criteria}
            </p>
          )}

          <div className="flex items-center gap-4 mt-2">
            {itp.frequency && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                {itp.frequency}
              </div>
            )}
            {itp.responsibility && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <User className="w-3 h-3" />
                {itp.responsibility}
              </div>
            )}
            {itp.is_hold_point && (
              <div className="flex items-center gap-1 text-xs text-amber-500">
                <Flag className="w-3 h-3" />
                Hold Point
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-slate-500/20 text-slate-400",
    review: "bg-amber-500/20 text-amber-400",
    approved: "bg-emerald-500/20 text-emerald-400",
  };

  return (
    <span
      className={`
        px-2.5 py-1 text-xs font-medium rounded-full capitalize
        ${styles[status] || styles.draft}
      `}
    >
      {status}
    </span>
  );
}

function ChecklistItem({
  complete,
  label,
  description,
}: {
  complete: boolean;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`
          mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
          ${complete ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-600"}
        `}
      >
        {complete && <CheckCircle2 className="w-3.5 h-3.5" />}
      </div>
      <div>
        <p
          className={`
            text-sm font-medium
            ${complete ? "text-foreground" : "text-slate-500"}
          `}
        >
          {label}
        </p>
        <p className="text-xs text-slate-600">{description}</p>
      </div>
    </div>
  );
}
