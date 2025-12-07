"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Download,
  Filter,
  Search,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  User,
  Eye,
  Shield,
  BarChart3,
} from "lucide-react";
import { getServiceClient } from "@/app/lib/supabase";

interface AuditPhaseProps {
  projectId: string;
}

interface ComplianceLogEntry {
  id: string;
  checklist_item_id: string;
  checklist_id: string;
  action: string;
  previous_status: boolean | null;
  new_status: boolean | null;
  notes: string | null;
  photo_evidence_url: string | null;
  inspector_name: string | null;
  checksum: string;
  previous_hash: string | null;
  created_at: string;
  // Joined fields
  requirement_text?: string;
  code_reference?: string;
  checklist_title?: string;
}

interface AuditStats {
  totalEntries: number;
  passCount: number;
  failCount: number;
  flagCount: number;
  todayCount: number;
  weekCount: number;
}

export function AuditPhase({ projectId }: AuditPhaseProps) {
  const [logs, setLogs] = useState<ComplianceLogEntry[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    totalEntries: 0,
    passCount: 0,
    failCount: 0,
    flagCount: 0,
    todayCount: 0,
    weekCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 20;

  // Load compliance logs
  useEffect(() => {
    async function loadLogs() {
      setIsLoading(true);
      setError(null);

      try {
        const supabase = getServiceClient();

        // Build query
        let query = supabase
          .from("checklist_item_compliance_log")
          .select(`
            *,
            checklist_items!inner(requirement_text, code_reference),
            checklists!inner(title)
          `, { count: "exact" })
          .eq("project_id", projectId)
          .order("created_at", { ascending: sortOrder === "asc" });

        // Apply action filter
        if (filterAction !== "all") {
          query = query.eq("action", filterAction);
        }

        // Apply date range filter
        if (filterDateRange !== "all") {
          const now = new Date();
          let startDate: Date;

          switch (filterDateRange) {
            case "today":
              startDate = new Date(now.setHours(0, 0, 0, 0));
              break;
            case "week":
              startDate = new Date(now.setDate(now.getDate() - 7));
              break;
            case "month":
              startDate = new Date(now.setMonth(now.getMonth() - 1));
              break;
            default:
              startDate = new Date(0);
          }

          query = query.gte("created_at", startDate.toISOString());
        }

        // Apply pagination
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        query = query.range(from, to);

        const { data, error: queryError, count } = await query;

        if (queryError) {
          // Table might not exist yet
          if (queryError.code === "42P01") {
            setLogs([]);
            setTotalPages(1);
            return;
          }
          throw queryError;
        }

        // Transform data
        const transformedLogs: ComplianceLogEntry[] = (data || []).map((log) => ({
          ...log,
          requirement_text: log.checklist_items?.requirement_text,
          code_reference: log.checklist_items?.code_reference,
          checklist_title: log.checklists?.title,
        }));

        setLogs(transformedLogs);
        setTotalPages(Math.ceil((count || 0) / PAGE_SIZE));

        // Calculate stats (separate query for all-time stats)
        await loadStats();
      } catch (err) {
        console.error("Error loading compliance logs:", err);
        setError("Failed to load compliance audit log");
      } finally {
        setIsLoading(false);
      }
    }

    loadLogs();
  }, [projectId, filterAction, filterDateRange, sortOrder, page]);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const supabase = getServiceClient();

      const { data, error: statsError } = await supabase
        .from("checklist_item_compliance_log")
        .select("action, created_at")
        .eq("project_id", projectId);

      if (statsError) return;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      setStats({
        totalEntries: data?.length || 0,
        passCount: data?.filter((l) => l.action === "MARKED_PASS").length || 0,
        failCount: data?.filter((l) => l.action === "MARKED_FAIL").length || 0,
        flagCount: data?.filter((l) => l.action === "MARKED_FLAG").length || 0,
        todayCount: data?.filter((l) => new Date(l.created_at) >= todayStart).length || 0,
        weekCount: data?.filter((l) => new Date(l.created_at) >= weekStart).length || 0,
      });
    } catch (err) {
      console.error("Error loading stats:", err);
    }
  }, [projectId]);

  // Filter logs by search query
  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.requirement_text?.toLowerCase().includes(query) ||
      log.code_reference?.toLowerCase().includes(query) ||
      log.inspector_name?.toLowerCase().includes(query) ||
      log.notes?.toLowerCase().includes(query)
    );
  });

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Get action display info
  const getActionInfo = (action: string) => {
    switch (action) {
      case "MARKED_PASS":
        return { icon: <CheckCircle2 className="w-4 h-4" />, color: "text-emerald-400", label: "Passed" };
      case "MARKED_FAIL":
        return { icon: <XCircle className="w-4 h-4" />, color: "text-red-400", label: "Failed" };
      case "MARKED_FLAG":
        return { icon: <AlertTriangle className="w-4 h-4" />, color: "text-amber-400", label: "Flagged" };
      case "MARKED_NA":
        return { icon: <Clock className="w-4 h-4" />, color: "text-slate-400", label: "N/A" };
      case "CLEARED":
        return { icon: <Clock className="w-4 h-4" />, color: "text-slate-400", label: "Cleared" };
      default:
        return { icon: <Clock className="w-4 h-4" />, color: "text-slate-400", label: action };
    }
  };

  if (isLoading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border bg-surface-hover/30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Compliance Audit Log
            </h2>
            <p className="text-foreground-muted mt-1">
              Tamper-evident record of all inspection decisions
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-6 gap-4">
          <StatCard
            icon={<FileText className="w-5 h-5" />}
            label="Total Records"
            value={stats.totalEntries}
            color="slate"
          />
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="Passed"
            value={stats.passCount}
            color="emerald"
          />
          <StatCard
            icon={<XCircle className="w-5 h-5" />}
            label="Failed"
            value={stats.failCount}
            color="red"
          />
          <StatCard
            icon={<AlertTriangle className="w-5 h-5" />}
            label="Flagged"
            value={stats.flagCount}
            color="amber"
          />
          <StatCard
            icon={<Calendar className="w-5 h-5" />}
            label="Today"
            value={stats.todayCount}
            color="cyan"
          />
          <StatCard
            icon={<BarChart3 className="w-5 h-5" />}
            label="This Week"
            value={stats.weekCount}
            color="purple"
          />
        </div>
      </div>

      {/* Filters Bar */}
      <div className="px-6 py-3 border-b border-border bg-surface flex items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search requirements, inspectors, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-foreground placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Action Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Actions</option>
            <option value="MARKED_PASS">Passed</option>
            <option value="MARKED_FAIL">Failed</option>
            <option value="MARKED_FLAG">Flagged</option>
            <option value="CLEARED">Cleared</option>
          </select>
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={filterDateRange}
            onChange={(e) => setFilterDateRange(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Past 7 Days</option>
            <option value="month">Past 30 Days</option>
          </select>
        </div>

        {/* Sort Toggle */}
        <button
          onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-foreground hover:bg-slate-700 transition-colors"
        >
          <ArrowUpDown className="w-4 h-4" />
          {sortOrder === "desc" ? "Newest First" : "Oldest First"}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="m-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Empty State */}
      {filteredLogs.length === 0 && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <Shield className="w-16 h-16 text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No Audit Records Yet
          </h3>
          <p className="text-sm text-foreground-muted max-w-md">
            Compliance audit entries will appear here when inspectors mark items
            as passed, failed, or flagged during inspections.
          </p>
        </div>
      )}

      {/* Log Table */}
      {filteredLogs.length > 0 && (
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50 sticky top-0">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Action
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Requirement
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Inspector
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Notes
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Integrity
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLogs.map((log) => {
                const actionInfo = getActionInfo(log.action);
                return (
                  <tr key={log.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-400 whitespace-nowrap">
                      {formatTimestamp(log.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`flex items-center gap-2 ${actionInfo.color}`}>
                        {actionInfo.icon}
                        <span className="text-sm font-medium">{actionInfo.label}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-md">
                        <p className="text-sm text-foreground line-clamp-2">
                          {log.requirement_text || "—"}
                        </p>
                        {log.code_reference && (
                          <p className="text-xs text-primary font-mono mt-1">
                            {log.code_reference}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-foreground">
                          {log.inspector_name || "Unknown"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-foreground-muted max-w-xs truncate">
                        {log.notes || "—"}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500 truncate max-w-[80px]">
                          {log.checksum?.slice(0, 8)}...
                        </span>
                        <button
                          title="Verify integrity"
                          className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-border bg-surface flex items-center justify-between">
          <p className="text-sm text-foreground-muted">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "slate" | "emerald" | "red" | "amber" | "cyan" | "purple";
}) {
  const colors = {
    slate: "bg-slate-500/10 text-slate-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    red: "bg-red-500/10 text-red-400",
    amber: "bg-amber-500/10 text-amber-400",
    cyan: "bg-cyan-500/10 text-cyan-400",
    purple: "bg-purple-500/10 text-purple-400",
  };

  return (
    <div className={`p-4 rounded-xl ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider opacity-75">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}
