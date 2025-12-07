"use server";

import { revalidatePath } from "next/cache";
import {
  getServiceClient,
  type Checklist,
  type ChecklistItem,
} from "@/app/lib/supabase";

// =============================================================================
// Types
// =============================================================================

export type { Checklist, ChecklistItem };

export interface ChecklistWithItems extends Checklist {
  items: ChecklistItemWithMetadata[];
}

export interface ChecklistItemWithMetadata extends ChecklistItem {
  metadata?: {
    riskLevel?: "critical" | "high" | "medium" | "low";
    category?: string;
  } | null;
}

export interface GenerateChecklistInput {
  projectId: string;
  projectDescription: string;
  checklistTitle?: string;
  focusAreas?: string[];
  // Occupancy context for RAG filtering
  occupancyGroup?: string;
  constructionType?: string;
}

export interface GenerateChecklistResponse {
  success: boolean;
  checklist?: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    itemCount: number;
  };
  items?: Array<{
    id: string;
    requirementText: string;
    codeReference: string | null;
    sortOrder: number;
    metadata: {
      riskLevel?: string;
      category?: string;
    } | null;
  }>;
  stats?: {
    textChunksUsed: number;
    tablesUsed: number;
    embeddingTime: number;
    searchTime: number;
  };
  error?: string;
}

// =============================================================================
// Checklist CRUD Operations
// =============================================================================

/**
 * Get all checklists for a project
 */
