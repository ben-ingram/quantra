"use server";

import { getServiceClient } from "@/app/lib/supabase";
import { openai, MODELS } from "@/app/lib/openai";

// =============================================================================
// Types
// =============================================================================

export interface QualityManual {
  id: string;
  project_id: string;
  title: string;
  version: number;
  status: "draft" | "approved" | "archived";
  content: {
    sections: Array<{
      title: string;
      content: string;
      order: number;
    }>;
  };
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionTestPlan {
  id: string;
  quality_manual_id: string;
  project_id: string;
  construction_phase: string;
  csi_division: string | null;
  sort_order: number;
  activity: string;
  description: string | null;
  responsibility: string;
  inspector_role: string | null;
  frequency: string;
  timing: string | null;
  is_hold_point: boolean;
  hold_point_release_by: string | null;
  spec_reference: string | null;
  code_reference: string | null;
  standard_reference: string | null;
  acceptance_criteria: string | null;
  parameter_name: string | null;
  target_value: Record<string, unknown> | null;
  status: "active" | "inactive" | "completed";
  checklist_item_id: string | null;
  // Foreign key to project_specs - links ITP directly to source spec
  spec_source_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface QualityManualWithITPs extends QualityManual {
  inspection_test_plans: InspectionTestPlan[];
}

// =============================================================================
// Get or Create Quality Manual
// =============================================================================

export async function getOrCreateQualityManual(
  projectId: string
): Promise<{ success: boolean; manual?: QualityManual; itps?: InspectionTestPlan[]; error?: string }> {
  const supabase = getServiceClient();

  // First, try to get existing quality manual
  const { data: existing, error: fetchError } = await supabase
    .from("quality_manuals")
    .select("*")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (existing && !fetchError) {
    // Fetch ITPs for this manual
    const { data: itps } = await supabase
      .from("inspection_test_plans")
      .select("*")
      .eq("quality_manual_id", existing.id)
      .order("construction_phase")
      .order("sort_order");

    return {
      success: true,
      manual: existing as QualityManual,
      itps: (itps || []) as InspectionTestPlan[],
    };
  }

  // Create a new quality manual
  const { data: newManual, error: createError } = await supabase
    .from("quality_manuals")
    .insert({
      project_id: projectId,
      title: "Project Quality Manual",
      version: 1,
      status: "draft",
      content: {
        sections: [
          {
            title: "1. Introduction",
            content: "This Quality Manual establishes the quality management system for the project. It defines the inspection and testing requirements to ensure compliance with project specifications and applicable building codes.",
            order: 1,
          },
          {
            title: "2. Scope",
            content: "This manual applies to all construction activities on this project. It covers quality control procedures, inspection requirements, and acceptance criteria for all work.",
            order: 2,
          },
          {
            title: "3. Responsibilities",
            content: "**Contractor:** Responsible for implementing quality control measures and self-inspection.\n\n**Quality Control Inspector:** Responsible for verification inspections and documentation.\n\n**Owner's Representative:** Responsible for final acceptance and hold point releases.",
            order: 3,
          },
          {
            title: "4. Inspection Test Plans",
            content: "The following Inspection Test Plans (ITPs) define the specific inspection requirements for each construction phase. Items marked as **Hold Points** require formal release before work can proceed.",
            order: 4,
          },
          {
            title: "5. Documentation",
            content: "All inspection results shall be documented using the project's digital checklist system. Non-conformances shall be logged and tracked to resolution.",
            order: 5,
          },
        ],
      },
    })
    .select()
    .single();

  if (createError) {
    console.error("[QualityManual] Error creating manual:", createError);
    return { success: false, error: createError.message };
  }

  return {
    success: true,
    manual: newManual as QualityManual,
    itps: [],
  };
}

// =============================================================================
// Update Quality Manual Content
// =============================================================================

export async function updateQualityManualContent(
  manualId: string,
  content: QualityManual["content"]
): Promise<{ success: boolean; error?: string }> {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from("quality_manuals")
    .update({ content })
    .eq("id", manualId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =============================================================================
// Generate ITPs for Quality Manual
// =============================================================================

const ITP_GENERATION_SYSTEM_PROMPT = `You are a Quality Engineer. You must generate an Inspection Test Plan (ITP) based STRICTLY on the provided project specifications.

CRITICAL RULES:
1. ONLY create ITPs for items that are EXPLICITLY mentioned in the project specifications
2. DO NOT hallucinate or invent requirements - every ITP must trace back to a spec
3. Use the EXACT parameter names from the specs (e.g., "Verify Stair Riser Height", "Concrete Slump Test")
4. Cite the specific CSI Section from the spec (e.g., "05 51 00", "03 30 00")
5. Extract numeric limits from the specs for acceptance_criteria and target_value

OUTPUT FORMAT:
Return a JSON object with an "items" array. Each item MUST have:
{
  "activity": "Specific inspection action from spec (e.g., 'Verify Stair Riser Height')",
  "description": "Detailed description of what to inspect",
  "construction_phase": "Phase name (Foundation, Structure, MEP, Finishes, etc.)",
  "csi_division": "CSI division from spec (e.g., '05 51 00')",
  "spec_reference": "Full spec section reference",
  "responsibility": "Who performs (Contractor, QC Inspector, Third Party)",
  "inspector_role": "Specific role (Structural Inspector, MEP Inspector, etc.)",
  "frequency": "100% of locations, Each Pour, Daily, etc.",
  "timing": "When to inspect",
  "is_hold_point": true/false (true for structural/life-safety critical items),
  "hold_point_release_by": "Who releases hold point if applicable",
  "acceptance_criteria": "Pass/fail criteria with EXACT values from spec",
  "parameter_name": "Measurable parameter name",
  "target_value": { "min": number, "max": number, "value": number, "unit": "string" }
}

HOLD POINT GUIDANCE:
Mark is_hold_point: true for:
- Structural welds and connections
- Concrete placement/curing
- Fire-rated assemblies
- Waterproofing at critical details
- Anchor bolt placement
- Rebar inspection before pour`;

export async function generateITPs(
  projectId: string,
  manualId: string,
  projectDescription?: string,
  occupancyGroup?: string,
  constructionType?: string
): Promise<{ success: boolean; itps?: InspectionTestPlan[]; itemsGenerated?: number; error?: string }> {
  try {
    const supabase = getServiceClient();

    // ==========================================================================
    // STEP 1: Fetch Project Specs from project_specs table (REQUIRED)
    // ==========================================================================
    console.log("[GenerateITPs] Fetching specs from project_specs for project:", projectId);

    const { data: specData, error: specsError } = await supabase
      .from("project_specs")
      .select("*")
      .eq("project_id", projectId);

    if (specsError) {
      console.error("[GenerateITPs] Error fetching specs:", specsError);
      return { success: false, itemsGenerated: 0, error: `Database error: ${specsError.message}` };
    }

    // CRITICAL: Fail if no specs found
    if (!specData || specData.length === 0) {
      return {
        success: false,
        itemsGenerated: 0,
        error: "No Project Specifications found. Please upload specs in the 'Define' phase.",
      };
    }

    console.log(`[GenerateITPs] Found ${specData.length} specs in project_specs`);

    // ==========================================================================
    // STEP 2: Fetch BIM Metadata (Optional but recommended)
    // ==========================================================================
    console.log("[GenerateITPs] Fetching BIM metadata for context...");

    const { data: bimData } = await supabase
      .from("model_elements")
      .select("category, name, type_name, level, properties")
      .eq("project_id", projectId)
      .limit(50);

    console.log(`[GenerateITPs] Found ${bimData?.length || 0} BIM elements for context`);

    // ==========================================================================
    // STEP 3: Delete existing ITPs for this manual (regeneration)
    // ==========================================================================
    await supabase
      .from("inspection_test_plans")
      .delete()
      .eq("quality_manual_id", manualId);

    // ==========================================================================
    // STEP 4: Construct the Prompt with ACTUAL data
    // ==========================================================================
    // Include spec IDs so we can link ITPs back to source specs
    const specsWithIds = specData.map((spec) => ({
      spec_id: spec.id,
      csi_division: spec.csi_division,
      section_title: spec.section_title,
      parameter_name: spec.parameter_name,
      requirement_text: spec.requirement_text,
      min_value: spec.min_value,
      max_value: spec.max_value,
      target_value: spec.target_value,
      unit: spec.unit,
    }));

    const userPrompt = `Here are the Project Specifications (JSON):
${JSON.stringify(specsWithIds, null, 2)}

Here is the BIM Data (JSON):
${JSON.stringify(bimData || [], null, 2)}

Project Context:
- Description: ${projectDescription || "Construction project"}
- Occupancy Group: ${occupancyGroup || "Not specified"}
- Construction Type: ${constructionType || "Not specified"}

TASK: Create a JSON array of ITP items based STRICTLY on the project specifications above.

CRITICAL: For EACH ITP, you MUST include the "spec_source_id" field set to the "spec_id" from the source specification.

For EACH specification requirement:
1. Set "spec_source_id" to the spec_id from the source spec (UUID string) - THIS IS REQUIRED
2. Create an ITP with the EXACT parameter from the spec (e.g., "Verify Stair Riser Height")
3. Set spec_reference to the CSI Section (e.g., "05 51 00")
4. Set acceptance_criteria using the EXACT min/max/target values from the spec
5. Set frequency based on text inference (e.g., "100% of locations", "Each Pour")
6. Set responsibility - default to "Quality Inspector" unless spec says otherwise
7. Determine is_hold_point based on criticality:
   - Structural items = true
   - Fire/life safety = true
   - Dimensional tolerances = false (unless structural)
8. Set target_value with min, max, value, unit from the spec data

Generate one ITP for EACH unique parameter_name in the specs.
If a spec has both min and max values, include both in acceptance_criteria.

Return JSON: { "items": [...] }`;

    // ==========================================================================
    // STEP 5: Call OpenAI to generate ITPs
    // ==========================================================================
    const completion = await openai.chat.completions.create({
      model: MODELS.REASONING,
      messages: [
        { role: "system", content: ITP_GENERATION_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2, // Low temperature for consistent, factual output
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      return { success: false, itemsGenerated: 0, error: "No response from LLM" };
    }

    // Parse response
    const parsed = JSON.parse(responseContent);
    const items = parsed.items || parsed.itps || [];

    if (items.length === 0) {
      return { success: false, itemsGenerated: 0, error: "No ITPs generated from specifications" };
    }

    console.log(`[GenerateITPs] LLM generated ${items.length} ITPs`);

    // ==========================================================================
    // STEP 6: Insert ITPs into database
    // ==========================================================================
    // Build a map of spec_ids to validate they exist
    const validSpecIds = new Set(specData.map((s) => s.id));

    const itpsToInsert = items.map((item: Record<string, unknown>, index: number) => {
      // Validate spec_source_id if provided
      const specSourceId = item.spec_source_id as string | null;
      const validatedSpecSourceId = specSourceId && validSpecIds.has(specSourceId) ? specSourceId : null;

      return {
        quality_manual_id: manualId,
        project_id: projectId,
        construction_phase: item.construction_phase || "General",
        csi_division: item.csi_division || null,
        sort_order: index,
        activity: item.activity || "Inspection Activity",
        description: item.description || null,
        responsibility: item.responsibility || "Quality Inspector",
        inspector_role: item.inspector_role || null,
        frequency: item.frequency || "Each Occurrence",
        timing: item.timing || null,
        is_hold_point: item.is_hold_point || false,
        hold_point_release_by: item.hold_point_release_by || null,
        spec_reference: item.spec_reference || null,
        code_reference: item.code_reference || null,
        standard_reference: item.standard_reference || null,
        acceptance_criteria: item.acceptance_criteria || null,
        parameter_name: item.parameter_name || null,
        target_value: item.target_value || null,
        status: "active",
        // Link to source spec
        spec_source_id: validatedSpecSourceId,
      };
    });

    const { data: insertedItps, error: insertError } = await supabase
      .from("inspection_test_plans")
      .insert(itpsToInsert)
      .select();

    if (insertError) {
      console.error("[GenerateITPs] Insert error:", insertError);
      return { success: false, itemsGenerated: 0, error: insertError.message };
    }

    console.log(`[GenerateITPs] Successfully inserted ${insertedItps?.length || 0} ITPs`);

    return {
      success: true,
      itps: (insertedItps || []) as InspectionTestPlan[],
      itemsGenerated: insertedItps?.length || 0,
    };
  } catch (error) {
    console.error("[QualityManual] Error generating ITPs:", error);
    return {
      success: false,
      itemsGenerated: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Update ITP
// =============================================================================

export async function updateITP(
  itpId: string,
  updates: Partial<InspectionTestPlan>
): Promise<{ success: boolean; error?: string }> {
  const supabase = getServiceClient();

  // Remove fields that shouldn't be updated directly
  const { id, quality_manual_id, project_id, created_at, updated_at, ...safeUpdates } = updates as Record<string, unknown>;

  const { error } = await supabase
    .from("inspection_test_plans")
    .update(safeUpdates)
    .eq("id", itpId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =============================================================================
// Delete ITP
// =============================================================================

export async function deleteITP(itpId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from("inspection_test_plans")
    .delete()
    .eq("id", itpId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =============================================================================
// Approve Quality Manual and Generate Checklists
// =============================================================================

export async function approveQualityManual(
  manualId: string,
  projectId: string,
  approvedBy?: string,
  approvalNotes?: string
): Promise<{
  success: boolean;
  newPhase?: string;
  checklistsGenerated?: number;
  checklistItemsGenerated?: number;
  error?: string;
}> {
  const supabase = getServiceClient();

  try {
    // 1. Get the quality manual and its ITPs
    const { data: manual, error: manualError } = await supabase
      .from("quality_manuals")
      .select("*, inspection_test_plans(*)")
      .eq("id", manualId)
      .single();

    if (manualError || !manual) {
      return {
        success: false,
        checklistsGenerated: 0,
        checklistItemsGenerated: 0,
        error: "Quality manual not found",
      };
    }

    const itps = manual.inspection_test_plans as InspectionTestPlan[];

    if (itps.length === 0) {
      return {
        success: false,
        checklistsGenerated: 0,
        checklistItemsGenerated: 0,
        error: "No ITPs to convert to checklists",
      };
    }

    // 2. Group ITPs by construction phase
    const itpsByPhase = new Map<string, InspectionTestPlan[]>();
    for (const itp of itps) {
      const phase = itp.construction_phase;
      if (!itpsByPhase.has(phase)) {
        itpsByPhase.set(phase, []);
      }
      itpsByPhase.get(phase)!.push(itp);
    }

    // 3. Create a checklist for each phase
    let totalChecklists = 0;
    let totalItems = 0;

    for (const [phase, phaseItps] of itpsByPhase) {
      // Create checklist
      const { data: checklist, error: checklistError } = await supabase
        .from("checklists")
        .insert({
          project_id: manual.project_id,
          title: `${phase} - Quality Inspection Checklist`,
          description: `Generated from Quality Manual v${manual.version}. Contains ${phaseItps.length} inspection items.`,
          status: "active",
        })
        .select()
        .single();

      if (checklistError || !checklist) {
        console.error(`[QualityManual] Error creating checklist for ${phase}:`, checklistError);
        continue;
      }

      totalChecklists++;

      // Create checklist items from ITPs
      const checklistItems = phaseItps.map((itp, index) => {
        // Build requirement text
        let requirementText = itp.activity;
        if (itp.is_hold_point) {
          requirementText = `[HOLD POINT] ${requirementText}`;
        }
        if (itp.acceptance_criteria) {
          requirementText += ` - Criteria: ${itp.acceptance_criteria}`;
        }

        // Build code reference
        const refs: string[] = [];
        if (itp.code_reference) refs.push(itp.code_reference);
        if (itp.spec_reference) refs.push(`Spec: ${itp.spec_reference}`);
        if (itp.standard_reference) refs.push(itp.standard_reference);
        const codeReference = refs.length > 0 ? refs.join(" | ") : null;

        // Build notes
        const notes: Record<string, unknown> = {
          source: "quality_manual",
          quality_manual_id: manualId,
          itp_id: itp.id,
          responsibility: itp.responsibility,
          inspector_role: itp.inspector_role,
          frequency: itp.frequency,
          timing: itp.timing,
          is_hold_point: itp.is_hold_point,
          hold_point_release_by: itp.hold_point_release_by,
          riskLevel: itp.is_hold_point ? "critical" : "medium",
          category: phase,
        };

        return {
          checklist_id: checklist.id,
          requirement_text: requirementText,
          code_reference: codeReference,
          sort_order: index,
          notes: JSON.stringify(notes),
          parameter_name: itp.parameter_name,
          target_value: itp.target_value,
          unit: itp.target_value?.unit || null,
          comparison_logic: itp.target_value ? determineComparisonLogic(itp.target_value) : null,
          validation_result: "not_measured",
        };
      });

      const { data: insertedItems, error: itemsError } = await supabase
        .from("checklist_items")
        .insert(checklistItems)
        .select("id");

      if (itemsError) {
        console.error(`[QualityManual] Error creating items for ${phase}:`, itemsError);
        continue;
      }

      totalItems += insertedItems?.length || 0;

      // 4. Link ITPs back to checklist items
      if (insertedItems) {
        for (let i = 0; i < phaseItps.length && i < insertedItems.length; i++) {
          await supabase
            .from("inspection_test_plans")
            .update({ checklist_item_id: insertedItems[i].id })
            .eq("id", phaseItps[i].id);
        }
      }
    }

    // 5. Update quality manual status to approved
    const { error: approveError } = await supabase
      .from("quality_manuals")
      .update({
        status: "approved",
        approved_by: approvedBy || "system",
        approved_at: new Date().toISOString(),
        approval_notes: approvalNotes || null,
      })
      .eq("id", manualId);

    if (approveError) {
      console.error("[QualityManual] Error approving manual:", approveError);
    }

    // 6. Activate the inspection plan (create unified checklist with hold points first)
    const activationResult = await activateInspectionPlan(projectId, manualId);
    if (!activationResult.success) {
      console.warn("[QualityManual] Activation warning:", activationResult.error);
    }

    // 7. Advance project phase to "execute" (inspect)
    const { error: phaseError } = await supabase
      .from("projects")
      .update({ current_phase: "execute" })
      .eq("id", projectId);

    if (phaseError) {
      console.error("[QualityManual] Error advancing phase:", phaseError);
    }

    return {
      success: true,
      newPhase: "execute",
      checklistsGenerated: totalChecklists,
      checklistItemsGenerated: totalItems,
    };
  } catch (error) {
    console.error("[QualityManual] Error approving manual:", error);
    return {
      success: false,
      checklistsGenerated: 0,
      checklistItemsGenerated: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Helper to determine comparison logic from target value
function determineComparisonLogic(targetValue: Record<string, unknown>): string {
  if (targetValue.min !== undefined && targetValue.max !== undefined) {
    return "between";
  } else if (targetValue.min !== undefined) {
    return "greater_than_or_equal";
  } else if (targetValue.max !== undefined) {
    return "less_than_or_equal";
  }
  return "equal";
}

// =============================================================================
// Activate Inspection Plan - Copy ITPs to Live Checklist
// =============================================================================

export interface ActivatedChecklistItem {
  id: string;
  itpId: string;
  inspectionItem: string;
  constructionPhase: string;
  isHoldPoint: boolean;
  acceptanceCriteria: string | null;
  codeReference: string | null;
  parameterName: string | null;
  targetValue: Record<string, unknown> | null;
  designedValue: string | null;
  unit: string | null;
  comparisonLogic: string | null;
  responsibleParty: string;
  inspectionFrequency: string;
}

export interface ActivationResult {
  success: boolean;
  checklistId?: string;
  itemsCreated: number;
  holdPointCount: number;
  error?: string;
}

/**
 * Activate an approved Quality Manual's inspection plan.
 * Creates a single unified checklist with all ITPs, prioritizing hold points.
 * Designed to work with the ParameterChecklist component (Design vs Code vs Actual).
 */
export async function activateInspectionPlan(
  projectId: string,
  manualId: string
): Promise<ActivationResult> {
  const supabase = getServiceClient();

  try {
    // 1. Verify manual is approved
    const { data: manual, error: manualError } = await supabase
      .from("quality_manuals")
      .select("*, inspection_test_plans(*)")
      .eq("id", manualId)
      .eq("status", "approved")
      .single();

    if (manualError || !manual) {
      return {
        success: false,
        itemsCreated: 0,
        holdPointCount: 0,
        error: "Quality manual not found or not approved",
      };
    }

    const itps = manual.inspection_test_plans as InspectionTestPlan[];

    if (itps.length === 0) {
      return {
        success: false,
        itemsCreated: 0,
        holdPointCount: 0,
        error: "No inspection test plans found in the manual",
      };
    }

    // 2. Check if inspection checklist already exists for this manual
    const { data: existingChecklist } = await supabase
      .from("checklists")
      .select("id")
      .eq("project_id", projectId)
      .ilike("title", `%Quality Manual v${manual.version}%`)
      .single();

    if (existingChecklist) {
      // Return existing checklist info
      const { count: itemCount } = await supabase
        .from("checklist_items")
        .select("*", { count: "exact", head: true })
        .eq("checklist_id", existingChecklist.id);

      const holdPointCount = itps.filter((itp) => itp.is_hold_point).length;

      return {
        success: true,
        checklistId: existingChecklist.id,
        itemsCreated: itemCount || 0,
        holdPointCount,
        error: undefined,
      };
    }

    // 3. Sort ITPs: Hold points first, then by construction phase
    const sortedItps = [...itps].sort((a, b) => {
      // Hold points come first
      if (a.is_hold_point && !b.is_hold_point) return -1;
      if (!a.is_hold_point && b.is_hold_point) return 1;
      // Then by construction phase
      const phaseOrder = ["Foundation", "Structure", "Rough-In", "Envelope", "MEP", "Interior", "Final"];
      const aPhaseIdx = phaseOrder.indexOf(a.construction_phase);
      const bPhaseIdx = phaseOrder.indexOf(b.construction_phase);
      if (aPhaseIdx !== bPhaseIdx) return aPhaseIdx - bPhaseIdx;
      // Then by sort order
      return a.sort_order - b.sort_order;
    });

    // 4. Create unified inspection checklist
    const holdPointCount = sortedItps.filter((itp) => itp.is_hold_point).length;
    const today = new Date().toISOString().split("T")[0];

    const { data: checklist, error: checklistError } = await supabase
      .from("checklists")
      .insert({
        project_id: projectId,
        title: `Active Inspection Plan - Quality Manual v${manual.version}`,
        description: `${sortedItps.length} inspection items | ${holdPointCount} hold points | Activated ${today}`,
        status: "active",
      })
      .select()
      .single();

    if (checklistError || !checklist) {
      console.error("[ActivateInspection] Error creating checklist:", checklistError);
      return {
        success: false,
        itemsCreated: 0,
        holdPointCount: 0,
        error: "Failed to create inspection checklist",
      };
    }

    // 5. Create checklist items from sorted ITPs
    const checklistItems = sortedItps.map((itp, index) => {
      // Build requirement text with hold point prefix
      let requirementText = itp.activity;
      if (itp.is_hold_point) {
        requirementText = `[HOLD POINT] ${requirementText}`;
      }

      // Build code reference string
      const refs: string[] = [];
      if (itp.code_reference) refs.push(itp.code_reference);
      if (itp.spec_reference) refs.push(`Spec: ${itp.spec_reference}`);
      if (itp.standard_reference) refs.push(itp.standard_reference);
      const codeReference = refs.length > 0 ? refs.join(" | ") : null;

      // Build metadata for the notes field
      const metadata = {
        source: "quality_manual_activation",
        quality_manual_id: manualId,
        quality_manual_version: manual.version,
        itp_id: itp.id,
        construction_phase: itp.construction_phase,
        responsibility: itp.responsibility,
        inspector_role: itp.inspector_role,
        frequency: itp.frequency,
        timing: itp.timing,
        is_hold_point: itp.is_hold_point,
        hold_point_release_by: itp.hold_point_release_by,
        riskLevel: itp.is_hold_point ? "critical" : "medium",
        category: itp.construction_phase,
        csi_division: itp.csi_division,
      };

      return {
        checklist_id: checklist.id,
        requirement_text: requirementText,
        code_reference: codeReference,
        sort_order: index,
        notes: JSON.stringify(metadata),
        // Parameter validation fields
        parameter_name: itp.parameter_name,
        target_value: itp.target_value,
        designed_value: null, // Will be filled from BIM data if available
        measured_value: null, // Inspector will fill this
        unit: itp.target_value?.unit as string || null,
        comparison_logic: itp.target_value ? determineComparisonLogic(itp.target_value as Record<string, unknown>) : null,
        validation_result: "not_measured",
        // Additional ITP fields mapped to checklist
        acceptance_criteria: itp.acceptance_criteria,
        // Compliance tracking
        compliance_status: "pending",
        is_compliant: null,
      };
    });

    const { data: insertedItems, error: itemsError } = await supabase
      .from("checklist_items")
      .insert(checklistItems)
      .select("id");

    if (itemsError) {
      console.error("[ActivateInspection] Error creating items:", itemsError);
      return {
        success: false,
        itemsCreated: 0,
        holdPointCount: 0,
        error: `Failed to create checklist items: ${itemsError.message}`,
      };
    }

    // 6. Link ITPs back to checklist items
    if (insertedItems) {
      for (let i = 0; i < sortedItps.length && i < insertedItems.length; i++) {
        await supabase
          .from("inspection_test_plans")
          .update({ checklist_item_id: insertedItems[i].id })
          .eq("id", sortedItps[i].id);
      }
    }

    console.log(`[ActivateInspection] Created ${insertedItems?.length || 0} items for project ${projectId}`);

    return {
      success: true,
      checklistId: checklist.id,
      itemsCreated: insertedItems?.length || 0,
      holdPointCount,
    };
  } catch (error) {
    console.error("[ActivateInspection] Error:", error);
    return {
      success: false,
      itemsCreated: 0,
      holdPointCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Get Active Inspection Checklist for Project
// =============================================================================

export interface ActiveInspectionItem {
  id: string;
  itpId: string | null;
  requirementText: string;
  codeReference: string | null;
  constructionPhase: string;
  isHoldPoint: boolean;
  acceptanceCriteria: string | null;
  parameterName: string | null;
  targetValue: Record<string, unknown> | null;
  designedValue: string | null;
  measuredValue: string | null;
  unit: string | null;
  comparisonLogic: string | null;
  validationResult: string | null;
  complianceStatus: string;
  responsibility: string | null;
  inspectorRole: string | null;
  frequency: string | null;
  sortOrder: number;
}

export interface ActiveInspectionChecklist {
  checklistId: string;
  title: string;
  description: string | null;
  qualityManualVersion: number;
  items: ActiveInspectionItem[];
  stats: {
    total: number;
    holdPoints: number;
    passed: number;
    failed: number;
    flagged: number;
    pending: number;
  };
}

/**
 * Get the active inspection checklist for a project (from approved Quality Manual).
 * Returns items grouped and sorted with hold points first.
 */
export async function getActiveInspectionChecklist(
  projectId: string
): Promise<{ success: boolean; data?: ActiveInspectionChecklist; error?: string }> {
  const supabase = getServiceClient();

  try {
    // Find the active inspection checklist (created by activateInspectionPlan)
    const { data: checklist, error: checklistError } = await supabase
      .from("checklists")
      .select("*")
      .eq("project_id", projectId)
      .eq("status", "active")
      .ilike("title", "%Active Inspection Plan%")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (checklistError || !checklist) {
      // No active inspection checklist found
      return {
        success: false,
        error: "No active inspection plan found. Please approve a Quality Manual first.",
      };
    }

    // Get all items for this checklist
    const { data: items, error: itemsError } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("checklist_id", checklist.id)
      .order("sort_order", { ascending: true });

    if (itemsError) {
      return {
        success: false,
        error: `Failed to fetch inspection items: ${itemsError.message}`,
      };
    }

    // Parse items and extract metadata
    const parsedItems: ActiveInspectionItem[] = (items || []).map((item) => {
      const metadata = item.notes ? safeParseJSON(item.notes) : null;

      return {
        id: item.id,
        itpId: (metadata?.itp_id as string) || null,
        requirementText: item.requirement_text,
        codeReference: item.code_reference,
        constructionPhase: (metadata?.construction_phase as string) || "General",
        isHoldPoint: (metadata?.is_hold_point as boolean) || false,
        acceptanceCriteria: item.acceptance_criteria || null,
        parameterName: item.parameter_name,
        targetValue: item.target_value,
        designedValue: item.designed_value,
        measuredValue: item.measured_value,
        unit: item.unit,
        comparisonLogic: item.comparison_logic,
        validationResult: item.validation_result,
        complianceStatus: item.compliance_status || "pending",
        responsibility: (metadata?.responsibility as string) || null,
        inspectorRole: (metadata?.inspector_role as string) || null,
        frequency: (metadata?.frequency as string) || null,
        sortOrder: item.sort_order,
      };
    });

    // Calculate stats
    const stats = {
      total: parsedItems.length,
      holdPoints: parsedItems.filter((i) => i.isHoldPoint).length,
      passed: parsedItems.filter((i) => i.complianceStatus === "pass").length,
      failed: parsedItems.filter((i) => i.complianceStatus === "fail").length,
      flagged: parsedItems.filter((i) => i.complianceStatus === "flag").length,
      pending: parsedItems.filter((i) => i.complianceStatus === "pending").length,
    };

    // Extract version from title
    const versionMatch = checklist.title.match(/v(\d+)/);
    const qualityManualVersion = versionMatch ? parseInt(versionMatch[1], 10) : 1;

    return {
      success: true,
      data: {
        checklistId: checklist.id,
        title: checklist.title,
        description: checklist.description,
        qualityManualVersion,
        items: parsedItems,
        stats,
      },
    };
  } catch (error) {
    console.error("[GetActiveInspection] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Helper to safely parse JSON
function safeParseJSON(str: string): Record<string, unknown> | null {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// =============================================================================
// Revert to Draft (Create New Version)
// =============================================================================

export async function revertManualToDraft(
  manualId: string
): Promise<{ success: boolean; newManualId?: string; error?: string }> {
  const supabase = getServiceClient();

  // Get current manual
  const { data: current, error: fetchError } = await supabase
    .from("quality_manuals")
    .select("*, inspection_test_plans(*)")
    .eq("id", manualId)
    .single();

  if (fetchError || !current) {
    return { success: false, error: "Manual not found" };
  }

  // Archive current version
  await supabase
    .from("quality_manuals")
    .update({ status: "archived" })
    .eq("id", manualId);

  // Create new version
  const { data: newManual, error: createError } = await supabase
    .from("quality_manuals")
    .insert({
      project_id: current.project_id,
      title: current.title,
      version: current.version + 1,
      status: "draft",
      content: current.content,
    })
    .select()
    .single();

  if (createError || !newManual) {
    return { success: false, error: createError?.message || "Failed to create new version" };
  }

  // Copy ITPs to new manual
  const itps = current.inspection_test_plans as InspectionTestPlan[];
  if (itps.length > 0) {
    const itpsCopy = itps.map((itp) => ({
      quality_manual_id: newManual.id,
      project_id: current.project_id,
      construction_phase: itp.construction_phase,
      csi_division: itp.csi_division,
      sort_order: itp.sort_order,
      activity: itp.activity,
      description: itp.description,
      responsibility: itp.responsibility,
      inspector_role: itp.inspector_role,
      frequency: itp.frequency,
      timing: itp.timing,
      is_hold_point: itp.is_hold_point,
      hold_point_release_by: itp.hold_point_release_by,
      spec_reference: itp.spec_reference,
      code_reference: itp.code_reference,
      standard_reference: itp.standard_reference,
      acceptance_criteria: itp.acceptance_criteria,
      parameter_name: itp.parameter_name,
      target_value: itp.target_value,
      status: "active",
      checklist_item_id: null, // Don't copy the link
    }));

    await supabase.from("inspection_test_plans").insert(itpsCopy);
  }

  return { success: true, newManualId: newManual.id };
}
