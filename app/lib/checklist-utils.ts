import type { ChecklistItem } from "@/app/lib/supabase";

/**
 * Calculate checklist completion stats
 */
export function calculateChecklistStats(items: ChecklistItem[]): {
  total: number;
  checked: number;
  passed: number;
  failed: number;
  pending: number;
  percentComplete: number;
} {
  const total = items.length;
  const checked = items.filter((i) => i.is_compliant !== null).length;
  const passed = items.filter((i) => i.is_compliant === true).length;
  const failed = items.filter((i) => i.is_compliant === false).length;
  const pending = total - checked;
  const percentComplete = total > 0 ? Math.round((checked / total) * 100) : 0;

  return { total, checked, passed, failed, pending, percentComplete };
}
