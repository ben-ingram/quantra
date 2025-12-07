"use client";

import { useState, useEffect } from "react";
import {
  ClipboardCheck,
  CheckCircle2,
  Circle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Loader2,
  Camera,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Building2,
  Flag,
  MinusCircle,
  X,
  MapPin,
  Ruler,
  Flame,
  Wind,
  Waves,
  Settings2,
} from "lucide-react";
import {
  getProjectChecklists,
  getChecklistWithItems,
  generateChecklist,
  updateItemComplianceStatus,
  deleteChecklist,
  type Checklist,
  type ChecklistWithItems,
  type ChecklistItemWithMetadata,
  type ComplianceStatus,
} from "@/app/actions/checklists";
import { getProject, type Project } from "@/app/actions/projects";
import { calculateChecklistStats } from "@/app/lib/checklist-utils";
import { ParameterChecklist } from "@/app/components/checklist";
import type { ProjectContext } from "../page";

// =============================================================================
// Types
// =============================================================================

interface SmartChecklistTabProps {
  projectId: string;
  projectContext: ProjectContext;
  onVerifyItem?: (item: ChecklistItemWithMetadata) => void;
  onAskExpert?: (query: string) => void;
}

type ViewMode = "list" | "generate" | "parameters";

// Helper to build description from project data
function buildProjectDescription(project: Project): string {
  const parts: string[] = [];

  // Basic info
  parts.push(project.name);
  if (project.occupancy_group) {
    const subtype = project.occupancy_subtype ? ` (${project.occupancy_subtype})` : "";
    parts.push(`- ${project.occupancy_group}${subtype} occupancy`);
  }
  if (project.construction_type) {
    parts.push(`- ${project.construction_type} construction`);
  }

  // Building characteristics
  const buildingParts: string[] = [];
  if (project.number_of_stories) {
    buildingParts.push(`${project.number_of_stories}-story`);
  }
  if (project.building_height_ft) {
    buildingParts.push(`${project.building_height_ft}ft tall`);
  }
  if (project.total_area_sqft) {
    buildingParts.push(`${Number(project.total_area_sqft).toLocaleString()} sq ft`);
  }
  if (buildingParts.length > 0) {
    parts.push(`- ${buildingParts.join(", ")}`);
  }

  // Fire protection
  if (project.is_sprinklered) {
    parts.push("- Sprinklered building");
  }
  if (project.fire_alarm_type && project.fire_alarm_type !== "none") {
    parts.push(`- ${project.fire_alarm_type} fire alarm`);
  }

  // Location
  if (project.florida_county) {
    parts.push(`- ${project.florida_county} County, FL`);
  }
  if (project.wind_speed_mph) {
    parts.push(`- ${project.wind_speed_mph} mph wind zone`);
  }

  // Special features
  if (project.is_high_rise) {
    parts.push("- HIGH-RISE building");
  }
  if (project.has_hazardous_materials) {
    parts.push("- Contains hazardous materials");
  }

  // Original description
  if (project.description) {
    parts.push(`- ${project.description}`);
  }

  return parts.join(" ");
}

// Check if project has intake data
function hasIntakeData(project: Project | null): boolean {
  if (!project) return false;
  return !!(
    project.occupancy_subtype ||
    project.number_of_stories ||
    project.building_height_ft ||
    project.total_area_sqft ||
    project.florida_county ||
    project.wind_speed_mph ||
    project.is_high_rise ||
    project.has_hazardous_materials
  );
}

// =============================================================================
// Smart Checklist Tab
// =============================================================================

