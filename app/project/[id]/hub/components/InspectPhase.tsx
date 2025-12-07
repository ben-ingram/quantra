"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  Camera,
  FileWarning,
  Eye,
  MoreHorizontal,
  Flag,
  Ruler,
} from "lucide-react";
import BimViewer, { type BimElementData } from "@/app/components/dashboard/BimViewer";
import {
  updateItemComplianceStatus,
  type ComplianceStatus,
} from "@/app/actions/checklists";
import {
  getActiveInspectionChecklist,
  type ActiveInspectionChecklist,
  type ActiveInspectionItem,
} from "@/app/actions/quality-manual";
import { ParameterChecklist } from "@/app/components/checklist/ParameterChecklist";

interface InspectPhaseProps {
  projectId: string;
  bimModelUrl?: string;
}

type ViewMode = "grouped" | "parameters";

export function InspectPhase({ projectId, bimModelUrl }: InspectPhaseProps) {
  const [inspectionData, setInspectionData] = useState<ActiveInspectionChecklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["holdPoints", "pending"]));
  const [selectedElement, setSelectedElement] = useState<BimElementData | null>(null);
  const [isCheckingCompliance, setIsCheckingCompliance] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");

  // Load the active inspection checklist (from approved Quality Manual)
  useEffect(() => {
    async function loadInspectionData() {
      try {
        const result = await getActiveInspectionChecklist(projectId);
        if (result.success && result.data) {
          setInspectionData(result.data);
        } else {
          setError(result.error || "No active inspection plan found");
        }
      } catch (err) {
        console.error("Error loading inspection data:", err);
        setError("Failed to load inspection data");
      } finally {
        setIsLoading(false);
      }
    }

    loadInspectionData();
  }, [projectId]);

  // Handle compliance status update
  const handleStatusChange = useCallback(
    async (itemId: string, status: ComplianceStatus, notes?: string) => {
      if (!inspectionData) return;

      try {
        await updateItemComplianceStatus({
          itemId,
          status,
          notes,
          inspectorName: "Current User", // TODO: Get from auth
        });

        // Update local state
        setInspectionData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            items: prev.items.map((item) =>
              item.id === itemId
                ? { ...item, complianceStatus: status }
                : item
            ),
            stats: {
              ...prev.stats,
              // Recalculate stats
              passed: prev.items.filter((i) => i.id === itemId ? status === "pass" : i.complianceStatus === "pass").length,
              failed: prev.items.filter((i) => i.id === itemId ? status === "fail" : i.complianceStatus === "fail").length,
              flagged: prev.items.filter((i) => i.id === itemId ? status === "flag" : i.complianceStatus === "flag").length,
              pending: prev.items.filter((i) => i.id === itemId ? status === "pending" : i.complianceStatus === "pending").length,
            },
          };
        });
      } catch (err) {
        console.error("Error updating compliance:", err);
      }
    },
    [inspectionData]
  );

  // Handle parameter measurement save
  const handleSaveMeasurement = useCallback(
    async (itemId: string, measuredValue: string) => {
      // TODO: Implement API call to save measured value
      console.log("Saving measurement:", itemId, measuredValue);
    },
    []
  );

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Handle element selection from BimViewer
  const handleSelectElement = useCallback((element: BimElementData) => {
    setSelectedElement(element);
  }, []);

  // Handle compliance check from BimViewer
  const handleRunComplianceCheck = useCallback(async () => {
    setIsCheckingCompliance(true);
    // TODO: Implement AR/Visual Variance modal
    setTimeout(() => {
      setIsCheckingCompliance(false);
    }, 2000);
  }, []);

  // Group items: Hold Points first, then by compliance status
  const groupedItems = useMemo(() => {
    if (!inspectionData) return null;

    const holdPoints: ActiveInspectionItem[] = [];
    const pending: ActiveInspectionItem[] = [];
    const flagged: ActiveInspectionItem[] = [];
    const failed: ActiveInspectionItem[] = [];
    const passed: ActiveInspectionItem[] = [];

    for (const item of inspectionData.items) {
      if (item.isHoldPoint) {
        holdPoints.push(item);
      } else {
        switch (item.complianceStatus) {
          case "pass":
            passed.push(item);
            break;
          case "fail":
            failed.push(item);
            break;
          case "flag":
            flagged.push(item);
            break;
          default:
            pending.push(item);
        }
      }
    }

    return { holdPoints, pending, flagged, failed, passed };
  }, [inspectionData]);

  // Convert items to ParameterChecklist format
  const parameterItems = useMemo(() => {
    if (!inspectionData) return [];

    return inspectionData.items
      .filter((item) => item.parameterName)
      .map((item) => ({
        id: item.id,
        requirement_text: item.requirementText,
        code_reference: item.codeReference || "",
        parameter_name: item.parameterName,
        target_value: item.targetValue as {
          min?: number;
          max?: number;
          value?: number;
          unit?: string;
          code_ref?: string;
          context?: string;
        } | null,
        designed_value: item.designedValue,
        measured_value: item.measuredValue,
        unit: item.unit,
        comparison_logic: item.comparisonLogic,
        validation_result: item.validationResult as "pass" | "fail" | "warning" | "not_measured" | null,
        validation_notes: null,
        notes: null,
      }));
  }, [inspectionData]);

  // Calculate stats
  const stats = inspectionData?.stats || {
    total: 0,
    holdPoints: 0,
    passed: 0,
    failed: 0,
    flagged: 0,
    pending: 0,
  };

  const completionRate = stats.total > 0
    ? Math.round(((stats.passed + stats.failed + stats.flagged) / stats.total) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left Panel - 3D BimViewer */}
      <div className="flex-1 min-w-0 border-r border-border">
        <BimViewer
          projectId={projectId}
          modelUrl={bimModelUrl}
          title="Inspection View"
          onSelectElement={handleSelectElement}
          onRunComplianceCheck={handleRunComplianceCheck}
          isCheckingCompliance={isCheckingCompliance}
        />
      </div>

      {/* Right Panel - Inspection Checklist */}
      <div className="w-[480px] flex flex-col bg-surface overflow-hidden">
        {/* Checklist Header */}
        <div className="p-4 border-b border-border bg-surface-hover/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Active Inspection Plan
              </h2>
              {inspectionData && (
                <p className="text-xs text-foreground-muted">
                  Quality Manual v{inspectionData.qualityManualVersion}
                </p>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex gap-1 bg-slate-800 p-0.5 rounded-lg">
              <button
                onClick={() => setViewMode("grouped")}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  viewMode === "grouped"
                    ? "bg-primary text-white"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                Grouped
              </button>
              <button
                onClick={() => setViewMode("parameters")}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  viewMode === "parameters"
                    ? "bg-primary text-white"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                Parameters
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-foreground-muted">
                {completionRate}% Complete
              </span>
              <span className="text-foreground-muted">
                {stats.passed + stats.failed + stats.flagged}/{stats.total}
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
              {stats.passed > 0 && (
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${(stats.passed / stats.total) * 100}%` }}
                />
              )}
              {stats.failed > 0 && (
                <div
                  className="bg-red-500 h-full"
                  style={{ width: `${(stats.failed / stats.total) * 100}%` }}
                />
              )}
              {stats.flagged > 0 && (
                <div
                  className="bg-amber-500 h-full"
                  style={{ width: `${(stats.flagged / stats.total) * 100}%` }}
                />
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-5 gap-2 mt-3">
            <StatChip icon={<Flag className="w-3 h-3" />} count={stats.holdPoints} color="violet" label="Hold" />
            <StatChip icon={<CheckCircle2 className="w-3 h-3" />} count={stats.passed} color="emerald" label="Pass" />
            <StatChip icon={<XCircle className="w-3 h-3" />} count={stats.failed} color="red" label="Fail" />
            <StatChip icon={<AlertTriangle className="w-3 h-3" />} count={stats.flagged} color="amber" label="Flag" />
            <StatChip icon={<Clock className="w-3 h-3" />} count={stats.pending} color="slate" label="Pending" />
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="m-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-center">
            <FileWarning className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-foreground mb-1">
              No Active Inspection Plan
            </h3>
            <p className="text-xs text-foreground-muted">
              {error}
            </p>
          </div>
        )}

        {/* Checklist Content */}
        {inspectionData && groupedItems && (
          <div className="flex-1 overflow-y-auto">
            {viewMode === "grouped" ? (
              // Grouped View - Hold Points first, then by status
              <>
                {/* Hold Points Section - Always First */}
                {groupedItems.holdPoints.length > 0 && (
                  <ChecklistSection
                    title="Hold Points"
                    subtitle="Critical - Work stops until passed"
                    icon={<Flag className="w-4 h-4 text-violet-400" />}
                    items={groupedItems.holdPoints}
                    expanded={expandedSections.has("holdPoints")}
                    onToggle={() => toggleSection("holdPoints")}
                    onStatusChange={handleStatusChange}
                    accentColor="violet"
                    isHoldPoint
                  />
                )}

                {/* Pending Section */}
                {groupedItems.pending.length > 0 && (
                  <ChecklistSection
                    title="Pending Inspection"
                    icon={<Clock className="w-4 h-4 text-slate-400" />}
                    items={groupedItems.pending}
                    expanded={expandedSections.has("pending")}
                    onToggle={() => toggleSection("pending")}
                    onStatusChange={handleStatusChange}
                    accentColor="slate"
                  />
                )}

                {/* Flagged Section */}
                {groupedItems.flagged.length > 0 && (
                  <ChecklistSection
                    title="Flagged for Review"
                    icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
                    items={groupedItems.flagged}
                    expanded={expandedSections.has("flagged")}
                    onToggle={() => toggleSection("flagged")}
                    onStatusChange={handleStatusChange}
                    accentColor="amber"
                  />
                )}

                {/* Failed Section */}
                {groupedItems.failed.length > 0 && (
                  <ChecklistSection
                    title="Non-Compliant"
                    icon={<XCircle className="w-4 h-4 text-red-400" />}
                    items={groupedItems.failed}
                    expanded={expandedSections.has("failed")}
                    onToggle={() => toggleSection("failed")}
                    onStatusChange={handleStatusChange}
                    accentColor="red"
                  />
                )}

                {/* Passed Section */}
                {groupedItems.passed.length > 0 && (
                  <ChecklistSection
                    title="Compliant"
                    icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    items={groupedItems.passed}
                    expanded={expandedSections.has("passed")}
                    onToggle={() => toggleSection("passed")}
                    onStatusChange={handleStatusChange}
                    accentColor="emerald"
                  />
                )}
              </>
            ) : (
              // Parameters View - Design vs Code vs Actual
              <div className="p-4">
                {parameterItems.length > 0 ? (
                  <ParameterChecklist
                    items={parameterItems}
                    checklistId={inspectionData.checklistId}
                    projectId={projectId}
                    onSave={handleSaveMeasurement}
                  />
                ) : (
                  <div className="text-center py-8">
                    <Ruler className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-foreground-muted">
                      No measurable parameters in this inspection plan.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Selected Element Preview */}
        {selectedElement && (
          <div className="p-3 border-t border-border bg-cyan-500/5">
            <div className="flex items-center gap-2 text-sm">
              <Eye className="w-4 h-4 text-cyan-400" />
              <span className="text-foreground-muted">Selected:</span>
              <span className="text-cyan-400 font-medium truncate">
                {selectedElement.name}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function StatChip({
  icon,
  count,
  color,
  label,
}: {
  icon: React.ReactNode;
  count: number;
  color: "emerald" | "red" | "amber" | "slate" | "violet";
  label: string;
}) {
  const colors = {
    emerald: "bg-emerald-500/10 text-emerald-400",
    red: "bg-red-500/10 text-red-400",
    amber: "bg-amber-500/10 text-amber-400",
    slate: "bg-slate-500/10 text-slate-400",
    violet: "bg-violet-500/10 text-violet-400",
  };

  return (
    <div className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg ${colors[color]}`}>
      {icon}
      <span className="text-sm font-semibold">{count}</span>
    </div>
  );
}

interface ChecklistSectionProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  items: ActiveInspectionItem[];
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (itemId: string, status: ComplianceStatus, notes?: string) => void;
  accentColor: "emerald" | "red" | "amber" | "slate" | "violet";
  isHoldPoint?: boolean;
}

