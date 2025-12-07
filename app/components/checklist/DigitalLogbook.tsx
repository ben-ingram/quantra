"use client";

import { useState, useCallback } from "react";

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

interface DigitalLogbookProps {
  items: ChecklistItem[];
  checklistId: string;
  onMeasurementUpdate?: (itemId: string, measuredValue: string) => Promise<void>;
  readOnly?: boolean;
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
      const op = comparisonLogic === "less_than" ? "<" : "≤";
      return `${op} ${max} ${unit}`.trim();
    }
  }

  if (comparisonLogic === "greater_than" || comparisonLogic === "greater_than_or_equal") {
    const min = targetValue.min ?? targetValue.value;
    if (min !== undefined) {
      const op = comparisonLogic === "greater_than" ? ">" : "≥";
      return `${op} ${min} ${unit}`.trim();
    }
  }

  if (comparisonLogic === "equal" && targetValue.value !== undefined) {
    return `= ${targetValue.value} ${unit}`.trim();
  }

  // Fallback: show any available value
  if (targetValue.max !== undefined) return `Max ${targetValue.max} ${unit}`.trim();
  if (targetValue.min !== undefined) return `Min ${targetValue.min} ${unit}`.trim();
  if (targetValue.value !== undefined) return `${targetValue.value} ${unit}`.trim();

  return "—";
}

function validateMeasurement(
  measured: string,
  targetValue: TargetValue | null,
  comparisonLogic: string | null
): { status: "pass" | "fail" | "warning"; message?: string } {
  if (!measured || !targetValue || !comparisonLogic) {
    return { status: "pass" };
  }

  const measuredNum = parseFloat(measured);
  if (isNaN(measuredNum)) {
    return { status: "pass" };
  }

  const tolerance = 0.05; // 5% tolerance for warnings

  switch (comparisonLogic) {
    case "less_than": {
      const limit = targetValue.max ?? targetValue.value;
      if (limit === undefined) return { status: "pass" };
      if (measuredNum < limit) return { status: "pass" };
      if (measuredNum < limit * (1 + tolerance)) {
        return { status: "warning", message: `Near limit (${(measuredNum - limit).toFixed(2)} over)` };
      }
      return { status: "fail", message: `Exceeds limit by ${(measuredNum - limit).toFixed(2)}` };
    }

    case "less_than_or_equal": {
      const limit = targetValue.max ?? targetValue.value;
      if (limit === undefined) return { status: "pass" };
      if (measuredNum <= limit) return { status: "pass" };
      if (measuredNum <= limit * (1 + tolerance)) {
        return { status: "warning", message: `Near limit (${(measuredNum - limit).toFixed(2)} over)` };
      }
      return { status: "fail", message: `Exceeds Max by ${(measuredNum - limit).toFixed(2)}` };
    }

    case "greater_than": {
      const limit = targetValue.min ?? targetValue.value;
      if (limit === undefined) return { status: "pass" };
      if (measuredNum > limit) return { status: "pass" };
      if (measuredNum > limit * (1 - tolerance)) {
        return { status: "warning", message: `Near minimum (${(limit - measuredNum).toFixed(2)} under)` };
      }
      return { status: "fail", message: `Below Min by ${(limit - measuredNum).toFixed(2)}` };
    }

    case "greater_than_or_equal": {
      const limit = targetValue.min ?? targetValue.value;
      if (limit === undefined) return { status: "pass" };
      if (measuredNum >= limit) return { status: "pass" };
      if (measuredNum >= limit * (1 - tolerance)) {
        return { status: "warning", message: `Near minimum (${(limit - measuredNum).toFixed(2)} under)` };
      }
      return { status: "fail", message: `Below Min by ${(limit - measuredNum).toFixed(2)}` };
    }

    case "between": {
      const { min, max } = targetValue;
      if (min === undefined || max === undefined) return { status: "pass" };
      if (measuredNum >= min && measuredNum <= max) return { status: "pass" };
      if (measuredNum >= min * (1 - tolerance) && measuredNum <= max * (1 + tolerance)) {
        return { status: "warning", message: "Near range boundary" };
      }
      if (measuredNum < min) {
        return { status: "fail", message: `Below range by ${(min - measuredNum).toFixed(2)}` };
      }
      return { status: "fail", message: `Above range by ${(measuredNum - max).toFixed(2)}` };
    }

    case "equal": {
      const target = targetValue.value;
      if (target === undefined) return { status: "pass" };
      if (measuredNum === target) return { status: "pass" };
      const diff = Math.abs(measuredNum - target);
      if (diff <= Math.abs(target * tolerance)) {
        return { status: "warning", message: `Off by ${diff.toFixed(2)}` };
      }
      return { status: "fail", message: `Differs by ${diff.toFixed(2)}` };
    }

    default:
      return { status: "pass" };
  }
}

