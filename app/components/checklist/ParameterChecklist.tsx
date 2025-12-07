"use client";

import { useState, useCallback, useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { VisualVarianceModal } from "./VisualVarianceModal";

// =============================================================================
// Types
// =============================================================================

interface TargetValue {
  min?: number;
  max?: number;
  value?: number;
  unit?: string;
  code_ref?: string;
  context?: string;
}

interface ChecklistItem {
  id: string;
  requirement_text: string;
  code_reference: string;
  parameter_name: string | null;
  target_value: TargetValue | null;
  designed_value: string | null;
  measured_value: string | null;
  unit: string | null;
  comparison_logic: string | null;
  validation_result: "pass" | "fail" | "warning" | "not_measured" | null;
  validation_notes: string | null;
  notes: string | null;
}

interface ParameterChecklistProps {
  items: ChecklistItem[];
  checklistId: string;
  projectId: string;
  onSave?: (itemId: string, measuredValue: string) => Promise<void>;
  onAskExpert?: (query: string) => void;
  readOnly?: boolean;
}

// Build context-aware query for the Code Expert
function buildExpertQuery(item: ChecklistItem, measuredValue: string): string {
  const paramName = item.parameter_name || "this parameter";
  const codeRef = item.code_reference || "the applicable code section";
  const limit = formatCodeLimit(item.target_value, item.comparison_logic);
  const unit = item.unit || "";

  const validation = validateMeasurement(measuredValue, item.target_value, item.comparison_logic);
  const statusText = validation.status === "fail"
    ? "FAILS the requirement"
    : validation.status === "pass"
      ? "passes the requirement"
      : "has not been measured yet";

  let query = `I am inspecting "${paramName}". The code limit is ${limit}${unit ? ` ${unit}` : ""}.`;

  if (measuredValue && measuredValue.trim()) {
    query += ` My measured value is ${measuredValue}${unit ? ` ${unit}` : ""}, which ${statusText}.`;
  }

  query += ` The specific code section is ${codeRef}.`;

  if (validation.status === "fail") {
    query += ` Are there any exceptions, variances, or alternative compliance paths (such as existing building allowances under Chapter 34) that might allow this condition to be acceptable?`;
  } else {
    query += ` Is this acceptable, or are there special conditions I should know about?`;
  }

  return query;
}

interface FormData {
  parameters: Array<{
    id: string;
    measured_value: string;
  }>;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatCodeLimit(targetValue: TargetValue | null, comparisonLogic: string | null): string {
  if (!targetValue) return "—";

  const unit = targetValue.unit || "";

  if (comparisonLogic === "between" && targetValue.min !== undefined && targetValue.max !== undefined) {
    return `${targetValue.min}–${targetValue.max} ${unit}`.trim();
  }

  if (comparisonLogic === "less_than" || comparisonLogic === "less_than_or_equal") {
    const max = targetValue.max ?? targetValue.value;
    if (max !== undefined) {
      return `Max ${max} ${unit}`.trim();
    }
  }

  if (comparisonLogic === "greater_than" || comparisonLogic === "greater_than_or_equal") {
    const min = targetValue.min ?? targetValue.value;
    if (min !== undefined) {
      return `Min ${min} ${unit}`.trim();
    }
  }

  if (comparisonLogic === "equal" && targetValue.value !== undefined) {
    return `${targetValue.value} ${unit}`.trim();
  }

  if (targetValue.max !== undefined) return `Max ${targetValue.max} ${unit}`.trim();
  if (targetValue.min !== undefined) return `Min ${targetValue.min} ${unit}`.trim();
  if (targetValue.value !== undefined) return `${targetValue.value} ${unit}`.trim();

  return "—";
}

function validateMeasurement(
  measured: string,
  targetValue: TargetValue | null,
  comparisonLogic: string | null
): { status: "pass" | "fail" | "warning" | "pending"; message?: string } {
  if (!measured || measured.trim() === "") {
    return { status: "pending" };
  }

  if (!targetValue || !comparisonLogic) {
    return { status: "pass" };
  }

  const measuredNum = parseFloat(measured);
  if (isNaN(measuredNum)) {
    return { status: "pending" };
  }

  switch (comparisonLogic) {
    case "less_than": {
      const limit = targetValue.max ?? targetValue.value;
      if (limit === undefined) return { status: "pass" };
      if (measuredNum < limit) return { status: "pass" };
      return { status: "fail", message: `Exceeds by ${(measuredNum - limit).toFixed(2)}` };
    }

    case "less_than_or_equal": {
      const limit = targetValue.max ?? targetValue.value;
      if (limit === undefined) return { status: "pass" };
      if (measuredNum <= limit) return { status: "pass" };
      return { status: "fail", message: `Exceeds Max by ${(measuredNum - limit).toFixed(2)}` };
    }

    case "greater_than": {
      const limit = targetValue.min ?? targetValue.value;
      if (limit === undefined) return { status: "pass" };
      if (measuredNum > limit) return { status: "pass" };
      return { status: "fail", message: `Below Min by ${(limit - measuredNum).toFixed(2)}` };
    }

    case "greater_than_or_equal": {
      const limit = targetValue.min ?? targetValue.value;
      if (limit === undefined) return { status: "pass" };
      if (measuredNum >= limit) return { status: "pass" };
      return { status: "fail", message: `Below Min by ${(limit - measuredNum).toFixed(2)}` };
    }

    case "between": {
      const { min, max } = targetValue;
      if (min === undefined || max === undefined) return { status: "pass" };
      if (measuredNum >= min && measuredNum <= max) return { status: "pass" };
      if (measuredNum < min) {
        return { status: "fail", message: `Below range by ${(min - measuredNum).toFixed(2)}` };
      }
      return { status: "fail", message: `Above range by ${(measuredNum - max).toFixed(2)}` };
    }

    case "equal": {
      const target = targetValue.value;
      if (target === undefined) return { status: "pass" };
      if (measuredNum === target) return { status: "pass" };
      return { status: "fail", message: `Differs by ${Math.abs(measuredNum - target).toFixed(2)}` };
    }

    default:
      return { status: "pass" };
  }
}

// =============================================================================
// Sub-components
// =============================================================================

function CodeLimitBadge({
  targetValue,
  comparisonLogic,
  codeRef,
  codeText,
}: {
  targetValue: TargetValue | null;
  comparisonLogic: string | null;
  codeRef: string;
  codeText?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const formattedLimit = formatCodeLimit(targetValue, comparisonLogic);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-foreground font-medium">
          {formattedLimit}
        </span>
        <button
          type="button"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => setShowTooltip(!showTooltip)}
          className="p-1 rounded text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors"
          title="View code section"
        >
          <BookIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 left-0 top-full mt-2 w-72 p-3 rounded-lg bg-surface-elevated border border-border shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-primary/10 text-primary border border-primary/20">
              {codeRef}
            </span>
          </div>
          <p className="text-xs text-foreground-secondary leading-relaxed">
            {codeText || "Loading code section text..."}
          </p>
          {targetValue?.context && (
            <p className="text-xs text-foreground-muted mt-2 italic">
              Context: {targetValue.context}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  message,
}: {
  status: "pass" | "fail" | "warning" | "pending";
  message?: string;
}) {
  const config = {
    pass: {
      bg: "bg-success/10",
      border: "border-success/30",
      text: "text-success",
      icon: <CheckIcon className="w-4 h-4" />,
      label: "PASS",
    },
    fail: {
      bg: "bg-danger/10",
      border: "border-danger/30",
      text: "text-danger",
      icon: <XIcon className="w-4 h-4" />,
      label: "FAIL",
    },
    warning: {
      bg: "bg-warning/10",
      border: "border-warning/30",
      text: "text-warning",
      icon: <AlertIcon className="w-4 h-4" />,
      label: "WARNING",
    },
    pending: {
      bg: "bg-foreground-muted/10",
      border: "border-foreground-muted/20",
      text: "text-foreground-muted",
      icon: null,
      label: "Pending",
    },
  };

  const c = config[status];

  return (
    <div className={`inline-flex flex-col items-start gap-0.5 px-3 py-1.5 rounded-lg ${c.bg} border ${c.border}`}>
      <div className={`flex items-center gap-1.5 ${c.text} font-semibold text-sm`}>
        {c.icon}
        {c.label}
      </div>
      {message && status === "fail" && (
        <span className={`text-xs ${c.text}`}>{message}</span>
      )}
    </div>
  );
}

function ParameterRow({
  item,
  index,
  control,
  onBlur,
  onCameraClick,
  onAskExpert,
  readOnly,
  isSaving,
}: {
  item: ChecklistItem;
  index: number;
  control: ReturnType<typeof useForm<FormData>>["control"];
  onBlur: (index: number, value: string) => void;
  onCameraClick: (item: ChecklistItem, index: number) => void;
  onAskExpert?: (item: ChecklistItem, measuredValue: string) => void;
  readOnly?: boolean;
  isSaving?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={`parameters.${index}.measured_value`}
      render={({ field }) => {
        const validation = validateMeasurement(field.value, item.target_value, item.comparison_logic);

        return (
          <tr className="border-b border-border hover:bg-surface-hover/50 transition-colors group">
            {/* Parameter Name */}
            <td className="px-4 py-3">
              <div className="font-medium text-foreground">{item.parameter_name}</div>
              <div className="text-xs text-foreground-muted mt-0.5 line-clamp-1 max-w-xs">
                {item.requirement_text}
              </div>
            </td>

            {/* Code Limit */}
            <td className="px-4 py-3">
              <CodeLimitBadge
                targetValue={item.target_value}
                comparisonLogic={item.comparison_logic}
                codeRef={item.code_reference}
              />
            </td>

            {/* Design Spec */}
            <td className="px-4 py-3">
              <div className="flex items-center gap-1">
                <span className="font-mono text-sm text-foreground-muted">
                  {item.designed_value || "—"}
                </span>
                {item.designed_value && item.unit && (
                  <span className="text-xs text-foreground-muted">{item.unit}</span>
                )}
              </div>
            </td>

            {/* Actual (Input) */}
            <td className="px-4 py-3">
              <div className="relative flex items-center">
                <input
                  type="number"
                  step="0.01"
                  {...field}
                  onBlur={() => onBlur(index, field.value)}
                  disabled={readOnly || isSaving}
                  placeholder="—"
                  className={`
                    w-24 pl-3 pr-10 py-1.5 text-sm font-mono text-right rounded-lg
                    bg-surface border transition-all
                    ${validation.status === "fail"
                      ? "border-danger/50 focus:border-danger focus:ring-2 focus:ring-danger/20"
                      : validation.status === "pass" && field.value
                        ? "border-success/50 focus:border-success focus:ring-2 focus:ring-success/20"
                        : "border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                />
                {/* Camera Button */}
                <button
                  type="button"
                  onClick={() => onCameraClick(item, index)}
                  disabled={readOnly}
                  className="absolute right-2 p-1 rounded text-foreground-muted hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Capture measurement from photo"
                >
                  <CameraIcon className="w-4 h-4" />
                </button>
                {item.unit && (
                  <span className="ml-2 text-xs text-foreground-muted whitespace-nowrap">
                    {item.unit}
                  </span>
                )}
              </div>
            </td>

            {/* Status */}
            <td className="px-4 py-3">
              <StatusBadge status={validation.status} message={validation.message} />
            </td>

            {/* Actions */}
            <td className="px-4 py-3">
              <button
                type="button"
                onClick={() => onAskExpert?.(item, field.value)}
                className={`
                  p-2 rounded-lg transition-all
                  ${validation.status === "fail"
                    ? "bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20"
                    : "bg-surface-hover text-foreground-muted hover:text-primary hover:bg-primary/10"
                  }
                `}
                title="Ask Code Expert for guidance"
              >
                <HelpIcon className="w-4 h-4" />
              </button>
            </td>
          </tr>
        );
      }}
    />
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ParameterChecklist({
  items,
  checklistId,
  projectId,
  onSave,
  onAskExpert,
  readOnly = false,
}: ParameterChecklistProps) {
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set());
  const [visualModalOpen, setVisualModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<{ item: ChecklistItem; index: number } | null>(null);

  // Filter to only show items with parameters
  const parameterItems = items.filter((item) => item.parameter_name);

  // Initialize form with react-hook-form
  const { control, setValue, getValues, watch } = useForm<FormData>({
    defaultValues: {
      parameters: parameterItems.map((item) => ({
        id: item.id,
        measured_value: item.measured_value || "",
      })),
    },
  });

  const watchedParameters = watch("parameters");

  // Calculate summary stats from watched values
  const stats = {
    total: parameterItems.length,
    passed: 0,
    failed: 0,
    pending: 0,
  };

  parameterItems.forEach((item, index) => {
    const value = watchedParameters?.[index]?.measured_value || "";
    const validation = validateMeasurement(value, item.target_value, item.comparison_logic);
    if (validation.status === "pass" && value) stats.passed++;
    else if (validation.status === "fail") stats.failed++;
    else stats.pending++;
  });

  // Handle blur - save to database
  const handleBlur = useCallback(
    async (index: number, value: string) => {
      const item = parameterItems[index];
      if (!item || !onSave) return;

      // Skip if value hasn't changed
      if (value === (item.measured_value || "")) return;

      setSavingItems((prev) => new Set(prev).add(item.id));

      try {
        await onSave(item.id, value);
      } catch (error) {
        console.error("Failed to save measurement:", error);
        // Revert on error
        setValue(`parameters.${index}.measured_value`, item.measured_value || "");
      } finally {
        setSavingItems((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [parameterItems, onSave, setValue]
  );

  // Handle camera click - open visual variance modal
  const handleCameraClick = useCallback((item: ChecklistItem, index: number) => {
    setActiveItem({ item, index });
    setVisualModalOpen(true);
  }, []);

  // Handle dimension detected from visual analysis
  const handleDimensionDetected = useCallback(
    (dimension: number, unit: string) => {
      if (!activeItem) return;

      const { index, item } = activeItem;

      // Update the form value
      setValue(`parameters.${index}.measured_value`, dimension.toString());

      // Trigger save
      handleBlur(index, dimension.toString());

      // Close modal
      setVisualModalOpen(false);
      setActiveItem(null);
    },
    [activeItem, setValue, handleBlur]
  );

  // Handle Ask Expert button - build query and send to Code Expert panel
  const handleAskExpert = useCallback(
    (item: ChecklistItem, measuredValue: string) => {
      if (!onAskExpert) {
        console.log("[ParameterChecklist] onAskExpert not provided");
        return;
      }

      const query = buildExpertQuery(item, measuredValue);
      console.log("[ParameterChecklist] Sending to Code Expert:", query);
      onAskExpert(query);
    },
    [onAskExpert]
  );

  if (parameterItems.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <ClipboardIcon className="w-12 h-12 mx-auto text-foreground-muted mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No Measurable Parameters</h3>
        <p className="text-sm text-foreground-muted">
          This checklist doesn&apos;t have any items with measurable parameters yet.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-hover/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/20 text-primary">
              <ClipboardIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Parameter Checklist</h2>
              <p className="text-sm text-foreground-muted">
                {parameterItems.length} measurable parameters
              </p>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20">
              <CheckIcon className="w-4 h-4 text-success" />
              <span className="text-sm font-semibold text-success">{stats.passed}</span>
              <span className="text-xs text-success/70">Pass</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-danger/10 border border-danger/20">
              <XIcon className="w-4 h-4 text-danger" />
              <span className="text-sm font-semibold text-danger">{stats.failed}</span>
              <span className="text-xs text-danger/70">Fail</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-foreground-muted/10 border border-foreground-muted/20">
              <span className="text-sm font-semibold text-foreground-muted">{stats.pending}</span>
              <span className="text-xs text-foreground-muted">Pending</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-hover/50 border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wider w-1/4">
                  Parameter
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                  Code Limit
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                  Design Spec
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                  Actual
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-foreground-muted uppercase tracking-wider w-16">
                  Help
                </th>
              </tr>
            </thead>
            <tbody>
              {parameterItems.map((item, index) => (
                <ParameterRow
                  key={item.id}
                  item={item}
                  index={index}
                  control={control}
                  onBlur={handleBlur}
                  onCameraClick={handleCameraClick}
                  onAskExpert={handleAskExpert}
                  readOnly={readOnly}
                  isSaving={savingItems.has(item.id)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-surface-hover/30">
          <div className="flex items-center justify-between text-xs text-foreground-muted">
            <span>
              Project: {projectId.substring(0, 8)}... | Checklist: {checklistId.substring(0, 8)}...
            </span>
            <span>
              {stats.passed + stats.failed} of {stats.total} measured
              {savingItems.size > 0 && (
                <span className="ml-2 text-primary animate-pulse">Saving...</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Variance Modal */}
      <VisualVarianceModal
        isOpen={visualModalOpen}
        onClose={() => {
          setVisualModalOpen(false);
          setActiveItem(null);
        }}
        onDimensionDetected={handleDimensionDetected}
        parameterName={activeItem?.item.parameter_name || ""}
        expectedValue={formatCodeLimit(activeItem?.item.target_value || null, activeItem?.item.comparison_logic || null)}
        unit={activeItem?.item.unit || "in"}
      />
    </>
  );
}

// =============================================================================
// Icons
// =============================================================================

function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function AlertIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function ClipboardIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function BookIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function CameraIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  );
}

function HelpIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
    </svg>
  );
}

export default ParameterChecklist;