function ChecklistSection({
  title,
  subtitle,
  icon,
  items,
  expanded,
  onToggle,
  onStatusChange,
  accentColor,
  isHoldPoint,
}: ChecklistSectionProps) {
  const borderColors = {
    emerald: "border-l-emerald-500",
    red: "border-l-red-500",
    amber: "border-l-amber-500",
    slate: "border-l-slate-600",
    violet: "border-l-violet-500",
  };

  return (
    <div className={`border-b border-border ${isHoldPoint ? "bg-violet-500/5" : ""}`}>
      {/* Section Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          {icon}
          <div className="text-left">
            <span className="font-medium text-foreground">{title}</span>
            {subtitle && (
              <p className="text-xs text-foreground-muted">{subtitle}</p>
            )}
          </div>
          <span className="text-xs text-foreground-muted px-1.5 py-0.5 bg-slate-800 rounded ml-2">
            {items.length}
          </span>
        </div>
      </button>

      {/* Section Items */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {items.map((item) => (
            <ChecklistItemCard
              key={item.id}
              item={item}
              onStatusChange={onStatusChange}
              accentColor={accentColor}
              isHoldPoint={isHoldPoint}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ChecklistItemCardProps {
  item: ActiveInspectionItem;
  onStatusChange: (itemId: string, status: ComplianceStatus, notes?: string) => void;
  accentColor: "emerald" | "red" | "amber" | "slate" | "violet";
  isHoldPoint?: boolean;
}

function ChecklistItemCard({ item, onStatusChange, accentColor, isHoldPoint }: ChecklistItemCardProps) {
  const borderColors = {
    emerald: "border-emerald-500/30",
    red: "border-red-500/30",
    amber: "border-amber-500/30",
    slate: "border-slate-700",
    violet: "border-violet-500/30",
  };

  const bgColors = {
    emerald: "bg-slate-800/50",
    red: "bg-slate-800/50",
    amber: "bg-slate-800/50",
    slate: "bg-slate-800/50",
    violet: "bg-violet-900/20",
  };

  return (
    <div
      className={`p-3 rounded-lg ${bgColors[accentColor]} border ${borderColors[accentColor]} hover:bg-slate-800 transition-colors`}
    >
      <div className="flex items-start gap-2 mb-2">
        {isHoldPoint && (
          <Flag className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground">{item.requirementText}</p>

          {/* Phase and Responsibility */}
          <div className="flex items-center gap-2 mt-1.5 text-xs text-foreground-muted">
            <span className="px-1.5 py-0.5 bg-slate-700 rounded">
              {item.constructionPhase}
            </span>
            {item.responsibility && (
              <span>{item.responsibility}</span>
            )}
          </div>
        </div>
      </div>

      {item.codeReference && (
        <p className="text-xs text-foreground-muted mb-2">
          <span className="text-primary font-mono">{item.codeReference}</span>
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <ActionButton
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            onClick={() => onStatusChange(item.id, "pass")}
            active={item.complianceStatus === "pass"}
            color="emerald"
            tooltip="Pass"
          />
          <ActionButton
            icon={<XCircle className="w-3.5 h-3.5" />}
            onClick={() => onStatusChange(item.id, "fail")}
            active={item.complianceStatus === "fail"}
            color="red"
            tooltip="Fail"
          />
          <ActionButton
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            onClick={() => onStatusChange(item.id, "flag")}
            active={item.complianceStatus === "flag"}
            color="amber"
            tooltip="Flag"
          />
        </div>

        <div className="flex gap-1">
          <button className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded transition-colors">
            <Camera className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded transition-colors">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  onClick,
  active,
  color,
  tooltip,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  active: boolean;
  color: "emerald" | "red" | "amber";
  tooltip: string;
}) {
  const colors = {
    emerald: active ? "bg-emerald-500 text-white" : "text-emerald-400 hover:bg-emerald-500/20",
    red: active ? "bg-red-500 text-white" : "text-red-400 hover:bg-red-500/20",
    amber: active ? "bg-amber-500 text-white" : "text-amber-400 hover:bg-amber-500/20",
  };

  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`p-1.5 rounded transition-colors ${colors[color]}`}
    >
      {icon}
    </button>
  );
}