// =============================================================================
// Sub-components
// =============================================================================

function CodeBadge({
  codeRef,
  codeText,
  onClick
}: {
  codeRef: string;
  codeText?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/40 transition-all cursor-pointer"
      title={codeText || "Click to view code section"}
    >
      <BookIcon className="w-3 h-3" />
      {codeRef}
    </button>
  );
}

function StatusBadge({
  status,
  message
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
      border: "border-foreground-muted/30",
      text: "text-foreground-muted",
      icon: <ClockIcon className="w-4 h-4" />,
      label: "Pending",
    },
  };

  const c = config[status];

  return (
    <div className={`inline-flex flex-col items-center gap-1 px-3 py-2 rounded-lg ${c.bg} border ${c.border}`}>
      <div className={`flex items-center gap-1.5 ${c.text} font-semibold text-sm`}>
        {c.icon}
        {c.label}
      </div>
      {message && (
        <span className={`text-xs ${c.text} opacity-80`}>{message}</span>
      )}
    </div>
  );
}

function MeasurementInput({
  value,
  unit,
  onChange,
  onBlur,
  disabled,
}: {
  value: string;
  unit: string | null;
  onChange: (value: string) => void;
  onBlur: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder="—"
        className="w-20 px-2 py-1.5 text-sm font-mono text-center rounded-md bg-surface border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {unit && (
        <span className="text-xs text-foreground-muted">{unit}</span>
      )}
    </div>
  );
}

