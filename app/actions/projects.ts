"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import type { OccupancyGroup, ConstructionType } from "@/app/lib/constants";

// =============================================================================
// Supabase Client (Server-side)
// =============================================================================

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

// =============================================================================
// Types
// =============================================================================

export type { OccupancyGroup, ConstructionType };

// Quality phase enum (DMAIC-style workflow)
export type QualityPhase = "define" | "plan" | "execute" | "control";

export interface Project {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  address: string | null;
  occupancy_group: OccupancyGroup | null;
  construction_type: ConstructionType | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
  // Quality phase tracking (DMAIC workflow)
  current_phase?: QualityPhase | null;
  phase_entered_at?: string | null;
  define_completed_at?: string | null;
  plan_completed_at?: string | null;
  execute_started_at?: string | null;
  // Extended intake fields
  occupancy_subtype?: string | null;
  mixed_occupancies?: string[] | null;
  occupant_load?: number | null;
  number_of_stories?: number | null;
  building_height_ft?: number | null;
  total_area_sqft?: number | null;
  is_sprinklered?: boolean | null;
  fire_alarm_type?: string | null;
  florida_county?: string | null;
  flood_zone?: string | null;
  wind_speed_mph?: number | null;
  is_coastal_construction?: boolean | null;
  is_high_rise?: boolean | null;
  has_assembly_areas?: boolean | null;
  has_hazardous_materials?: boolean | null;
  has_high_piled_storage?: boolean | null;
  special_features?: string[] | null;
  project_phase?: string | null;
  intake_completed_at?: string | null;
  // BIM data fields
  bim_element_counts?: Array<{ type: string; label: string; count: number; icon?: string }> | null;
  bim_storey_count?: number | null;
  bim_total_elements?: number | null;
  bim_summary_text?: string | null;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  address?: string;
  occupancy_group?: OccupancyGroup;
  construction_type?: ConstructionType;
  cover_image_url?: string;
}

export interface UpdateProjectIntakeInput {
  occupancy_subtype?: string;
  mixed_occupancies?: string[];
  occupant_load?: number;
  number_of_stories?: number;
  building_height_ft?: number;
  total_area_sqft?: number;
  is_sprinklered?: boolean;
  fire_alarm_type?: string;
  florida_county?: string;
  flood_zone?: string;
  wind_speed_mph?: number;
  is_coastal_construction?: boolean;
  is_high_rise?: boolean;
  has_assembly_areas?: boolean;
  has_hazardous_materials?: boolean;
  has_high_piled_storage?: boolean;
  special_features?: string[];
  project_phase?: string;
}

// =============================================================================
// Actions
// =============================================================================

export async function getProjects(): Promise<Project[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Projects] Error fetching projects:", error);
    throw new Error("Failed to fetch projects");
  }

  return data || [];
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("[Projects] Error fetching project:", error);
    throw new Error("Failed to fetch project");
  }

  return data;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("projects")
    .insert([{
      name: input.name,
      description: input.description || null,
      address: input.address || null,
      occupancy_group: input.occupancy_group || null,
      construction_type: input.construction_type || null,
      cover_image_url: input.cover_image_url || null,
    }])
    .select()
    .single();

  if (error) {
    console.error("[Projects] Error creating project:", error);
    throw new Error("Failed to create project");
  }

  revalidatePath("/");
  return data;
}

export async function updateProject(
  id: string,
  updates: Partial<CreateProjectInput>
): Promise<Project> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[Projects] Error updating project:", error);
    throw new Error("Failed to update project");
  }

  revalidatePath("/");
  revalidatePath(`/project/${id}`);
  return data;
}

/**
 * Update project intake details for comprehensive checklist generation
 */
export async function updateProjectIntake(
  id: string,
  intake: UpdateProjectIntakeInput
): Promise<Project> {
  const supabase = getSupabaseClient();

  const updates = {
    ...intake,
    intake_completed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[Projects] Error updating project intake:", error);
    throw new Error("Failed to update project intake");
  }

  revalidatePath("/");
  revalidatePath(`/project/${id}`);
  revalidatePath(`/project/${id}/hub`);
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[Projects] Error deleting project:", error);
    throw new Error("Failed to delete project");
  }

  revalidatePath("/");
}

// =============================================================================
// Quality Phase Management
// =============================================================================

export interface ProjectPhaseStatus {
  projectId: string;
  currentPhase: QualityPhase;
  phaseEnteredAt: string | null;
  defineStatus: "in_progress" | "complete";
  defineCompletedAt: string | null;
  planStatus: "locked" | "in_progress" | "complete";
  planCompletedAt: string | null;
  executeStatus: "locked" | "in_progress" | "complete";
  executeStartedAt: string | null;
  controlStatus: "view_only" | "active";
  specsCount: number;
  bimElementsCount: number;
  approvedManualsCount: number;
  checklistItemsCount: number;
}

