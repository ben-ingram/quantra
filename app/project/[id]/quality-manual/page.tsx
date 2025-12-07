"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Table2,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Sparkles,
  Save,
  Lock,
  Unlock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Edit3,
  Flag,
  ClipboardCheck,
  Building2,
  RefreshCw,
} from "lucide-react";
import { getProject, type Project } from "@/app/actions/projects";
import {
  getOrCreateQualityManual,
  updateQualityManualContent,
  generateITPs,
  updateITP,
  deleteITP,
  approveQualityManual,
  revertManualToDraft,
  type QualityManualWithITPs,
  type InspectionTestPlan,
} from "@/app/actions/quality-manual";

// =============================================================================
// Types
// =============================================================================

type ViewMode = "document" | "itp-grid";

// =============================================================================
// ITP Editor Grid Component
// =============================================================================

interface ITPEditorGridProps {
  itps: InspectionTestPlan[];
  isLocked: boolean;
  onUpdate: (itpId: string, updates: Partial<InspectionTestPlan>) => Promise<void>;
  onDelete: (itpId: string) => Promise<void>;
}

function ITPEditorGrid({ itps, isLocked, onUpdate, onDelete }: ITPEditorGridProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ itpId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // Group ITPs by construction phase
  const itpsByPhase = itps.reduce((acc, itp) => {
    const phase = itp.construction_phase;
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(itp);
    return acc;
  }, {} as Record<string, InspectionTestPlan[]>);

  const phases = Object.keys(itpsByPhase).sort();

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

  // Expand all phases by default
  useEffect(() => {
    setExpandedPhases(new Set(phases));
  }, [phases.join(",")]);

  // Handle cell edit
  const startEdit = (itpId: string, field: string, currentValue: string) => {
    if (isLocked) return;
    setEditingCell({ itpId, field });
    setEditValue(currentValue);
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    await onUpdate(editingCell.itpId, { [editingCell.field]: editValue });
    setEditingCell(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  // Handle hold point toggle
  const toggleHoldPoint = async (itp: InspectionTestPlan) => {
    if (isLocked) return;
    await onUpdate(itp.id, { is_hold_point: !itp.is_hold_point });
  };

  // Render editable cell
  const EditableCell = ({
    itp,
    field,
    value,
    className = "",
  }: {
    itp: InspectionTestPlan;
    field: string;
    value: string;
    className?: string;
  }) => {
    const isEditing = editingCell?.itpId === itp.id && editingCell?.field === field;

    if (isEditing) {
      return (
        <td className={`px-3 py-2 ${className}`}>
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-zinc-800 border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </td>
      );
    }

    return (
      <td
        className={`px-3 py-2 ${className} ${
          !isLocked ? "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700" : ""
        }`}
        onClick={() => startEdit(itp.id, field, value)}
      >
        <span className="text-sm">{value || "-"}</span>
      </td>
    );
  };

  // Frequency options for dropdown
  const frequencyOptions = [
    "Each Occurrence",
    "Daily",
    "Weekly",
    "Per Floor",
    "Per Section",
    "Monthly",
    "As Required",
  ];

  return (
    <div className="space-y-4">
      {phases.map((phase) => {
        const phaseItps = itpsByPhase[phase];
        const isExpanded = expandedPhases.has(phase);
        const holdPointCount = phaseItps.filter((i) => i.is_hold_point).length;

        return (
          <div
            key={phase}
            className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
          >
            {/* Phase Header */}
            <button
              onClick={() => togglePhase(phase)}
              className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-zinc-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-zinc-500" />
                )}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{phase}</span>
                <span className="text-sm text-zinc-500">({phaseItps.length} items)</span>
              </div>
              {holdPointCount > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded text-red-700 dark:text-red-400 text-xs font-medium">
                  <Flag className="h-3 w-3" />
                  {holdPointCount} Hold Point{holdPointCount > 1 ? "s" : ""}
                </div>
              )}
            </button>

            {/* Phase Content */}
            {isExpanded && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                    <tr>
                      <th className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider w-[300px]">
                        Activity
                      </th>
                      <th className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider w-[120px]">
                        Responsibility
                      </th>
                      <th className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider w-[120px]">
                        Frequency
                      </th>
                      <th className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider w-[80px] text-center">
                        Hold Point
                      </th>
                      <th className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider w-[150px]">
                        Code Reference
                      </th>
                      {!isLocked && (
                        <th className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider w-[60px] text-center">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                    {phaseItps.map((itp) => (
                      <tr
                        key={itp.id}
                        className={`${
                          itp.is_hold_point
                            ? "bg-red-50 dark:bg-red-900/10"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        }`}
                      >
                        <EditableCell
                          itp={itp}
                          field="activity"
                          value={itp.activity}
                          className="font-medium"
                        />
                        <EditableCell itp={itp} field="responsibility" value={itp.responsibility} />
                        {/* Frequency with dropdown */}
                        <td className="px-3 py-2">
                          {!isLocked ? (
                            <select
                              value={itp.frequency}
                              onChange={(e) =>
                                onUpdate(itp.id, { frequency: e.target.value })
                              }
                              className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {frequencyOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-sm">{itp.frequency}</span>
                          )}
                        </td>
                        {/* Hold Point Checkbox */}
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => toggleHoldPoint(itp)}
                            disabled={isLocked}
                            className={`p-1 rounded ${
                              itp.is_hold_point
                                ? "text-red-600 bg-red-100 dark:bg-red-900/30"
                                : "text-zinc-400 hover:text-zinc-600"
                            } ${isLocked ? "cursor-not-allowed opacity-50" : ""}`}
                          >
                            <Flag
                              className={`h-4 w-4 ${itp.is_hold_point ? "fill-current" : ""}`}
                            />
                          </button>
                        </td>
                        <EditableCell
                          itp={itp}
                          field="code_reference"
                          value={itp.code_reference || ""}
                        />
                        {!isLocked && (
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => onDelete(itp.id)}
                              className="p-1 text-zinc-400 hover:text-red-600 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {phases.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <Table2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No Inspection Test Plans yet.</p>
          <p className="text-sm">Generate ITPs to get started.</p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Document View Component
// =============================================================================

interface DocumentViewProps {
  manual: QualityManualWithITPs;
  project: Project;
}

function DocumentView({ manual, project }: DocumentViewProps) {
  const sections = manual.content?.sections || [];

  // Count stats
  const totalItps = manual.inspection_test_plans.length;
  const holdPoints = manual.inspection_test_plans.filter((i) => i.is_hold_point).length;
  const phases = [...new Set(manual.inspection_test_plans.map((i) => i.construction_phase))];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Document Header */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-8 mb-6">
        {/* Header with Logo Area */}
        <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-700 pb-6 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {manual.title}
            </h1>
            <p className="text-zinc-500 mt-1">Version {manual.version}</p>
          </div>
          <div className="text-right">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                manual.status === "approved"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : manual.status === "draft"
                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
              }`}
            >
              {manual.status === "approved" ? (
                <Lock className="h-3 w-3" />
              ) : (
                <Unlock className="h-3 w-3" />
              )}
              {manual.status.charAt(0).toUpperCase() + manual.status.slice(1)}
            </div>
          </div>
        </div>

        {/* Project Info */}
        <div className="grid grid-cols-2 gap-6 mb-8 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Project</p>
            <p className="font-medium text-zinc-900 dark:text-zinc-100">{project.name}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Location</p>
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              {project.address || project.florida_county || "Not specified"}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Occupancy</p>
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              {project.occupancy_group || "Not specified"}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Construction Type</p>
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              {project.construction_type || "Not specified"}
            </p>
          </div>
        </div>

        {/* Document Sections */}
        <div className="space-y-6">
          {sections.map((section, index) => (
            <div key={index}>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                {section.title}
              </h2>
              <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none">
                {section.content.split("\n").map((paragraph, pIndex) => (
                  <p key={pIndex} className="text-zinc-600 dark:text-zinc-400">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ITP Summary Card */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Inspection Test Plan Summary
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">{totalItps}</p>
            <p className="text-sm text-zinc-500">Total Items</p>
          </div>
          <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-3xl font-bold text-red-600">{holdPoints}</p>
            <p className="text-sm text-zinc-500">Hold Points</p>
          </div>
          <div className="text-center p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            <p className="text-3xl font-bold text-zinc-600 dark:text-zinc-400">{phases.length}</p>
            <p className="text-sm text-zinc-500">Phases</p>
          </div>
        </div>

        {/* Phases List */}
        <div className="mt-4">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Construction Phases:
          </p>
          <div className="flex flex-wrap gap-2">
            {phases.map((phase) => (
              <span
                key={phase}
                className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-700 rounded text-zinc-700 dark:text-zinc-300"
              >
                {phase}
              </span>
            ))}
          </div>
        </div>

        {/* Approval Info */}
        {manual.status === "approved" && manual.approved_at && (
          <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Approved</span>
            </div>
            <p className="text-sm text-zinc-500 mt-1">
              By {manual.approved_by} on{" "}
              {new Date(manual.approved_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {manual.approval_notes && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 italic">
                "{manual.approval_notes}"
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function QualityManualPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  // State
  const [project, setProject] = useState<Project | null>(null);
  const [manual, setManual] = useState<QualityManualWithITPs | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("document");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingItps, setIsGeneratingItps] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [projectData, manualData] = await Promise.all([
        getProject(projectId),
        getOrCreateQualityManual(projectId),
      ]);

      if (!projectData) {
        setError("Project not found");
        return;
      }

      setProject(projectData);
      setManual(manualData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Generate ITPs
  const handleGenerateItps = async () => {
    if (!manual || !project) return;

    setIsGeneratingItps(true);
    setError(null);

    try {
      const description = [
        project.name,
        project.description,
        project.occupancy_group ? `${project.occupancy_group} occupancy` : "",
        project.construction_type ? `${project.construction_type} construction` : "",
      ]
        .filter(Boolean)
        .join(" - ");

      const result = await generateITPs(
        manual.id,
        projectId,
        description,
        project.occupancy_group || undefined,
        project.construction_type || undefined
      );

      if (result.success) {
        setSuccessMessage(`Generated ${result.itemsGenerated} ITPs`);
        await loadData(); // Refresh
      } else {
        setError(result.error || "Failed to generate ITPs");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate ITPs");
    } finally {
      setIsGeneratingItps(false);
    }
  };

  // Update ITP
  const handleUpdateItp = async (itpId: string, updates: Partial<InspectionTestPlan>) => {
    try {
      await updateITP(itpId, updates);
      // Update local state
      setManual((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          inspection_test_plans: prev.inspection_test_plans.map((itp) =>
            itp.id === itpId ? { ...itp, ...updates } : itp
          ),
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update ITP");
    }
  };

  // Delete ITP
  const handleDeleteItp = async (itpId: string) => {
    if (!confirm("Are you sure you want to delete this inspection item?")) return;

    try {
      await deleteITP(itpId);
      setManual((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          inspection_test_plans: prev.inspection_test_plans.filter((itp) => itp.id !== itpId),
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete ITP");
    }
  };

  // Approve Manual
  const handleApprove = async () => {
    if (!manual) return;

    const approvedBy = prompt("Enter your name to approve this Quality Manual:");
    if (!approvedBy) return;

    const notes = prompt("Add any approval notes (optional):");

    setIsApproving(true);
    setError(null);

    try {
      const result = await approveQualityManual(manual.id, approvedBy, notes || undefined);

      if (result.success) {
        setSuccessMessage(
          `Manual approved! Generated ${result.checklistsGenerated} checklists with ${result.checklistItemsGenerated} items.`
        );
        await loadData(); // Refresh
      } else {
        setError(result.error || "Failed to approve manual");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve manual");
    } finally {
      setIsApproving(false);
    }
  };

  // Revert to Draft
  const handleRevertToDraft = async () => {
    if (!manual) return;

    if (
      !confirm(
        "This will create a new draft version of the manual. The current approved version will be archived. Continue?"
      )
    )
      return;

    try {
      const result = await revertManualToDraft(manual.id);
      if (result.success) {
        setSuccessMessage("Created new draft version");
        await loadData();
      } else {
        setError(result.error || "Failed to revert to draft");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revert to draft");
    }
  };

  // Clear messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Error state
  if (error && !manual) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
          <Link
            href={`/project/${projectId}/hub`}
            className="text-blue-600 hover:underline mt-4 inline-block"
          >
            Return to Project Hub
          </Link>
        </div>
      </div>
    );
  }

  const isLocked = manual?.status === "approved";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-4">
              <Link
                href={`/project/${projectId}/hub`}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Quality Manual
                </h1>
                <p className="text-sm text-zinc-500">{project?.name}</p>
              </div>
            </div>

            {/* Center: View Toggle */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode("document")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "document"
                    ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <FileText className="h-4 w-4" />
                Document
              </button>
              <button
                onClick={() => setViewMode("itp-grid")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "itp-grid"
                    ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <Table2 className="h-4 w-4" />
                ITP Grid
              </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {!isLocked && manual && (
                <>
                  <button
                    onClick={handleGenerateItps}
                    disabled={isGeneratingItps}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isGeneratingItps ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Generate ITPs
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={
                      isApproving || (manual?.inspection_test_plans?.length || 0) === 0
                    }
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isApproving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Approve Manual
                  </button>
                </>
              )}
              {isLocked && (
                <button
                  onClick={handleRevertToDraft}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Create New Version
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <span className="sr-only">Dismiss</span>
              &times;
            </button>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-green-700 dark:text-green-400">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {manual && project && viewMode === "document" && (
          <DocumentView manual={manual} project={project} />
        )}

        {manual && viewMode === "itp-grid" && (
          <ITPEditorGrid
            itps={manual.inspection_test_plans}
            isLocked={isLocked}
            onUpdate={handleUpdateItp}
            onDelete={handleDeleteItp}
          />
        )}
      </main>
    </div>
  );
}