export function SmartChecklistTab({
  projectId,
  projectContext,
  onVerifyItem,
  onAskExpert,
}: SmartChecklistTabProps) {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [activeChecklist, setActiveChecklist] = useState<ChecklistWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [fullProject, setFullProject] = useState<Project | null>(null);

  // Generation form state - will be built from project data
  const [description, setDescription] = useState("");

  // Load checklists and full project data on mount
  useEffect(() => {
    loadData();
  }, [projectId]);

  // Build description from project data
  useEffect(() => {
    if (fullProject) {
      setDescription(buildProjectDescription(fullProject));
    }
  }, [fullProject]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [checklistData, projectData] = await Promise.all([
        getProjectChecklists(projectId),
        getProject(projectId),
      ]);

      setChecklists(checklistData);
      setFullProject(projectData);

      // Auto-load first checklist if exists
      if (checklistData.length > 0) {
        const firstChecklist = await getChecklistWithItems(checklistData[0].id);
        setActiveChecklist(firstChecklist);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadChecklists = async () => {
    try {
      const data = await getProjectChecklists(projectId);
      setChecklists(data);

      // Auto-load first checklist if exists
      if (data.length > 0) {
        const firstChecklist = await getChecklistWithItems(data[0].id);
        setActiveChecklist(firstChecklist);
      }
    } catch (error) {
      console.error("Failed to load checklists:", error);
    }
  };

  const handleGenerate = async () => {
    if (!fullProject?.occupancy_group) {
      setGenerateError("Please set an occupancy group in the Details tab first");
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);

    try {
      const result = await generateChecklist({
        projectId,
        projectDescription: description || buildProjectDescription(fullProject),
        // Pass occupancy context for RAG filtering
        occupancyGroup: fullProject.occupancy_group || undefined,
        constructionType: fullProject.construction_type || undefined,
      });

      if (!result.success) {
        setGenerateError(result.error || "Failed to generate checklist");
        return;
      }

      // Reload checklists and select the new one
      await loadChecklists();
      if (result.checklist?.id) {
        const newChecklist = await getChecklistWithItems(result.checklist.id);
        setActiveChecklist(newChecklist);
      }

      setViewMode("list");
    } catch (error) {
      console.error("Generation error:", error);
      setGenerateError(error instanceof Error ? error.message : "Failed to generate checklist");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    if (!confirm("Are you sure you want to delete this checklist?")) return;

    try {
      await deleteChecklist(checklistId, projectId);
      await loadChecklists();
      if (activeChecklist?.id === checklistId) {
        setActiveChecklist(null);
      }
    } catch (error) {
      console.error("Failed to delete checklist:", error);
    }
  };

  const handleStatusChange = async (
    item: ChecklistItemWithMetadata,
    newStatus: ComplianceStatus,
    notes?: string
  ) => {
    if (!activeChecklist) return;

    try {
      await updateItemComplianceStatus({
        itemId: item.id,
        status: newStatus,
        failNotes: newStatus === "fail" ? notes : undefined,
        flagReason: newStatus === "flag" ? notes : undefined,
      });
      // Refresh checklist
      const updated = await getChecklistWithItems(activeChecklist.id);
      setActiveChecklist(updated);
    } catch (error) {
      console.error("Failed to update compliance:", error);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Smart Checklist</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle - only show when we have a checklist */}
          {activeChecklist && viewMode !== "generate" && (
            <div className="flex items-center rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-primary text-white"
                    : "text-foreground-muted hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode("parameters")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${
                  viewMode === "parameters"
                    ? "bg-primary text-white"
                    : "text-foreground-muted hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                <Ruler className="w-3 h-3" />
                Parameters
              </button>
            </div>
          )}
          {(viewMode === "list" || viewMode === "parameters") && (
            <button
              onClick={() => setViewMode("generate")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate
            </button>
          )}
          {viewMode === "generate" && (
            <button
              onClick={() => setViewMode("list")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {viewMode === "generate" ? (
        <GenerateForm
          project={fullProject}
          description={description}
          setDescription={setDescription}
          isGenerating={isGenerating}
          error={generateError}
          onGenerate={handleGenerate}
          onEditDetails={() => {
            // This will be handled by parent - switch to details tab
            // For now, just show a message
          }}
        />
      ) : viewMode === "parameters" && activeChecklist ? (
        <div className="flex-1 overflow-y-auto p-4">
          <ParameterChecklist
            items={activeChecklist.items.map(item => {
              const itemAny = item as unknown as Record<string, unknown>;
              return {
                id: item.id,
                requirement_text: item.requirement_text,
                code_reference: item.code_reference || "",
                parameter_name: itemAny.parameter_name as string | null,
                target_value: itemAny.target_value as Record<string, unknown> | null,
                designed_value: itemAny.designed_value as string | null,
                measured_value: itemAny.measured_value as string | null,
                unit: itemAny.unit as string | null,
                comparison_logic: itemAny.comparison_logic as string | null,
                validation_result: itemAny.validation_result as "pass" | "fail" | "warning" | "not_measured" | null,
                validation_notes: itemAny.validation_notes as string | null,
                notes: item.notes,
              };
            })}
            checklistId={activeChecklist.id}
            projectId={projectId}
            onAskExpert={onAskExpert}
          />
        </div>
      ) : activeChecklist ? (
        <ChecklistView
          checklist={activeChecklist}
          onStatusChange={handleStatusChange}
          onVerifyItem={onVerifyItem}
          onDelete={() => handleDeleteChecklist(activeChecklist.id)}
          onRefresh={loadChecklists}
        />
      ) : checklists.length > 0 ? (
        <ChecklistSelector
          checklists={checklists}
          onSelect={async (id) => {
            const data = await getChecklistWithItems(id);
            setActiveChecklist(data);
          }}
          onDelete={handleDeleteChecklist}
        />
      ) : (
        <EmptyState
          onGenerate={() => setViewMode("generate")}
          occupancyGroup={projectContext.occupancyGroup}
        />
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function EmptyState({
  onGenerate,
  occupancyGroup,
}: {
  onGenerate: () => void;
  occupancyGroup: string | null;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <ClipboardCheck className="w-6 h-6 text-primary" />
      </div>
      <h3 className="font-semibold text-foreground mb-1">No Checklists Yet</h3>
      <p className="text-sm text-foreground-muted mb-4 max-w-xs">
        Generate an AI-powered inspection checklist tailored to your project.
      </p>
      {occupancyGroup && (
        <div className="flex items-center gap-2 px-3 py-1.5 mb-4 rounded-full bg-primary/10 text-primary text-sm">
          <Building2 className="w-4 h-4" />
          {occupancyGroup} Occupancy
        </div>
      )}
      <button
        onClick={onGenerate}
        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        Generate Inspection Plan
      </button>
    </div>
  );
}

function GenerateForm({
  project,
  description,
  setDescription,
  isGenerating,
  error,
  onGenerate,
  onEditDetails,
}: {
  project: Project | null;
  description: string;
  setDescription: (v: string) => void;
  isGenerating: boolean;
  error: string | null;
  onGenerate: () => void;
  onEditDetails: () => void;
}) {
  const projectHasDetails = hasIntakeData(project);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Project Details Summary */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-surface-hover border-b border-border">
          <span className="text-sm font-medium text-foreground">Project Details</span>
          <button
            onClick={onEditDetails}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Settings2 className="w-3 h-3" />
            Edit in Details Tab
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Occupancy Section */}
          <div className="flex items-start gap-3">
            <Building2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {project?.occupancy_group || "No occupancy set"}
                {project?.occupancy_subtype && (
                  <span className="text-primary ml-1">({project.occupancy_subtype})</span>
                )}
              </p>
              {project?.construction_type && (
                <p className="text-xs text-foreground-muted">{project.construction_type}</p>
              )}
              {project?.mixed_occupancies && project.mixed_occupancies.length > 0 && (
                <p className="text-xs text-foreground-muted">
                  Mixed: {project.mixed_occupancies.join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* Building Characteristics */}
          {(project?.number_of_stories || project?.building_height_ft || project?.total_area_sqft) && (
            <div className="flex items-start gap-3">
              <Ruler className="w-4 h-4 text-foreground-muted mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-foreground">
                {project?.number_of_stories && (
                  <span>{project.number_of_stories} stories</span>
                )}
                {project?.building_height_ft && (
                  <span>{project.building_height_ft} ft height</span>
                )}
                {project?.total_area_sqft && (
                  <span>{Number(project.total_area_sqft).toLocaleString()} sq ft</span>
                )}
              </div>
            </div>
          )}

          {/* Fire Protection */}
          {(project?.is_sprinklered || project?.fire_alarm_type) && (
            <div className="flex items-start gap-3">
              <Flame className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-foreground">
                {project?.is_sprinklered && (
                  <span className="text-success">Sprinklered</span>
                )}
                {project?.is_sprinklered === false && (
                  <span className="text-warning">Non-Sprinklered</span>
                )}
                {project?.fire_alarm_type && project.fire_alarm_type !== "none" && (
                  <span>{project.fire_alarm_type} alarm</span>
                )}
              </div>
            </div>
          )}

          {/* Florida Location */}
          {(project?.florida_county || project?.wind_speed_mph || project?.flood_zone) && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-foreground-muted mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-foreground">
                {project?.florida_county && (
                  <span>{project.florida_county} County</span>
                )}
                {project?.wind_speed_mph && (
                  <span className="flex items-center gap-1">
                    <Wind className="w-3 h-3" />
                    {project.wind_speed_mph} mph
                  </span>
                )}
                {project?.flood_zone && (
                  <span className="flex items-center gap-1">
                    <Waves className="w-3 h-3" />
                    Zone {project.flood_zone}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Special Features */}
          {(project?.is_high_rise || project?.has_hazardous_materials || project?.has_high_piled_storage || project?.has_assembly_areas) && (
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-2">
                {project?.is_high_rise && (
                  <span className="px-2 py-0.5 text-xs rounded bg-danger/10 text-danger font-medium">HIGH-RISE</span>
                )}
                {project?.has_hazardous_materials && (
                  <span className="px-2 py-0.5 text-xs rounded bg-danger/10 text-danger font-medium">HAZMAT</span>
                )}
                {project?.has_high_piled_storage && (
                  <span className="px-2 py-0.5 text-xs rounded bg-warning/10 text-warning font-medium">High-Piled Storage</span>
                )}
                {project?.has_assembly_areas && (
                  <span className="px-2 py-0.5 text-xs rounded bg-primary/10 text-primary font-medium">Assembly Areas</span>
                )}
              </div>
            </div>
          )}

          {/* No details prompt */}
          {!projectHasDetails && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
              <p className="text-xs text-foreground">
                Add project details in the <strong>Details</strong> tab for more accurate checklists.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Additional Notes */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Additional Context (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add any additional project details or specific areas of concern..."
          rows={2}
          disabled={isGenerating}
          className="w-full px-3 py-2 text-sm rounded-lg bg-surface-hover border border-border text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50 resize-none"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={onGenerate}
        disabled={isGenerating || !project?.occupancy_group}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-medium rounded-lg transition-colors"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating Inspection Plan...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate Inspection Plan
          </>
        )}
      </button>

      <p className="text-xs text-foreground-muted text-center">
        AI will analyze Florida Building Code using your project details to generate a comprehensive inspection checklist.
      </p>
    </div>
  );
}

function ChecklistSelector({
  checklists,
  onSelect,
  onDelete,
}: {
  checklists: Checklist[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      <p className="text-sm text-foreground-muted mb-3">Select a checklist:</p>
      {checklists.map((checklist) => (
        <div
          key={checklist.id}
          className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-surface-hover transition-colors cursor-pointer group"
          onClick={() => onSelect(checklist.id)}
        >
          <ClipboardCheck className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{checklist.title}</p>
            <p className="text-xs text-foreground-muted">
              {new Date(checklist.created_at).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(checklist.id);
            }}
            className="p-1.5 rounded text-foreground-muted hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ChecklistView({
  checklist,
  onStatusChange,
  onVerifyItem,
  onDelete,
  onRefresh,
}: {
  checklist: ChecklistWithItems;
  onStatusChange: (item: ChecklistItemWithMetadata, status: ComplianceStatus, notes?: string) => void;
  onVerifyItem?: (item: ChecklistItemWithMetadata) => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const stats = calculateChecklistStats(checklist.items);

  // Group items by category
  const groupedItems = checklist.items.reduce<
    Record<string, ChecklistItemWithMetadata[]>
  >((acc, item) => {
    const category = item.metadata?.category || "General";
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(Object.keys(groupedItems))
  );

  const toggleSection = (category: string) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setExpandedSections(newSet);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Stats Bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-surface-hover/30">
        <StatBadge
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          label="Pass"
          value={stats.passed}
          color="text-success"
        />
        <StatBadge
          icon={<XCircle className="w-3.5 h-3.5" />}
          label="Fail"
          value={stats.failed}
          color="text-danger"
        />
        <StatBadge
          icon={<Circle className="w-3.5 h-3.5" />}
          label="Pending"
          value={stats.pending}
          color="text-foreground-muted"
        />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-foreground-muted">
            {stats.percentComplete}% complete
          </span>
          <button
            onClick={onRefresh}
            className="p-1 rounded hover:bg-surface-hover text-foreground-muted hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-danger/10 text-foreground-muted hover:text-danger transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Checklist Sections */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(groupedItems).map(([category, items]) => (
          <ChecklistSection
            key={category}
            category={category}
            items={items}
            expanded={expandedSections.has(category)}
            onToggle={() => toggleSection(category)}
            onStatusChange={onStatusChange}
            onVerifyItem={onVerifyItem}
          />
        ))}
      </div>
    </div>
  );
}

function StatBadge({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${color}`}>
      {icon}
      <span className="text-xs font-medium">
        {value} {label}
      </span>
    </div>
  );
}

function ChecklistSection({
  category,
  items,
  expanded,
  onToggle,
  onStatusChange,
  onVerifyItem,
}: {
  category: string;
  items: ChecklistItemWithMetadata[];
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (item: ChecklistItemWithMetadata, status: ComplianceStatus, notes?: string) => void;
  onVerifyItem?: (item: ChecklistItemWithMetadata) => void;
}) {
  const passCount = items.filter((i) => i.is_compliant === true).length;
  const failCount = items.filter((i) => i.is_compliant === false).length;

  return (
    <div className="border-b border-border">
      {/* Section Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-foreground-muted" />
        ) : (
          <ChevronRight className="w-4 h-4 text-foreground-muted" />
        )}
        <div className="flex-1 text-left">
          <p className="font-medium text-foreground">{category}</p>
          <p className="text-xs text-foreground-muted">{items.length} items</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {passCount > 0 && (
            <span className="flex items-center gap-1 text-success">
              <CheckCircle2 className="w-3 h-3" />
              {passCount}
            </span>
          )}
          {failCount > 0 && (
            <span className="flex items-center gap-1 text-danger">
              <XCircle className="w-3 h-3" />
              {failCount}
            </span>
          )}
        </div>
      </button>

      {/* Section Items */}
      {expanded && (
        <div className="pb-2">
          {items.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              onStatusChange={onStatusChange}
              onVerify={onVerifyItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistItemRow({
  item,
  onStatusChange,
  onVerify,
}: {
  item: ChecklistItemWithMetadata;
  onStatusChange: (item: ChecklistItemWithMetadata, status: ComplianceStatus, notes?: string) => void;
  onVerify?: (item: ChecklistItemWithMetadata) => void;
}) {
  const [showFailModal, setShowFailModal] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [failNotes, setFailNotes] = useState("");
  const [flagReason, setFlagReason] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  // Get the current compliance status
  const itemAny = item as unknown as Record<string, unknown>;
  const complianceStatus = itemAny.compliance_status as ComplianceStatus | undefined;
  const currentStatus: ComplianceStatus = complianceStatus ||
    (item.is_compliant === true ? "pass" :
     item.is_compliant === false ? "fail" : "pending");

  const statusConfig = {
    pending: {
      icon: <Circle className="w-5 h-5" />,
      color: "text-foreground-muted",
      bg: "",
      label: "Pending",
    },
    pass: {
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: "text-success",
      bg: "bg-success/5",
      label: "Pass",
    },
    fail: {
      icon: <XCircle className="w-5 h-5" />,
      color: "text-danger",
      bg: "bg-danger/5",
      label: "Fail",
    },
    flag: {
      icon: <Flag className="w-5 h-5" />,
      color: "text-warning",
      bg: "bg-warning/5",
      label: "Flagged",
    },
    na: {
      icon: <MinusCircle className="w-5 h-5" />,
      color: "text-foreground-muted",
      bg: "bg-surface-hover",
      label: "N/A",
    },
  };

  const config = statusConfig[currentStatus];

  const riskLevel = item.metadata?.riskLevel as string | undefined;
  const riskConfig = {
    critical: { color: "text-red-600 font-semibold", bg: "bg-red-500/10", label: "CRITICAL" },
    high: { color: "text-danger", bg: "bg-danger/5", label: "HIGH" },
    medium: { color: "text-warning", bg: "bg-warning/5", label: "MEDIUM" },
    low: { color: "text-foreground-muted", bg: "", label: "LOW" },
  }[riskLevel || "low"] || { color: "text-foreground-muted", bg: "", label: "" };

  // Handle pass - immediate
  const handlePass = () => {
    onStatusChange(item, "pass");
  };

  // Handle fail - requires notes
  const handleFailClick = () => {
    setFailNotes("");
    setShowFailModal(true);
  };

  const handleFailSubmit = () => {
    if (!failNotes.trim()) return;
    onStatusChange(item, "fail", failNotes);
    setShowFailModal(false);
    setFailNotes("");
  };

  // Handle flag - requires reason
  const handleFlagClick = () => {
    setFlagReason("");
    setShowFlagModal(true);
  };

  const handleFlagSubmit = () => {
    if (!flagReason.trim()) return;
    onStatusChange(item, "flag", flagReason);
    setShowFlagModal(false);
    setFlagReason("");
  };

  // Handle N/A
  const handleNA = () => {
    onStatusChange(item, "na");
  };

  // Handle clear/reset
  const handleClear = () => {
    onStatusChange(item, "pending");
  };

  // Get existing notes
  const existingNotes = itemAny.fail_notes as string | undefined ||
                        itemAny.flag_reason as string | undefined ||
                        item.notes;

  return (
    <>
      <div
        className={`flex flex-col px-4 py-3 mx-2 rounded-lg transition-colors ${config.bg} border border-transparent hover:border-border`}
      >
        {/* Main Row */}
        <div className="flex items-start gap-3">
          {/* Status Icon */}
          <div className={`mt-0.5 ${config.color}`}>
            {config.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">{item.requirement_text}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {item.code_reference && (
                <span className="text-xs font-mono text-primary">
                  {item.code_reference}
                </span>
              )}
              {riskLevel && riskConfig.label && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${riskConfig.color} ${riskConfig.bg}`}>
                  {riskConfig.label}
                </span>
              )}
              <span className={`text-xs ${config.color}`}>
                {config.label}
              </span>
            </div>

            {/* Show existing notes if any */}
            {existingNotes && currentStatus !== "pending" && (
              <div className="mt-2 p-2 rounded bg-surface-hover text-xs text-foreground-secondary">
                <strong>Notes:</strong> {existingNotes}
              </div>
            )}
          </div>

          {/* Expand/Collapse for actions */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-foreground-muted hover:text-foreground transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Expanded Actions */}
        {isExpanded && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            {/* Pass Button */}
            <button
              onClick={handlePass}
              disabled={currentStatus === "pass"}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors
                ${currentStatus === "pass"
                  ? "bg-success/20 text-success cursor-default"
                  : "bg-success/10 text-success hover:bg-success/20"
                }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Pass
            </button>

            {/* Fail Button */}
            <button
              onClick={handleFailClick}
              disabled={currentStatus === "fail"}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors
                ${currentStatus === "fail"
                  ? "bg-danger/20 text-danger cursor-default"
                  : "bg-danger/10 text-danger hover:bg-danger/20"
                }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              Fail
            </button>

            {/* Flag Button */}
            <button
              onClick={handleFlagClick}
              disabled={currentStatus === "flag"}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors
                ${currentStatus === "flag"
                  ? "bg-warning/20 text-warning cursor-default"
                  : "bg-warning/10 text-warning hover:bg-warning/20"
                }`}
            >
              <Flag className="w-3.5 h-3.5" />
              Flag
            </button>

            {/* N/A Button */}
            <button
              onClick={handleNA}
              disabled={currentStatus === "na"}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors
                ${currentStatus === "na"
                  ? "bg-surface-hover text-foreground-muted cursor-default"
                  : "text-foreground-muted hover:bg-surface-hover"
                }`}
            >
              <MinusCircle className="w-3.5 h-3.5" />
              N/A
            </button>

            <div className="flex-1" />

            {/* Clear Button */}
            {currentStatus !== "pending" && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1 px-2 py-1 text-xs text-foreground-muted hover:text-foreground transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Clear
              </button>
            )}

            {/* Verify Button */}
            {onVerify && (
              <button
                onClick={() => onVerify(item)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                Photo
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fail Notes Modal */}
      {showFailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowFailModal(false)} />
          <div className="relative w-full max-w-md mx-4 bg-background border border-border rounded-xl shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-danger" />
                <h3 className="font-semibold text-foreground">Mark as Failed</h3>
              </div>
              <button onClick={() => setShowFailModal(false)} className="p-1 hover:bg-surface-hover rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-foreground-muted mb-3">
                Please describe why this item failed inspection:
              </p>
              <textarea
                value={failNotes}
                onChange={(e) => setFailNotes(e.target.value)}
                placeholder="Describe the non-compliance issue, measurements, observations..."
                className="w-full h-32 px-3 py-2 text-sm rounded-lg border border-border bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-danger/50 resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowFailModal(false)}
                  className="px-4 py-2 text-sm text-foreground-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFailSubmit}
                  disabled={!failNotes.trim()}
                  className="px-4 py-2 text-sm font-medium bg-danger hover:bg-danger/90 text-white rounded-lg disabled:opacity-50"
                >
                  Mark Failed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flag Reason Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowFlagModal(false)} />
          <div className="relative w-full max-w-md mx-4 bg-background border border-border rounded-xl shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-warning" />
                <h3 className="font-semibold text-foreground">Flag for Review</h3>
              </div>
              <button onClick={() => setShowFlagModal(false)} className="p-1 hover:bg-surface-hover rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-foreground-muted mb-3">
                Why does this item need further review?
              </p>
              <textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Need additional documentation, unclear requirement, pending verification..."
                className="w-full h-32 px-3 py-2 text-sm rounded-lg border border-border bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-warning/50 resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowFlagModal(false)}
                  className="px-4 py-2 text-sm text-foreground-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFlagSubmit}
                  disabled={!flagReason.trim()}
                  className="px-4 py-2 text-sm font-medium bg-warning hover:bg-warning/90 text-white rounded-lg disabled:opacity-50"
                >
                  Flag Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
