import { notFound } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/app/components/layout";
import {
  StatCard,
  Viewer3D,
  ComplianceFeed,
  TrendChart,
  ComplianceAnalyzer,
} from "@/app/components/dashboard";
import type { ComplianceCheckItem } from "@/app/components/dashboard/ComplianceFeed";
import { getProjectDashboardData } from "@/app/lib/data";

// =============================================================================
// Helper Functions
// =============================================================================

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatLastScanTime(isoString: string | null): string {
  if (!isoString) return "No scans yet";
  const date = new Date(isoString);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

// =============================================================================
// Icons
// =============================================================================

const ShieldCheckIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const AlertIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const CameraIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
  </svg>
);

// =============================================================================
// Page Component
// =============================================================================

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  // Fetch real data from database
  const data = await getProjectDashboardData(projectId);

  // Handle project not found
  if (!data.project) {
    notFound();
  }

  const { project, stats, recentScans, recentIssues, recentComplianceChecks, regulatoryCodes } = data;

  // Transform compliance checks for the feed component
  const complianceFeedItems: ComplianceCheckItem[] = recentComplianceChecks.map((check) => {
    const findings = check.findings as {
      status?: string;
      citation?: string;
      riskScore?: number;
    } | null;

    return {
      id: check.id,
      timestamp: formatTimeAgo(check.createdAt),
      description: check.summary || "Compliance check completed",
      status: (findings?.status || check.status) as ComplianceCheckItem["status"],
      citation: findings?.citation,
      riskScore: findings?.riskScore || 5,
      area: "Project-wide",
    };
  });

  // Determine trend direction for critical defects
  const criticalTrend: "up" | "down" | "neutral" =
    stats.criticalChange > 0 ? "up" : stats.criticalChange < 0 ? "down" : "neutral";

  return (
    <DashboardShell
      title={project.name}
      description={`${project.address || "No address"} • ${project.status}`}
      actions={
        <div className="flex items-center gap-3">
          {/* Project Status Badge */}
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/30">
            <span className="status-dot status-dot-success" />
            <span className="text-sm font-medium text-success">{project.status}</span>
          </span>

          {/* Action Buttons */}
          <Link
            href={`/projects/${projectId}/audit`}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            Audit Archive
          </Link>
          <ComplianceAnalyzer projectId={projectId} jurisdiction="Florida" />
        </div>
      }
    >
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Compliance Score"
          value={stats.complianceScore > 0 ? `${stats.complianceScore}%` : "N/A"}
          subtitle={`across ${stats.totalChecks} checks`}
          icon={<ShieldCheckIcon />}
          trend={
            stats.totalChecks > 0
              ? { value: "+2.1%", direction: "up" }
              : undefined
          }
          variant={stats.complianceScore >= 90 ? "success" : stats.complianceScore >= 70 ? "warning" : "danger"}
          size="large"
        />
        <StatCard
          title="Open Critical Defects"
          value={stats.openCriticalDefects.toString()}
          subtitle={stats.openCriticalDefects > 0 ? "requires immediate action" : "all clear"}
          icon={<AlertIcon />}
          trend={
            stats.criticalChange !== 0
              ? {
                  value: `${stats.criticalChange > 0 ? "+" : ""}${stats.criticalChange}`,
                  direction: criticalTrend,
                }
              : undefined
          }
          variant={stats.openCriticalDefects > 0 ? "danger" : "success"}
          size="large"
        />
        <StatCard
          title="Scans Tonight"
          value={stats.scansTonight.toString()}
          subtitle={stats.lastScanTime ? `last scan ${formatLastScanTime(stats.lastScanTime)}` : "no scans yet"}
          icon={<CameraIcon />}
          trend={{ value: stats.scansTonight > 0 ? "On schedule" : "Pending", direction: "neutral" }}
          variant="primary"
          size="large"
        />
      </div>

      {/* Main Content Grid - 60/40 split */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-6">
        {/* 3D Viewer - Takes 60% (3 of 5 columns) */}
        <div className="xl:col-span-3 h-[500px]">
          <Viewer3D
            projectName={project.name}
            scanDate={stats.lastScanTime ? formatTimeAgo(new Date(stats.lastScanTime)) : undefined}
          />
        </div>

        {/* Compliance Feed - Takes 40% (2 of 5 columns) */}
        <div className="xl:col-span-2 h-[500px]">
          <ComplianceFeed items={complianceFeedItems} maxItems={10} />
        </div>
      </div>

      {/* Bottom Section - Trend Chart and Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart - Takes 2/3 */}
        <div className="lg:col-span-2">
          <TrendChart title="Defects Over Time" />
        </div>

        {/* Quick Info Panel */}
        <div className="space-y-4">
          {/* Project Info Card */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Project Details</h3>
            <div className="space-y-3">
              <InfoRow label="Project ID" value={projectId} mono />
              <InfoRow label="BIM Version" value={project.bimModelVersion || "Not set"} />
              <InfoRow label="Status" value={project.status} />
              <InfoRow
                label="Issues"
                value={`${recentIssues.filter((i) => i.status !== "RESOLVED").length} open`}
              />
            </div>
          </div>

          {/* Active Codes Card */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Active Regulatory Codes</h3>
            <div className="space-y-2">
              {regulatoryCodes.length > 0 ? (
                regulatoryCodes.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-hover/50 hover:bg-surface-hover transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.shortName}</p>
                      <p className="text-xs text-foreground-muted">{item.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          item.complianceScore >= 95
                            ? "text-success"
                            : item.complianceScore >= 90
                            ? "text-warning"
                            : "text-danger"
                        }`}
                      >
                        {item.checksCount > 0 ? `${item.complianceScore}%` : "N/A"}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-foreground-muted text-center py-4">
                  No regulatory codes assigned
                </p>
              )}
            </div>
          </div>

          {/* Recent Issues Card */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Recent Issues</h3>
            <div className="space-y-2">
              {recentIssues.slice(0, 4).map((issue) => (
                <Link
                  key={issue.id}
                  href={`/projects/${projectId}/issues/${issue.id}`}
                  className="flex items-start gap-3 py-2 px-3 rounded-lg bg-surface-hover/50 hover:bg-surface-hover transition-colors cursor-pointer block"
                >
                  <SeverityDot severity={issue.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{issue.title}</p>
                    <p className="text-xs text-foreground-muted">
                      {issue.codeReference || issue.location || "No location"}
                    </p>
                  </div>
                  <StatusBadge status={issue.status} />
                </Link>
              ))}
              {recentIssues.length === 0 && (
                <p className="text-sm text-foreground-muted text-center py-4">No issues found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-foreground-muted">{label}</span>
      <span className={`text-sm text-foreground ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    CRITICAL: "bg-danger",
    HIGH: "bg-accent",
    MEDIUM: "bg-warning",
    LOW: "bg-success",
  };

  return (
    <div className={`w-2 h-2 rounded-full mt-1.5 ${colors[severity] || colors.MEDIUM}`} />
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    OPEN: { bg: "bg-danger/10", text: "text-danger" },
    IN_PROGRESS: { bg: "bg-warning/10", text: "text-warning" },
    RESOLVED: { bg: "bg-success/10", text: "text-success" },
    IGNORED: { bg: "bg-foreground-muted/10", text: "text-foreground-muted" },
    REOPENED: { bg: "bg-accent/10", text: "text-accent" },
  };

  const { bg, text } = config[status] || config.OPEN;

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}>
      {status.replace("_", " ")}
    </span>
  );
}
