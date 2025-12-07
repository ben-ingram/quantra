"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getProject, type Project } from "@/app/actions/projects";
import {
  History,
  User,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Edit2,
  Trash2,
  Eye,
  Download,
  Filter,
  Search,
  Loader2,
  ChevronDown,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

interface AuditEntry {
  id: string;
  action: "create" | "update" | "delete" | "upload" | "compliance_check" | "view";
  entity_type: "project" | "file" | "checklist" | "checklist_item";
  entity_id: string;
  entity_name: string;
  user_name: string;
  details: string | null;
  created_at: string;
}

type FilterAction = "all" | "create" | "update" | "delete" | "upload" | "compliance_check";

// =============================================================================
// Audit Log Page
// =============================================================================

export default function AuditLogPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<FilterAction>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const projectData = await getProject(projectId);
        setProject(projectData);
        // TODO: Load audit entries from Supabase
        // For now, show sample data to demonstrate the UI
        setEntries([
          {
            id: "1",
            action: "create",
            entity_type: "project",
            entity_id: projectId,
            entity_name: projectData?.name || "Project",
            user_name: "System",
            details: "Project created",
            created_at: projectData?.created_at || new Date().toISOString(),
          },
        ]);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [projectId]);

  const filteredEntries = entries.filter((entry) => {
    // Action filter
    if (actionFilter !== "all" && entry.action !== actionFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        entry.entity_name.toLowerCase().includes(query) ||
        entry.user_name.toLowerCase().includes(query) ||
        (entry.details && entry.details.toLowerCase().includes(query))
      );
    }

    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          <p className="text-foreground-muted mt-1">
            Activity history for {project?.name}
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 border border-border text-foreground-secondary hover:text-foreground hover:bg-surface-hover font-medium text-sm rounded-lg transition-colors">
          <Download className="w-4 h-4" />
          Export Log
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* Action Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-foreground-muted" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as FilterAction)}
            className="px-3 py-2 text-sm rounded-lg bg-surface border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          >
            <option value="all">All Actions</option>
            <option value="create">Created</option>
            <option value="update">Updated</option>
            <option value="delete">Deleted</option>
            <option value="upload">Uploaded</option>
            <option value="compliance_check">Compliance Checks</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          <input
            type="text"
            placeholder="Search audit log..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm rounded-lg bg-surface border border-border text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary w-64"
          />
        </div>
      </div>

      {/* Audit Log Timeline */}
      {filteredEntries.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="divide-y divide-border">
            {filteredEntries.map((entry, index) => (
              <AuditEntryRow
                key={entry.id}
                entry={entry}
                isFirst={index === 0}
                isLast={index === filteredEntries.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Components
// =============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-border rounded-xl">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <History className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        No activity yet
      </h3>
      <p className="text-foreground-muted text-center max-w-md">
        Activity will appear here as you and your team work on this project.
        All changes are logged for compliance tracking.
      </p>
    </div>
  );
}

function AuditEntryRow({
  entry,
  isFirst,
  isLast,
}: {
  entry: AuditEntry;
  isFirst: boolean;
  isLast: boolean;
}) {
  const config = getActionConfig(entry.action);
  const Icon = config.icon;

  const formattedDate = new Date(entry.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formattedTime = new Date(entry.created_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="flex gap-4 p-4 hover:bg-surface-hover transition-colors">
      {/* Timeline Indicator */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.bg}`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-border mt-2" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-foreground">
              <span className="font-medium">{entry.user_name}</span>
              {" "}
              <span className="text-foreground-muted">{config.verb}</span>
              {" "}
              <span className="font-medium">{entry.entity_name}</span>
            </p>
            {entry.details && (
              <p className="text-sm text-foreground-muted mt-0.5">
                {entry.details}
              </p>
            )}
          </div>
          <div className="text-right text-xs text-foreground-muted whitespace-nowrap">
            <p>{formattedDate}</p>
            <p>{formattedTime}</p>
          </div>
        </div>

        {/* Entity Type Badge */}
        <div className="mt-2">
          <span className="text-xs font-medium uppercase text-foreground-muted px-2 py-0.5 rounded bg-surface-hover">
            {entry.entity_type.replace("_", " ")}
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function getActionConfig(action: AuditEntry["action"]) {
  const configs = {
    create: {
      icon: CheckCircle2,
      color: "text-success",
      bg: "bg-success/10",
      verb: "created",
    },
    update: {
      icon: Edit2,
      color: "text-primary",
      bg: "bg-primary/10",
      verb: "updated",
    },
    delete: {
      icon: Trash2,
      color: "text-danger",
      bg: "bg-danger/10",
      verb: "deleted",
    },
    upload: {
      icon: Upload,
      color: "text-primary",
      bg: "bg-primary/10",
      verb: "uploaded",
    },
    compliance_check: {
      icon: AlertTriangle,
      color: "text-warning",
      bg: "bg-warning/10",
      verb: "ran compliance check on",
    },
    view: {
      icon: Eye,
      color: "text-foreground-muted",
      bg: "bg-surface-hover",
      verb: "viewed",
    },
  };

  return configs[action] || configs.view;
}
