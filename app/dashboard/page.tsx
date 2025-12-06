import { DashboardShell } from "@/app/components/layout";

// Sample stat card component
function StatCard({
  title,
  value,
  change,
  changeType,
  icon,
}: {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
}) {
  const changeColors = {
    positive: "text-success",
    negative: "text-danger",
    neutral: "text-foreground-muted",
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-foreground-secondary">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
          <p className={`mt-1 text-sm ${changeColors[changeType]}`}>{change}</p>
        </div>
        <div className="p-3 rounded-lg bg-primary-subtle text-primary">
          {icon}
        </div>
      </div>
    </div>
  );
}

// Sample severity badge
function SeverityBadge({ severity }: { severity: "critical" | "high" | "medium" | "low" }) {
  const badgeClasses = {
    critical: "badge-critical",
    high: "badge-high",
    medium: "badge-medium",
    low: "badge-low",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClasses[severity]}`}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}

export default function DashboardPage() {
  return (
    <DashboardShell
      title="Dashboard"
      description="Overview of your construction QA operations"
      actions={
        <button className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors">
          New Scan
        </button>
      }
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Active Projects"
          value="12"
          change="+2 this month"
          changeType="positive"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
          }
        />
        <StatCard
          title="Open Issues"
          value="47"
          change="-8 from last week"
          changeType="positive"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          }
        />
        <StatCard
          title="Compliance Score"
          value="94.2%"
          change="+1.3% improvement"
          changeType="positive"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          }
        />
        <StatCard
          title="Scans This Week"
          value="28"
          change="On track"
          changeType="neutral"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            </svg>
          }
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Issues */}
        <div className="lg:col-span-2 card p-0">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Critical Issues</h2>
            <p className="text-sm text-foreground-muted">Issues requiring immediate attention</p>
          </div>
          <div className="divide-y divide-border">
            {[
              { id: "ISS-001", title: "Fire exit clearance violation - Building A", severity: "critical" as const, project: "Downtown Tower", time: "2h ago" },
              { id: "ISS-002", title: "Structural beam misalignment detected", severity: "high" as const, project: "Metro Plaza", time: "4h ago" },
              { id: "ISS-003", title: "Electrical conduit spacing non-compliant", severity: "high" as const, project: "Downtown Tower", time: "6h ago" },
              { id: "ISS-004", title: "Ventilation duct obstruction", severity: "medium" as const, project: "Harbor View", time: "8h ago" },
              { id: "ISS-005", title: "Minor concrete surface defect", severity: "low" as const, project: "Metro Plaza", time: "12h ago" },
            ].map((issue) => (
              <div key={issue.id} className="p-4 hover:bg-surface-hover transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono text-foreground-muted">{issue.id}</span>
                      <SeverityBadge severity={issue.severity} />
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{issue.title}</p>
                    <p className="text-xs text-foreground-muted mt-1">{issue.project}</p>
                  </div>
                  <span className="text-xs text-foreground-muted whitespace-nowrap">{issue.time}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-border">
            <button className="text-sm text-primary hover:text-primary-hover font-medium transition-colors">
              View all issues →
            </button>
          </div>
        </div>

        {/* Recent Scans */}
        <div className="card p-0">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Recent Scans</h2>
            <p className="text-sm text-foreground-muted">Latest drone capture activity</p>
          </div>
          <div className="divide-y divide-border">
            {[
              { name: "Downtown Tower - Floor 12", status: "completed", score: 96, time: "1h ago" },
              { name: "Metro Plaza - Exterior", status: "processing", score: null, time: "2h ago" },
              { name: "Harbor View - Foundation", status: "completed", score: 89, time: "5h ago" },
              { name: "Downtown Tower - Floor 11", status: "completed", score: 94, time: "8h ago" },
            ].map((scan, i) => (
              <div key={i} className="p-4 hover:bg-surface-hover transition-colors cursor-pointer">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{scan.name}</p>
                    <p className="text-xs text-foreground-muted mt-1">{scan.time}</p>
                  </div>
                  {scan.status === "completed" ? (
                    <div className="flex items-center gap-2">
                      <div className="status-dot status-dot-success" />
                      <span className="text-sm font-medium text-success">{scan.score}%</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="status-dot status-dot-info animate-pulse-status" />
                      <span className="text-sm text-info">Processing</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-border">
            <button className="text-sm text-primary hover:text-primary-hover font-medium transition-colors">
              View all scans →
            </button>
          </div>
        </div>
      </div>

      {/* Compliance Overview */}
      <div className="mt-6 card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Compliance by Code</h2>
            <p className="text-sm text-foreground-muted">Regulatory compliance status across active projects</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { code: "IBC 2024", compliance: 96, checks: 124 },
            { code: "Florida Building Code", compliance: 94, checks: 89 },
            { code: "NFPA 101", compliance: 98, checks: 56 },
            { code: "ADA Standards", compliance: 91, checks: 78 },
          ].map((item) => (
            <div key={item.code} className="p-4 bg-surface-hover rounded-lg border border-border">
              <p className="text-sm font-medium text-foreground">{item.code}</p>
              <div className="mt-3 flex items-end justify-between">
                <span className="text-2xl font-bold text-foreground">{item.compliance}%</span>
                <span className="text-xs text-foreground-muted">{item.checks} checks</span>
              </div>
              <div className="mt-2 h-1.5 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-success rounded-full transition-all duration-500"
                  style={{ width: `${item.compliance}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