/**
 * Get the current phase status for a project
 */
export async function getProjectPhaseStatus(
  projectId: string
): Promise<{ success: boolean; status: ProjectPhaseStatus | null; error?: string }> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("project_phase_status")
      .select("*")
      .eq("project_id", projectId)
      .single();

    if (error) {
      // View may not exist yet, fall back to direct query
      if (error.code === "PGRST116" || error.code === "42P01") {
        const { data: project, error: projError } = await supabase
          .from("projects")
          .select("id, current_phase, phase_entered_at, define_completed_at, plan_completed_at, execute_started_at")
          .eq("id", projectId)
          .single();

        if (projError) {
          return { success: false, status: null, error: projError.message };
        }

        return {
          success: true,
          status: {
            projectId: project.id,
            currentPhase: project.current_phase || "define",
            phaseEnteredAt: project.phase_entered_at,
            defineStatus: project.define_completed_at ? "complete" : "in_progress",
            defineCompletedAt: project.define_completed_at,
            planStatus: !project.define_completed_at ? "locked" : project.plan_completed_at ? "complete" : "in_progress",
            planCompletedAt: project.plan_completed_at,
            executeStatus: !project.plan_completed_at ? "locked" : project.execute_started_at ? "in_progress" : "locked",
            executeStartedAt: project.execute_started_at,
            controlStatus: project.current_phase === "control" ? "active" : "view_only",
            specsCount: 0,
            bimElementsCount: 0,
            approvedManualsCount: 0,
            checklistItemsCount: 0,
          },
        };
      }
      return { success: false, status: null, error: error.message };
    }

    return {
      success: true,
      status: {
        projectId: data.project_id,
        currentPhase: data.current_phase || "define",
        phaseEnteredAt: data.phase_entered_at,
        defineStatus: data.define_status,
        defineCompletedAt: data.define_completed_at,
        planStatus: data.plan_status,
        planCompletedAt: data.plan_completed_at,
        executeStatus: data.execute_status,
        executeStartedAt: data.execute_started_at,
        controlStatus: data.control_status,
        specsCount: data.specs_count || 0,
        bimElementsCount: data.bim_elements_count || 0,
        approvedManualsCount: data.approved_manuals_count || 0,
        checklistItemsCount: data.checklist_items_count || 0,
      },
    };
  } catch (error) {
    console.error("[Projects] Error getting phase status:", error);
    return {
      success: false,
      status: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Advance project to the next phase (if requirements are met)
 */
export async function advanceProjectPhase(
  projectId: string,
  triggerType: "manual" | "specs_uploaded" | "bim_uploaded" | "manual_approved" | "inspection_started" = "manual",
  notes?: string
): Promise<{ success: boolean; newPhase?: QualityPhase; message: string }> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase.rpc("advance_project_phase", {
      p_project_id: projectId,
      p_trigger_type: triggerType,
      p_trigger_details: {},
      p_user_id: null, // Would come from auth in real implementation
      p_notes: notes || null,
    });

    if (error) {
      // RPC function may not exist yet
      if (error.code === "42883") {
        return {
          success: false,
          message: "Phase management not yet initialized. Run the database migration first.",
        };
      }
      return { success: false, message: error.message };
    }

    const result = data?.[0];
    if (!result) {
      return { success: false, message: "No result from phase advance" };
    }

    revalidatePath(`/project/${projectId}`);
    revalidatePath(`/project/${projectId}/hub`);

    return {
      success: result.success,
      newPhase: result.new_phase,
      message: result.message,
    };
  } catch (error) {
    console.error("[Projects] Error advancing phase:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get phase transition history for a project
 */
export async function getPhaseTransitionHistory(
  projectId: string
): Promise<{
  success: boolean;
  transitions: Array<{
    id: string;
    fromPhase: QualityPhase | null;
    toPhase: QualityPhase;
    triggerType: string;
    triggeredAt: string;
    notes: string | null;
  }>;
  error?: string;
}> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("project_phase_transitions")
      .select("*")
      .eq("project_id", projectId)
      .order("triggered_at", { ascending: false });

    if (error) {
      // Table may not exist yet
      if (error.code === "42P01") {
        return { success: true, transitions: [] };
      }
      return { success: false, transitions: [], error: error.message };
    }

    return {
      success: true,
      transitions: (data || []).map((t) => ({
        id: t.id,
        fromPhase: t.from_phase,
        toPhase: t.to_phase,
        triggerType: t.trigger_type,
        triggeredAt: t.triggered_at,
        notes: t.notes,
      })),
    };
  } catch (error) {
    console.error("[Projects] Error getting phase history:", error);
    return {
      success: false,
      transitions: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