function LogbookRow({
  item,
  onMeasurementUpdate,
  readOnly,
  onCodeClick,
}: {
  item: ChecklistItem;
  onMeasurementUpdate?: (itemId: string, measuredValue: string) => Promise<void>;
  readOnly?: boolean;
  onCodeClick?: (codeRef: string) => void;
}) {
  const [localMeasured, setLocalMeasured] = useState(item.measured_value || "");
  const [isUpdating, setIsUpdating] = useState(false);

  // Calculate validation status
  const hasParameter = !!item.parameter_name;
  const hasMeasurement = !!localMeasured && localMeasured.trim() !== "";

  let displayStatus: "pass" | "fail" | "warning" | "pending" = "pending";
  let statusMessage: string | undefined;

  if (hasMeasurement && hasParameter) {
    const validation = validateMeasurement(localMeasured, item.target_value, item.comparison_logic);
    displayStatus = validation.status;
    statusMessage = validation.message;
  }

  const handleBlur = useCallback(async () => {
    if (localMeasured !== item.measured_value && onMeasurementUpdate) {
      setIsUpdating(true);
      try {
        await onMeasurementUpdate(item.id, localMeasured);
      } catch (error) {
        console.error("Failed to update measurement:", error);
        // Revert on error
        setLocalMeasured(item.measured_value || "");
      } finally {
        setIsUpdating(false);
      }
    }
  }, [localMeasured, item.measured_value, item.id, onMeasurementUpdate]);

  // Only show rows that have parameters (measurable items)
  if (!hasParameter) {
    return null;
  }

  return (
    <tr className="border-b border-border hover:bg-surface-hover/50 transition-colors">
      {/* Element Name */}
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{item.parameter_name}</div>
        <div className="text-xs text-foreground-muted mt-0.5 line-clamp-1">
          {item.requirement_text}
        </div>
      </td>

      {/* Code Limit */}
      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-1">
          <span className="font-mono text-sm text-foreground">
            {formatCodeLimit(item.target_value, item.comparison_logic)}
          </span>
          <CodeBadge
            codeRef={item.code_reference}
            onClick={() => onCodeClick?.(item.code_reference)}
          />
        </div>
      </td>

      {/* Design Value */}
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
        <MeasurementInput
          value={localMeasured}
          unit={item.unit}
          onChange={setLocalMeasured}
          onBlur={handleBlur}
          disabled={readOnly || isUpdating}
        />
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={displayStatus} message={statusMessage} />
      </td>
    </tr>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function DigitalLogbook({
  items,
  checklistId,
  onMeasurementUpdate,
  readOnly = false,
}: DigitalLogbookProps) {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  // Filter to only show items with parameters
  const parameterItems = items.filter((item) => item.parameter_name);

  // Calculate summary stats
  const stats = {
    total: parameterItems.length,
    passed: parameterItems.filter((i) => i.validation_result === "pass").length,
    failed: parameterItems.filter((i) => i.validation_result === "fail").length,
    warnings: parameterItems.filter((i) => i.validation_result === "warning").length,
    pending: parameterItems.filter((i) => !i.measured_value || i.validation_result === "not_measured").length,
  };

  const handleCodeClick = (codeRef: string) => {
    setSelectedCode(codeRef);
    // TODO: Open code section modal/drawer
    console.log("View code section:", codeRef);
  };

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
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-hover/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/20 text-primary">
            <ClipboardIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Digital Logbook</h2>
            <p className="text-sm text-foreground-muted">
              {parameterItems.length} measurable parameters
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20">
            <CheckIcon className="w-4 h-4 text-success" />
            <span className="text-sm font-medium text-success">{stats.passed}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-danger/10 border border-danger/20">
            <XIcon className="w-4 h-4 text-danger" />
            <span className="text-sm font-medium text-danger">{stats.failed}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warning/10 border border-warning/20">
            <AlertIcon className="w-4 h-4 text-warning" />
            <span className="text-sm font-medium text-warning">{stats.warnings}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-foreground-muted/10 border border-foreground-muted/20">
            <ClockIcon className="w-4 h-4 text-foreground-muted" />
            <span className="text-sm font-medium text-foreground-muted">{stats.pending}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-hover/50 border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                Element
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                Limit (Code)
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                Design (Plan)
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                Actual (Input)
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {parameterItems.map((item) => (
              <LogbookRow
                key={item.id}
                item={item}
                onMeasurementUpdate={onMeasurementUpdate}
                readOnly={readOnly}
                onCodeClick={handleCodeClick}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-border bg-surface-hover/30">
        <div className="flex items-center justify-between text-xs text-foreground-muted">
          <span>Checklist ID: {checklistId}</span>
          <span>
            {stats.total - stats.pending} of {stats.total} measured
          </span>
        </div>
      </div>

      {/* Code Section Modal (placeholder) */}
      {selectedCode && (
        <CodeSectionModal
          codeRef={selectedCode}
          onClose={() => setSelectedCode(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Code Section Modal (placeholder)
// =============================================================================

function CodeSectionModal({
  codeRef,
  onClose,
}: {
  codeRef: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 text-primary">
              <BookIcon className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-foreground">{codeRef}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <XCloseIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-foreground-muted">
            Loading code section content...
          </p>
          {/* TODO: Fetch and display actual code section text */}
        </div>
      </div>
    </div>
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

function XCloseIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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

function ClockIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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

export default DigitalLogbook;
