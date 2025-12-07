"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getProject, type Project } from "@/app/actions/projects";
import {
  Plus,
  ClipboardCheck,
  CheckCircle2,
  Circle,
  XCircle,
  MoreVertical,
  Loader2,
  FileText,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

interface Checklist {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "active" | "completed" | "archived";
  itemCount: number;
  completedCount: number;
  created_at: string;
}

// =============================================================================
// Smart Checklists Page
// =============================================================================

export default function ChecklistsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const projectData = await getProject(projectId);
        setProject(projectData);
        // TODO: Load checklists from Supabase
        setChecklists([]);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [projectId]);

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
          <h1 className="text-2xl font-bold text-foreground">Smart Checklists</h1>
          <p className="text-foreground-muted mt-1">
            AI-powered compliance checklists for {project?.name}
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white font-medium text-sm rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          New Checklist
        </button>
      </div>

      {/* Checklists Grid or Empty State */}
      {checklists.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {checklists.map((checklist) => (
            <ChecklistCard key={checklist.id} checklist={checklist} />
          ))}
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
        <ClipboardCheck className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        No checklists yet
      </h3>
      <p className="text-foreground-muted text-center max-w-md mb-6">
        Create AI-powered compliance checklists based on Florida Building Code requirements.
        The SUPER RAG engine will help identify applicable code sections.
      </p>
      <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors">
        <Plus className="w-5 h-5" />
        Create Your First Checklist
      </button>
    </div>
  );
}

function ChecklistCard({ checklist }: { checklist: Checklist }) {
  const progress = checklist.itemCount > 0
    ? Math.round((checklist.completedCount / checklist.itemCount) * 100)
    : 0;

  const statusConfig = {
    draft: { color: "text-foreground-muted", bg: "bg-surface-hover", label: "Draft" },
    active: { color: "text-primary", bg: "bg-primary/10", label: "Active" },
    completed: { color: "text-success", bg: "bg-success/10", label: "Completed" },
    archived: { color: "text-foreground-muted", bg: "bg-surface-hover", label: "Archived" },
  };

  const status = statusConfig[checklist.status];

  return (
    <div className="rounded-xl border border-border bg-surface p-4 hover:border-primary/50 transition-colors cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
            {status.label}
          </span>
        </div>
        <button className="p-1 rounded hover:bg-surface-hover transition-colors">
          <MoreVertical className="w-4 h-4 text-foreground-muted" />
        </button>
      </div>

      <h3 className="font-semibold text-foreground mb-1">{checklist.title}</h3>
      {checklist.description && (
        <p className="text-sm text-foreground-muted line-clamp-2 mb-3">
          {checklist.description}
        </p>
      )}

      {/* Progress */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-foreground-muted">
            {checklist.completedCount} of {checklist.itemCount} items
          </span>
          <span className="font-medium text-foreground">{progress}%</span>
        </div>
        <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Compliance Summary */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border text-xs">
        <div className="flex items-center gap-1 text-success">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>12 Compliant</span>
        </div>
        <div className="flex items-center gap-1 text-danger">
          <XCircle className="w-3.5 h-3.5" />
          <span>2 Issues</span>
        </div>
        <div className="flex items-center gap-1 text-foreground-muted">
          <Circle className="w-3.5 h-3.5" />
          <span>5 Pending</span>
        </div>
      </div>
    </div>
  );
}
