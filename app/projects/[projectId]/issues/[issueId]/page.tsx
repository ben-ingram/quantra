"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { IssueDetail } from "@/app/lib/data";
import { resolveIssue, updateIssueStatus } from "@/app/actions/issues";

// =============================================================================
// Types
// =============================================================================

interface PageProps {
  params: Promise<{ projectId: string; issueId: string }>;
}

// =============================================================================
// Page Component (Client-side data fetching for real-time updates)
// =============================================================================

export default function IssueResolutionPage({ params }: PageProps) {
  const router = useRouter();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [demoUserId, setDemoUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedParams, setResolvedParams] = useState<{
    projectId: string;
    issueId: string;
  } | null>(null);

  // Resolve params and fetch data
  useEffect(() => {
    async function loadData() {
      try {
        const { projectId, issueId } = await params;
        setResolvedParams({ projectId, issueId });

        // Fetch issue data
        const response = await fetch(`/api/issues/${issueId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Issue not found");
          } else {
            setError("Failed to load issue");
          }
          return;
        }
        const data = await response.json();
        setIssue(data.issue);
        setDemoUserId(data.demoUserId);
      } catch {
        setError("Failed to load issue data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params]);

  if (loading) {
    return <LoadingState />;
  }

  if (error || !issue || !resolvedParams) {
    return <ErrorState error={error} projectId={resolvedParams?.projectId} />;
  }

  return (
    <IssueResolutionContent
      issue={issue}
      projectId={resolvedParams.projectId}
      demoUserId={demoUserId}
      onUpdate={() => router.refresh()}
    />
  );
}

// =============================================================================
// Main Content Component
// =============================================================================

function IssueResolutionContent({
  issue,
  projectId,
  demoUserId,
  onUpdate,
}: {
  issue: IssueDetail;
  projectId: string;
  demoUserId: string | null;
  onUpdate: () => void;
}) {
  const router = useRouter();
  const [actionState, setActionState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!demoUserId) {
      setActionError("No user available for this action");
      return;
    }

    setActionState("loading");
    setActionError(null);

    const result = await resolveIssue({
      issueId: issue.id,
      resolution: "Issue verified and confirmed by engineer. Remediation required.",
      userId: demoUserId,
    });

    if (result.success) {
      setActionState("success");
      setTimeout(() => {
        router.push(`/projects/${projectId}`);
      }, 1500);
    } else {
      setActionState("error");
      setActionError(result.error || "Failed to verify issue");
    }
  };

  const handleReject = async () => {
    if (!demoUserId) {
      setActionError("No user available for this action");
      return;
    }

    if (!rejectReason.trim()) {
      setActionError("Please provide a reason for rejection");
      return;
    }

    setActionState("loading");
    setActionError(null);

    const result = await updateIssueStatus({
      issueId: issue.id,
      status: "IGNORED",
      reason: rejectReason,
      userId: demoUserId,
    });

    if (result.success) {
      setActionState("success");
      setShowRejectModal(false);
      setTimeout(() => {
        router.push(`/projects/${projectId}`);
      }, 1500);
    } else {
      setActionState("error");
      setActionError(result.error || "Failed to reject issue");
    }
  };

  const isResolved = issue.status === "RESOLVED" || issue.status === "IGNORED";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-xl">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/projects/${projectId}`}
                className="flex items-center gap-2 text-foreground-muted hover:text-foreground transition-colors"
              >
                <ArrowLeftIcon />
                <span className="text-sm">Back to Dashboard</span>
              </Link>
              <div className="w-px h-6 bg-border" />
              <div>
                <h1 className="text-lg font-semibold text-foreground">{issue.title}</h1>
                <p className="text-sm text-foreground-muted">{issue.project.name}</p>
              </div>
            </div>
            <SeverityBadge severity={issue.severity} />
          </div>
        </div>
      </header>

      {/* Main Content - Split Screen */}
      <main className="max-w-[1800px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left Panel - Evidence */}
          <EvidencePanel issue={issue} />

          {/* Right Panel - Reasoning Engine */}
          <div className="space-y-6">
            <ReasoningEnginePanel issue={issue} />

            {/* Action Zone */}
            {!isResolved ? (
              <ActionZone
                actionState={actionState}
                actionError={actionError}
                onVerify={handleVerify}
                onReject={() => setShowRejectModal(true)}
              />
            ) : (
              <ResolvedBanner issue={issue} />
            )}

            {/* Audit Trail */}
            <AuditTrailPanel auditLogs={issue.auditLogs} />
          </div>
        </div>
      </main>

      {/* Reject Modal */}
      {showRejectModal && (
        <RejectModal
          rejectReason={rejectReason}
          setRejectReason={setRejectReason}
          actionState={actionState}
          actionError={actionError}
          onCancel={() => {
            setShowRejectModal(false);
            setRejectReason("");
            setActionError(null);
          }}
          onConfirm={handleReject}
        />
      )}
    </div>
  );
}

// =============================================================================
// Evidence Panel (Left Side)
// =============================================================================

function EvidencePanel({ issue }: { issue: IssueDetail }) {
  const scanMetadata = issue.scan?.metadata as Record<string, string> | null;

  return (
    <div className="space-y-6">
      {/* Scan Image Card */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="p-4 border-b border-border bg-surface-hover/50">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CameraIcon />
              Scan Evidence
            </h2>
            <span className="text-xs text-foreground-muted">
              {issue.scan?.scanType || "Manual"} Capture
            </span>
          </div>
        </div>

        {/* Image Area */}
        <div className="relative aspect-video bg-background">
          {issue.scan?.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={issue.scan.thumbnailUrl}
              alt="Scan evidence"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-hover flex items-center justify-center">
                  <ScanIcon />
                </div>
                <p className="text-sm text-foreground-muted">Scan image placeholder</p>
                <p className="text-xs text-foreground-muted mt-1">
                  Point cloud visualization would appear here
                </p>
              </div>
            </div>
          )}

          {/* Overlay with detection highlight */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 left-1/3 w-32 h-24 border-2 border-danger rounded-lg animate-pulse" />
            <div className="absolute top-1/3 left-1/3 -translate-x-2 -translate-y-6 px-2 py-1 rounded bg-danger text-white text-xs font-medium">
              Detected Issue
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="p-4 border-t border-border">
          <div className="grid grid-cols-2 gap-4">
            <MetadataItem
              icon={<ClockIcon />}
              label="Detected at"
              value={formatDateTime(issue.detectedAt)}
            />
            <MetadataItem
              icon={<LocationIcon />}
              label="Location"
              value={issue.location || "Unknown"}
            />
            <MetadataItem
              icon={<DroneIcon />}
              label="Source"
              value={scanMetadata?.droneModel || issue.scan?.scanType || "Manual Entry"}
            />
            <MetadataItem
              icon={<LayersIcon />}
              label="BIM Element"
              value={issue.bimElementId || "Not linked"}
              mono
            />
          </div>
        </div>
      </div>

      {/* Coordinates Card */}
      {issue.coordinates && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <CoordinatesIcon />
            Spatial Coordinates
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <CoordinateBox label="X" value={issue.coordinates.x} />
            <CoordinateBox label="Y" value={issue.coordinates.y} />
            <CoordinateBox label="Z" value={issue.coordinates.z} />
          </div>
        </div>
      )}

      {/* Description Card */}
      {issue.description && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Issue Description</h3>
          <p className="text-sm text-foreground-secondary leading-relaxed">{issue.description}</p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Reasoning Engine Panel (Right Side)
// =============================================================================

function ReasoningEnginePanel({ issue }: { issue: IssueDetail }) {
  const findings = issue.complianceCheck?.findings;
  const riskFactors = findings?.riskFactors;

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BrainIcon />
            AI Reasoning Engine
          </h2>
          <ComplianceStatusBadge status={findings?.status || issue.severity} />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Regulatory Citation */}
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
              <BookIcon />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider mb-1">
                Regulatory Citation
              </p>
              <p className="text-lg font-semibold text-foreground">
                {findings?.citation || issue.codeReference || "No citation available"}
              </p>
              {issue.complianceCheck?.regulatoryCode && (
                <p className="text-sm text-foreground-secondary mt-1">
                  {issue.complianceCheck.regulatoryCode.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* AI Explanation */}
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider mb-2">
            AI Explanation
          </p>
          <p className="text-sm text-foreground-secondary leading-relaxed">
            {findings?.reasoning || issue.aiAnalysis || issue.complianceCheck?.summary || "No AI analysis available for this issue."}
          </p>
          {findings?.confidence && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-foreground-muted">Confidence:</span>
              <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${findings.confidence * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-foreground">
                {Math.round(findings.confidence * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Risk Assessment */}
        {riskFactors && (
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider mb-3">
              Risk Assessment
            </p>
            <div className="grid grid-cols-3 gap-3">
              <RiskFactorCard
                label="Life Safety"
                level={riskFactors.lifeSafety || issue.safetyImpact}
              />
              <RiskFactorCard
                label="Rework Cost"
                level={riskFactors.reworkCost || issue.costImpact}
              />
              <RiskFactorCard
                label="Schedule"
                level={riskFactors.scheduleImpact || issue.scheduleImpact}
              />
            </div>
          </div>
        )}

        {/* Recommendations */}
        {findings?.recommendations && findings.recommendations.length > 0 && (
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider mb-3">
              Recommended Actions
            </p>
            <ul className="space-y-2">
              {findings.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground-secondary">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
                    {i + 1}
                  </span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risk Score */}
        {(findings?.riskScore || issue.severityScore) && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface-hover">
            <span className="text-sm text-foreground-muted">Overall Risk Score</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-background rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    (findings?.riskScore || 0) >= 8 || issue.severityScore >= 80
                      ? "bg-danger"
                      : (findings?.riskScore || 0) >= 5 || issue.severityScore >= 50
                      ? "bg-warning"
                      : "bg-success"
                  }`}
                  style={{
                    width: `${findings?.riskScore ? findings.riskScore * 10 : issue.severityScore}%`,
                  }}
                />
              </div>
              <span className="text-lg font-bold text-foreground">
                {findings?.riskScore || Math.round(issue.severityScore / 10)}/10
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Action Zone
// =============================================================================

function ActionZone({
  actionState,
  actionError,
  onVerify,
  onReject,
}: {
  actionState: "idle" | "loading" | "success" | "error";
  actionError: string | null;
  onVerify: () => void;
  onReject: () => void;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-border bg-surface p-6">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-foreground">Human-in-the-Loop Decision</h3>
        <p className="text-sm text-foreground-muted mt-1">
          Review the AI findings and make your determination
        </p>
      </div>

      {actionError && (
        <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
          {actionError}
        </div>
      )}

      {actionState === "success" ? (
        <div className="flex items-center justify-center gap-2 py-4 text-success">
          <CheckCircleIcon />
          <span className="font-medium">Decision recorded. Redirecting...</span>
        </div>
      ) : (
        <div className="flex gap-4">
          <button
            onClick={onVerify}
            disabled={actionState === "loading"}
            className="flex-1 py-4 px-6 rounded-xl bg-success hover:bg-success/90 text-white font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-success/20"
          >
            {actionState === "loading" ? (
              <LoadingSpinner />
            ) : (
              <>
                <CheckIcon />
                Verify Issue
              </>
            )}
          </button>
          <button
            onClick={onReject}
            disabled={actionState === "loading"}
            className="flex-1 py-4 px-6 rounded-xl bg-danger hover:bg-danger/90 text-white font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-danger/20"
          >
            <XIcon />
            Reject / Override
          </button>
        </div>
      )}

      <p className="text-xs text-foreground-muted text-center mt-4">
        Your decision will be permanently recorded in the audit log with timestamp and digital signature
      </p>
    </div>
  );
}

// =============================================================================
// Resolved Banner
// =============================================================================

function ResolvedBanner({ issue }: { issue: IssueDetail }) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        issue.status === "RESOLVED"
          ? "border-success/30 bg-success/10"
          : "border-foreground-muted/30 bg-surface-hover"
      }`}
    >
      <div className="flex items-center gap-3">
        {issue.status === "RESOLVED" ? (
          <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
            <CheckCircleIcon />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full bg-foreground-muted/20 flex items-center justify-center">
            <XCircleIcon />
          </div>
        )}
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {issue.status === "RESOLVED" ? "Issue Verified & Resolved" : "Issue Rejected / Ignored"}
          </h3>
          <p className="text-sm text-foreground-muted">
            {issue.resolvedBy
              ? `By ${issue.resolvedBy.name} on ${formatDateTime(issue.resolvedAt!)}`
              : `Status: ${issue.status}`}
          </p>
        </div>
      </div>
      {issue.resolution && (
        <div className="mt-4 p-3 rounded-lg bg-background">
          <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider mb-1">
            Resolution Notes
          </p>
          <p className="text-sm text-foreground-secondary">{issue.resolution}</p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Audit Trail Panel
// =============================================================================

function AuditTrailPanel({
  auditLogs,
}: {
  auditLogs: IssueDetail["auditLogs"];
}) {
  if (auditLogs.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="p-4 border-b border-border bg-surface-hover/50">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <HistoryIcon />
          Audit Trail
        </h3>
      </div>
      <div className="divide-y divide-border">
        {auditLogs.map((log) => (
          <div key={log.id} className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center flex-shrink-0">
              <AuditActionIcon action={log.action} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">
                <span className="font-medium">{log.user?.name || "System"}</span>
                {" "}
                <span className="text-foreground-muted">{formatAuditAction(log.action)}</span>
              </p>
              {log.reason && (
                <p className="text-xs text-foreground-muted mt-1 truncate">{log.reason}</p>
              )}
              <p className="text-xs text-foreground-muted mt-1">{formatDateTime(log.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Reject Modal
// =============================================================================

function RejectModal({
  rejectReason,
  setRejectReason,
  actionState,
  actionError,
  onCancel,
  onConfirm,
}: {
  rejectReason: string;
  setRejectReason: (value: string) => void;
  actionState: "idle" | "loading" | "success" | "error";
  actionError: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-lg mx-4 rounded-xl border border-border bg-surface shadow-2xl">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Override AI Finding</h3>
          <p className="text-sm text-foreground-muted mt-1">
            Please provide a detailed explanation for rejecting this finding. This will be permanently recorded in the audit log.
          </p>
        </div>

        <div className="p-6">
          {actionError && (
            <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
              {actionError}
            </div>
          )}

          <label className="block text-sm font-medium text-foreground mb-2">
            Rejection Reason <span className="text-danger">*</span>
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain why this AI finding is being rejected (e.g., 'False positive - measurement within acceptable tolerance per field verification')"
            rows={4}
            className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
          />
          <p className="text-xs text-foreground-muted mt-2">
            Minimum 20 characters required for audit compliance
          </p>
        </div>

        <div className="p-6 border-t border-border flex gap-3">
          <button
            onClick={onCancel}
            disabled={actionState === "loading"}
            className="flex-1 py-3 px-4 rounded-lg border border-border text-foreground hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={actionState === "loading" || rejectReason.length < 20}
            className="flex-1 py-3 px-4 rounded-lg bg-danger text-white font-medium hover:bg-danger/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {actionState === "loading" ? (
              <LoadingSpinner />
            ) : (
              <>
                <XIcon />
                Confirm Rejection
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function LoadingState() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="large" />
        <p className="text-foreground-muted mt-4">Loading issue details...</p>
      </div>
    </div>
  );
}

function ErrorState({ error, projectId }: { error: string | null; projectId?: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-danger/20 flex items-center justify-center">
          <XCircleIcon />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">
          {error || "Issue Not Found"}
        </h1>
        <p className="text-foreground-muted mb-6">
          The issue you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        {projectId && (
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            <ArrowLeftIcon />
            Back to Dashboard
          </Link>
        )}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { bg: string; text: string; border: string }> = {
    CRITICAL: { bg: "bg-danger/20", text: "text-danger", border: "border-danger/30" },
    HIGH: { bg: "bg-accent/20", text: "text-accent", border: "border-accent/30" },
    MEDIUM: { bg: "bg-warning/20", text: "text-warning", border: "border-warning/30" },
    LOW: { bg: "bg-success/20", text: "text-success", border: "border-success/30" },
  };

  const { bg, text, border } = config[severity] || config.MEDIUM;

  return (
    <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${bg} ${text} border ${border}`}>
      {severity}
    </span>
  );
}

function ComplianceStatusBadge({ status }: { status: string }) {
  const normalized = status?.toUpperCase();

  if (normalized === "FAIL" || normalized === "CRITICAL" || normalized === "HIGH") {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-danger text-white">
        NON-COMPLIANT
      </span>
    );
  }
  if (normalized === "WARNING" || normalized === "MEDIUM") {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-warning text-black">
        WARNING
      </span>
    );
  }
  return (
    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-success text-white">
      COMPLIANT
    </span>
  );
}

function MetadataItem({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-foreground-muted mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-foreground-muted">{label}</p>
        <p className={`text-sm text-foreground ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

function CoordinateBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center p-3 rounded-lg bg-background">
      <p className="text-xs text-foreground-muted">{label}</p>
      <p className="text-lg font-mono font-semibold text-foreground">{value.toFixed(1)}</p>
    </div>
  );
}

function RiskFactorCard({ label, level }: { label: string; level: string }) {
  const colors: Record<string, string> = {
    CRITICAL: "bg-danger/20 text-danger border-danger/30",
    HIGH: "bg-accent/20 text-accent border-accent/30",
    MEDIUM: "bg-warning/20 text-warning border-warning/30",
    LOW: "bg-success/20 text-success border-success/30",
    NONE: "bg-foreground-muted/10 text-foreground-muted border-foreground-muted/30",
  };

  return (
    <div className={`p-3 rounded-lg border text-center ${colors[level] || colors.MEDIUM}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-sm font-semibold mt-1">{level}</p>
    </div>
  );
}

function LoadingSpinner({ size = "default" }: { size?: "default" | "large" }) {
  const sizeClass = size === "large" ? "w-8 h-8" : "w-5 h-5";
  return (
    <svg className={`animate-spin ${sizeClass}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function AuditActionIcon({ action }: { action: string }) {
  if (action.includes("CREATED")) return <PlusIcon />;
  if (action.includes("RESOLVED")) return <CheckIcon />;
  if (action.includes("REOPENED")) return <RefreshIcon />;
  if (action.includes("ASSIGNED")) return <UserIcon />;
  return <EditIcon />;
}

function formatAuditAction(action: string): string {
  const map: Record<string, string> = {
    ISSUE_CREATED: "created this issue",
    ISSUE_STATUS_CHANGED: "changed the status",
    ISSUE_ASSIGNED: "assigned this issue",
    ISSUE_SEVERITY_CHANGED: "changed the severity",
    ISSUE_RESOLVED: "resolved this issue",
    ISSUE_REOPENED: "reopened this issue",
  };
  return map[action] || action.toLowerCase().replace(/_/g, " ");
}

function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// =============================================================================
// Icons
// =============================================================================

function ArrowLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg className="w-8 h-8 text-foreground-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function DroneIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
    </svg>
  );
}

function CoordinatesIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className="w-5 h-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg className="w-6 h-6 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  );
}
