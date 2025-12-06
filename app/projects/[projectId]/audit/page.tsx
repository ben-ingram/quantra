import { notFound } from "next/navigation";
import Link from "next/link";
import { getAuditArchiveData } from "@/app/lib/data";
import type { AuditLogEntry } from "@/app/lib/data";
import { ExportButton } from "./ExportButton";

// =============================================================================
// Page Component
// =============================================================================

export default async function ComplianceArchivePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const data = await getAuditArchiveData(projectId);

  if (!data.project) {
    notFound();
  }

  const { project, auditLogs, stats } = data;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header - Formal/Legal Style */}
      <header className="bg-white border-b border-gray-200 print:border-gray-400">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link
                  href={`/projects/${projectId}`}
                  className="text-gray-500 hover:text-gray-700 transition-colors print:hidden"
                >
                  <ArrowLeftIcon />
                </Link>
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
                  Compliance Audit Archive
                </h1>
              </div>
              <p className="text-sm text-gray-600 ml-9">
                Immutable record of all compliance activities for {project.name}
              </p>
            </div>
            <ExportButton projectName={project.name} />
          </div>
        </div>
      </header>

      {/* Document Header */}
      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="bg-white border border-gray-200 rounded-none shadow-sm print:shadow-none print:border-gray-400">
          {/* Official Header */}
          <div className="px-8 py-6 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-1">
                  Project Compliance Record
                </p>
                <h2 className="text-xl font-semibold text-gray-900">{project.name}</h2>
                <p className="text-sm text-gray-600 mt-1">{project.address || "No address on file"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-1">
                  Document ID
                </p>
                <p className="font-mono text-sm text-gray-900">{projectId.slice(0, 16).toUpperCase()}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Generated: {formatDate(new Date())}
                </p>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="px-8 py-4 border-b border-gray-200 bg-white">
            <div className="grid grid-cols-5 gap-6">
              <StatItem label="Total Entries" value={stats.totalEntries.toString()} />
              <StatItem label="Compliance Checks" value={stats.complianceChecks.toString()} />
              <StatItem label="Issues Created" value={stats.issuesCreated.toString()} />
              <StatItem label="Issues Resolved" value={stats.issuesResolved.toString()} />
              <StatItem
                label="Chain Integrity"
                value={stats.chainIntegrity ? "VERIFIED" : "BROKEN"}
                status={stats.chainIntegrity ? "success" : "error"}
              />
            </div>
          </div>

          {/* Integrity Notice */}
          <div className="px-8 py-3 border-b border-gray-200 bg-emerald-50">
            <div className="flex items-center gap-3">
              <ShieldCheckIcon />
              <div>
                <p className="text-sm font-medium text-emerald-900">
                  Cryptographic Integrity Verified
                </p>
                <p className="text-xs text-emerald-700">
                  All entries secured with SHA-256 hash chain. Last verification:{" "}
                  <span className="font-mono">{formatTimestamp(stats.lastVerified)}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Timeline Header */}
          <div className="px-8 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Audit Trail Timeline
              </h3>
              <p className="text-xs text-gray-500">
                Showing {auditLogs.length} entries in reverse chronological order
              </p>
            </div>
          </div>

          {/* Timeline Content */}
          <div className="divide-y divide-gray-100">
            {auditLogs.length === 0 ? (
              <div className="px-8 py-16 text-center">
                <p className="text-gray-500">No audit entries found for this project.</p>
              </div>
            ) : (
              auditLogs.map((log, index) => (
                <AuditLogRow
                  key={log.id}
                  log={log}
                  isFirst={index === 0}
                  isLast={index === auditLogs.length - 1}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div>
                <p className="font-medium text-gray-700">QUANTRA Compliance Platform</p>
                <p>This document is an official record of compliance activities.</p>
              </div>
              <div className="text-right">
                <p>Page 1 of 1</p>
                <p className="font-mono">{formatTimestamp(new Date())}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Legal Notice */}
        <div className="mt-6 px-8 py-4 bg-white border border-gray-200 rounded-none">
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="font-semibold">Legal Notice:</span> This audit trail is generated automatically
            by the QUANTRA compliance management system. Each entry is cryptographically signed using SHA-256
            hashing and linked to the previous entry to form a tamper-evident chain. Any modification to
            historical entries will invalidate the chain integrity. This document may be used as evidence of
            compliance activities for regulatory, insurance, or legal purposes.
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Audit Log Row Component
// =============================================================================

function AuditLogRow({
  log,
  isFirst,
  isLast,
}: {
  log: AuditLogEntry;
  isFirst: boolean;
  isLast: boolean;
}) {
  const actionConfig = getActionConfig(log.action);

  return (
    <div className="px-8 py-5 hover:bg-gray-50 transition-colors">
      <div className="flex gap-6">
        {/* Timeline Indicator */}
        <div className="flex flex-col items-center">
          <div
            className={`w-3 h-3 rounded-full border-2 ${actionConfig.dotColor} ${actionConfig.dotBorder} bg-white`}
          />
          {!isLast && <div className="w-px flex-1 bg-gray-200 mt-2" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 -mt-1">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {/* Action Badge */}
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${actionConfig.badgeColor}`}
                >
                  {actionConfig.icon}
                  <span className="ml-1">{actionConfig.label}</span>
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">{log.entity.replace("_", " ")}</span>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-900 mb-1">{getLogDescription(log)}</p>

              {/* User & Reason */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>
                  By:{" "}
                  <span className="font-medium text-gray-700">
                    {log.user?.name || "System"}
                  </span>
                  {log.user?.role && (
                    <span className="text-gray-400 ml-1">({log.user.role.replace("_", " ")})</span>
                  )}
                </span>
                {log.ipAddress && (
                  <span className="font-mono text-gray-400">IP: {log.ipAddress}</span>
                )}
              </div>

              {/* Reason if exists */}
              {log.reason && (
                <div className="mt-2 px-3 py-2 bg-gray-50 border-l-2 border-gray-300 text-xs text-gray-600">
                  <span className="font-medium">Reason:</span> {log.reason}
                </div>
              )}
            </div>

            {/* Timestamp & Hash */}
            <div className="flex-shrink-0 text-right">
              <p className="font-mono text-xs text-gray-900">{formatTimestamp(log.createdAt)}</p>
              {log.checksum && (
                <div className="mt-1">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Hash</p>
                  <p className="font-mono text-xs text-gray-600">{log.checksum.slice(0, 8)}</p>
                </div>
              )}
              {log.previousHash && (
                <div className="mt-1">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Prev</p>
                  <p className="font-mono text-xs text-gray-400">{log.previousHash.slice(0, 8)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Changes Summary */}
          {log.changes && Object.keys(log.changes).length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-1 pr-4 font-medium text-gray-500 uppercase tracking-wider">
                      Field
                    </th>
                    <th className="text-left py-1 pr-4 font-medium text-gray-500 uppercase tracking-wider">
                      Previous Value
                    </th>
                    <th className="text-left py-1 font-medium text-gray-500 uppercase tracking-wider">
                      New Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(log.changes).map(([field, change]) => (
                    <tr key={field} className="border-b border-gray-100">
                      <td className="py-1.5 pr-4 font-mono text-gray-700">{field}</td>
                      <td className="py-1.5 pr-4 font-mono text-red-600">
                        {formatValue(change.from)}
                      </td>
                      <td className="py-1.5 font-mono text-emerald-600">
                        {formatValue(change.to)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function StatItem({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: "success" | "error";
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p
        className={`text-lg font-semibold font-mono ${
          status === "success"
            ? "text-emerald-600"
            : status === "error"
            ? "text-red-600"
            : "text-gray-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTimestamp(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  return JSON.stringify(value);
}

function getLogDescription(log: AuditLogEntry): string {
  if (log.issue) {
    return `Issue: "${log.issue.title}" (${log.issue.severity})`;
  }
  if (log.complianceCheck) {
    const score = log.complianceCheck.overallScore;
    return `Compliance check for ${log.complianceCheck.regulatoryCode.shortName}${
      score !== null ? ` - Score: ${score}%` : ""
    }`;
  }
  return `${log.entity} ${log.entityId}`;
}

interface ActionConfig {
  label: string;
  icon: React.ReactNode;
  badgeColor: string;
  dotColor: string;
  dotBorder: string;
}

function getActionConfig(action: string): ActionConfig {
  const configs: Record<string, ActionConfig> = {
    COMPLIANCE_CHECK_STARTED: {
      label: "Check Started",
      icon: <PlayIcon />,
      badgeColor: "bg-blue-50 text-blue-700",
      dotColor: "bg-blue-100",
      dotBorder: "border-blue-400",
    },
    COMPLIANCE_CHECK_COMPLETED: {
      label: "Check Completed",
      icon: <CheckIcon />,
      badgeColor: "bg-emerald-50 text-emerald-700",
      dotColor: "bg-emerald-100",
      dotBorder: "border-emerald-400",
    },
    COMPLIANCE_CHECK_FAILED: {
      label: "Check Failed",
      icon: <XIcon />,
      badgeColor: "bg-red-50 text-red-700",
      dotColor: "bg-red-100",
      dotBorder: "border-red-400",
    },
    ISSUE_CREATED: {
      label: "Issue Created",
      icon: <AlertIcon />,
      badgeColor: "bg-amber-50 text-amber-700",
      dotColor: "bg-amber-100",
      dotBorder: "border-amber-400",
    },
    ISSUE_ASSIGNED: {
      label: "Issue Assigned",
      icon: <UserIcon />,
      badgeColor: "bg-purple-50 text-purple-700",
      dotColor: "bg-purple-100",
      dotBorder: "border-purple-400",
    },
    ISSUE_STATUS_CHANGED: {
      label: "Status Changed",
      icon: <EditIcon />,
      badgeColor: "bg-gray-100 text-gray-700",
      dotColor: "bg-gray-100",
      dotBorder: "border-gray-400",
    },
    ISSUE_RESOLVED: {
      label: "Issue Resolved",
      icon: <CheckCircleIcon />,
      badgeColor: "bg-emerald-50 text-emerald-700",
      dotColor: "bg-emerald-100",
      dotBorder: "border-emerald-400",
    },
    ISSUE_REOPENED: {
      label: "Issue Reopened",
      icon: <RefreshIcon />,
      badgeColor: "bg-orange-50 text-orange-700",
      dotColor: "bg-orange-100",
      dotBorder: "border-orange-400",
    },
  };

  return (
    configs[action] || {
      label: action.replace(/_/g, " "),
      icon: <DocIcon />,
      badgeColor: "bg-gray-100 text-gray-700",
      dotColor: "bg-gray-100",
      dotBorder: "border-gray-400",
    }
  );
}

// =============================================================================
// Icons
// =============================================================================

function ArrowLeftIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