export async function getProjectChecklists(
  projectId: string
): Promise<Checklist[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("checklists")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Checklists] Error fetching checklists:", error);
    throw new Error(`Failed to fetch checklists: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a checklist with all its items
 */
export async function getChecklistWithItems(
  checklistId: string
): Promise<ChecklistWithItems | null> {
  const supabase = getServiceClient();

  // Get checklist
  const { data: checklist, error: checklistError } = await supabase
    .from("checklists")
    .select("*")
    .eq("id", checklistId)
    .single();

  if (checklistError) {
    if (checklistError.code === "PGRST116") return null;
    console.error("[Checklists] Error fetching checklist:", checklistError);
    throw new Error(`Failed to fetch checklist: ${checklistError.message}`);
  }

  // Get items
  const { data: items, error: itemsError } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("checklist_id", checklistId)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    console.error("[Checklists] Error fetching items:", itemsError);
    throw new Error(`Failed to fetch checklist items: ${itemsError.message}`);
  }

  // Parse metadata from notes field
  const itemsWithMetadata: ChecklistItemWithMetadata[] = (items || []).map(
    (item) => ({
      ...item,
      metadata: item.notes ? safeParseJSON(item.notes) : null,
    })
  );

  return {
    ...checklist,
    items: itemsWithMetadata,
  };
}

/**
 * Create a new checklist
 */
export async function createChecklist(input: {
  projectId: string;
  title: string;
  description?: string;
}): Promise<Checklist> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("checklists")
    .insert({
      project_id: input.projectId,
      title: input.title,
      description: input.description || null,
      status: "draft",
    })
    .select()
    .single();

  if (error) {
    console.error("[Checklists] Error creating checklist:", error);
    throw new Error(`Failed to create checklist: ${error.message}`);
  }

  revalidatePath(`/project/${input.projectId}/hub`);
  return data;
}

/**
 * Update a checklist
 */
export async function updateChecklist(
  checklistId: string,
  updates: {
    title?: string;
    description?: string;
    status?: Checklist["status"];
  }
): Promise<Checklist> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("checklists")
    .update(updates)
    .eq("id", checklistId)
    .select()
    .single();

  if (error) {
    console.error("[Checklists] Error updating checklist:", error);
    throw new Error(`Failed to update checklist: ${error.message}`);
  }

  return data;
}

/**
 * Delete a checklist (cascades to items)
 */
export async function deleteChecklist(
  checklistId: string,
  projectId: string
): Promise<void> {
  const supabase = getServiceClient();

  // Delete items first (if no cascade)
  await supabase.from("checklist_items").delete().eq("checklist_id", checklistId);

  // Delete checklist
  const { error } = await supabase
    .from("checklists")
    .delete()
    .eq("id", checklistId);

  if (error) {
    console.error("[Checklists] Error deleting checklist:", error);
    throw new Error(`Failed to delete checklist: ${error.message}`);
  }

  revalidatePath(`/project/${projectId}/hub`);
}

// =============================================================================
// Checklist Item Operations
// =============================================================================

/**
 * Add an item to a checklist
 */
export async function addChecklistItem(input: {
  checklistId: string;
  requirementText: string;
  codeReference?: string;
  sortOrder?: number;
}): Promise<ChecklistItem> {
  const supabase = getServiceClient();

  // Get max sort order if not provided
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const { data: maxItem } = await supabase
      .from("checklist_items")
      .select("sort_order")
      .eq("checklist_id", input.checklistId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    sortOrder = (maxItem?.sort_order ?? -1) + 1;
  }

  const { data, error } = await supabase
    .from("checklist_items")
    .insert({
      checklist_id: input.checklistId,
      requirement_text: input.requirementText,
      code_reference: input.codeReference || null,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) {
    console.error("[Checklists] Error adding item:", error);
    throw new Error(`Failed to add checklist item: ${error.message}`);
  }

  return data;
}

/**
 * Update a checklist item
 */
export async function updateChecklistItem(
  itemId: string,
  updates: {
    requirementText?: string;
    codeReference?: string;
    notes?: string;
    sortOrder?: number;
  }
): Promise<ChecklistItem> {
  const supabase = getServiceClient();

  const dbUpdates: Record<string, unknown> = {};
  if (updates.requirementText !== undefined) {
    dbUpdates.requirement_text = updates.requirementText;
  }
  if (updates.codeReference !== undefined) {
    dbUpdates.code_reference = updates.codeReference;
  }
  if (updates.notes !== undefined) {
    dbUpdates.notes = updates.notes;
  }
  if (updates.sortOrder !== undefined) {
    dbUpdates.sort_order = updates.sortOrder;
  }

  const { data, error } = await supabase
    .from("checklist_items")
    .update(dbUpdates)
    .eq("id", itemId)
    .select()
    .single();

  if (error) {
    console.error("[Checklists] Error updating item:", error);
    throw new Error(`Failed to update checklist item: ${error.message}`);
  }

  return data;
}

/**
 * Compliance status types
 */
export type ComplianceStatus = "pending" | "pass" | "fail" | "flag" | "na";

export interface ComplianceDecision {
  itemId: string;
  status: ComplianceStatus;
  notes?: string;
  failNotes?: string;
  flagReason?: string;
  evidenceUrls?: string[];
  inspectorName?: string;
}

/**
 * Mark a checklist item as compliant/non-compliant (legacy support)
 */
export async function markItemCompliance(
  itemId: string,
  isCompliant: boolean | null,
  notes?: string
): Promise<ChecklistItem> {
  // Convert boolean to new status system
  const status: ComplianceStatus = isCompliant === null
    ? "pending"
    : isCompliant
      ? "pass"
      : "fail";

  return updateItemComplianceStatus({
    itemId,
    status,
    notes,
    failNotes: !isCompliant ? notes : undefined,
  });
}

/**
 * Update checklist item compliance status with full audit trail
 */
export async function updateItemComplianceStatus(
  decision: ComplianceDecision
): Promise<ChecklistItem> {
  const supabase = getServiceClient();

  // First, get the current item state for audit logging
  const { data: currentItem, error: fetchError } = await supabase
    .from("checklist_items")
    .select("*, checklists(project_id)")
    .eq("id", decision.itemId)
    .single();

  if (fetchError) {
    console.error("[Checklists] Error fetching item for compliance update:", fetchError);
    throw new Error(`Failed to fetch checklist item: ${fetchError.message}`);
  }

  const previousStatus = currentItem.compliance_status || "pending";
  const projectId = currentItem.checklists?.project_id;

  // Build the update object
  const updates: Record<string, unknown> = {
    compliance_status: decision.status,
    is_compliant: decision.status === "pass" ? true : decision.status === "fail" ? false : null,
    checked_at: decision.status !== "pending" ? new Date().toISOString() : null,
    inspected_at: decision.status !== "pending" ? new Date().toISOString() : null,
  };

  if (decision.notes !== undefined) {
    updates.notes = decision.notes;
  }

  if (decision.failNotes !== undefined) {
    updates.fail_notes = decision.failNotes;
  }

  if (decision.flagReason !== undefined) {
    updates.flag_reason = decision.flagReason;
  }

  if (decision.evidenceUrls !== undefined) {
    updates.evidence_urls = decision.evidenceUrls;
  }

  if (decision.inspectorName !== undefined) {
    updates.inspector_name = decision.inspectorName;
  }

  // Update the checklist item
  const { data, error } = await supabase
    .from("checklist_items")
    .update(updates)
    .eq("id", decision.itemId)
    .select()
    .single();

  if (error) {
    console.error("[Checklists] Error updating compliance status:", error);
    throw new Error(`Failed to update compliance status: ${error.message}`);
  }

  // Log to compliance audit trail
  if (projectId) {
    await logComplianceDecision({
      checklistItemId: decision.itemId,
      checklistId: currentItem.checklist_id,
      projectId,
      action: statusToAction(decision.status),
      previousStatus: previousStatus === "pass" ? true : previousStatus === "fail" ? false : null,
      newStatus: decision.status === "pass" ? true : decision.status === "fail" ? false : null,
      notes: decision.notes || decision.failNotes || decision.flagReason,
      inspectorName: decision.inspectorName,
    });
  }

  return data;
}

/**
 * Log a compliance decision to the audit trail
 */
async function logComplianceDecision(params: {
  checklistItemId: string;
  checklistId: string;
  projectId: string;
  action: string;
  previousStatus: boolean | null;
  newStatus: boolean | null;
  notes?: string;
  photoEvidenceUrl?: string;
  inspectorName?: string;
}): Promise<void> {
  const supabase = getServiceClient();

  try {
    // Get the last compliance log hash for chain linking
    const { data: lastLog } = await supabase
      .from("checklist_item_compliance_log")
      .select("checksum")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const previousHash = lastLog?.checksum || null;
    const timestamp = new Date().toISOString();

    // Generate checksum for tamper-evidence
    const hashContent = JSON.stringify({
      action: params.action,
      item_id: params.checklistItemId,
      previous_status: params.previousStatus,
      new_status: params.newStatus,
      notes: params.notes || null,
      timestamp,
      previous_hash: previousHash,
    });

    // Simple hash using base64 (in production, use proper crypto)
    const checksum = Buffer.from(hashContent).toString("base64").slice(0, 64);

    // Insert the log entry
    const { error } = await supabase
      .from("checklist_item_compliance_log")
      .insert({
        checklist_item_id: params.checklistItemId,
        checklist_id: params.checklistId,
        project_id: params.projectId,
        action: params.action,
        previous_status: params.previousStatus,
        new_status: params.newStatus,
        notes: params.notes,
        photo_evidence_url: params.photoEvidenceUrl,
        inspector_name: params.inspectorName,
        checksum,
        previous_hash: previousHash,
      });

    if (error) {
      console.error("[Checklists] Error logging compliance decision:", error);
      // Don't throw - audit logging failure shouldn't block the operation
    }
  } catch (err) {
    console.error("[Checklists] Exception logging compliance decision:", err);
    // Don't throw - audit logging failure shouldn't block the operation
  }
}

/**
 * Convert compliance status to action string
 */
function statusToAction(status: ComplianceStatus): string {
  switch (status) {
    case "pass":
      return "MARKED_PASS";
    case "fail":
      return "MARKED_FAIL";
    case "flag":
      return "MARKED_FLAG";
    case "na":
      return "MARKED_NA";
    case "pending":
    default:
      return "CLEARED";
  }
}

/**
 * Get compliance history for a checklist item
 */
export async function getItemComplianceHistory(itemId: string): Promise<Array<{
  id: string;
  action: string;
  previousStatus: boolean | null;
  newStatus: boolean | null;
  notes: string | null;
  inspectorName: string | null;
  createdAt: string;
}>> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("checklist_item_compliance_log")
    .select("*")
    .eq("checklist_item_id", itemId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Checklists] Error fetching compliance history:", error);
    throw new Error(`Failed to fetch compliance history: ${error.message}`);
  }

  return (data || []).map((log) => ({
    id: log.id,
    action: log.action,
    previousStatus: log.previous_status,
    newStatus: log.new_status,
    notes: log.notes,
    inspectorName: log.inspector_name,
    createdAt: log.created_at,
  }));
}

/**
 * Delete a checklist item
 */
export async function deleteChecklistItem(itemId: string): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from("checklist_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    console.error("[Checklists] Error deleting item:", error);
    throw new Error(`Failed to delete checklist item: ${error.message}`);
  }
}

// =============================================================================
// Generate Checklist via API
// =============================================================================

/**
 * Generate a checklist using SUPER RAG
 * This calls the /api/generate-checklist endpoint
 */
export async function generateChecklist(
  input: GenerateChecklistInput
): Promise<GenerateChecklistResponse> {
  // Get the base URL from environment or construct it
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}/api/generate-checklist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: input.projectId,
        projectDescription: input.projectDescription,
        checklistTitle: input.checklistTitle,
        focusAreas: input.focusAreas,
        occupancyGroup: input.occupancyGroup,
        constructionType: input.constructionType,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Failed to generate checklist",
      };
    }

    revalidatePath(`/project/${input.projectId}/hub`);

    return {
      success: true,
      checklist: data.checklist,
      items: data.items,
      stats: data.stats,
    };
  } catch (error) {
    console.error("[Checklists] Error generating checklist:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate checklist",
    };
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

function safeParseJSON(str: string): Record<string, unknown> | null {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
