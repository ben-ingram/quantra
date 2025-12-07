import { createClient } from "@supabase/supabase-js";

// =============================================================================
// Supabase Client
// =============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Client-side Supabase client (uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client (uses service key for bypassing RLS)
export function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// =============================================================================
// Types
// =============================================================================

export type OccupancyGroup =
  | "Assembly"
  | "Business"
  | "Educational"
  | "Factory"
  | "High Hazard"
  | "Institutional"
  | "Mercantile"
  | "Residential"
  | "Storage"
  | "Utility";

export type ConstructionType =
  | "Type I-A"
  | "Type I-B"
  | "Type II-A"
  | "Type II-B"
  | "Type III-A"
  | "Type III-B"
  | "Type IV"
  | "Type V-A"
  | "Type V-B";

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
}

export interface ProjectFile {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  file_type: "glb" | "gltf" | "ifc" | "pdf" | "jpg" | "jpeg" | "png" | "dwg" | "rvt";
  file_size_bytes: number | null;
  uploaded_at: string;
}

export interface Checklist {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: "draft" | "active" | "completed" | "archived";
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  requirement_text: string;
  code_reference: string | null;
  is_compliant: boolean | null;
  notes: string | null;
  rfi_link: string | null;
  checked_at: string | null;
  checked_by: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Project Operations
// =============================================================================

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Supabase] Error fetching projects:", error);
    throw error;
  }

  return data || [];
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("[Supabase] Error fetching project:", error);
    throw error;
  }

  return data;
}

export async function createProject(project: {
  name: string;
  description?: string;
  address?: string;
  occupancy_group?: OccupancyGroup;
  construction_type?: ConstructionType;
  cover_image_url?: string;
}): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert([project])
    .select()
    .single();

  if (error) {
    console.error("[Supabase] Error creating project:", error);
    throw error;
  }

  return data;
}

export async function updateProject(
  id: string,
  updates: Partial<Omit<Project, "id" | "created_at" | "updated_at">>
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[Supabase] Error updating project:", error);
    throw error;
  }

  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) {
    console.error("[Supabase] Error deleting project:", error);
    throw error;
  }
}

// =============================================================================
// Project Files Operations
// =============================================================================

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const { data, error } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("[Supabase] Error fetching project files:", error);
    throw error;
  }

  return data || [];
}

export async function createProjectFile(file: {
  project_id: string;
  file_name: string;
  file_url: string;
  file_type: ProjectFile["file_type"];
  file_size_bytes?: number;
}): Promise<ProjectFile> {
  const { data, error } = await supabase
    .from("project_files")
    .insert([file])
    .select()
    .single();

  if (error) {
    console.error("[Supabase] Error creating project file:", error);
    throw error;
  }

  return data;
}

export async function deleteProjectFile(id: string): Promise<void> {
  const { error } = await supabase.from("project_files").delete().eq("id", id);

  if (error) {
    console.error("[Supabase] Error deleting project file:", error);
    throw error;
  }
}

// =============================================================================
// Checklist Operations
// =============================================================================

export async function getChecklists(projectId: string): Promise<Checklist[]> {
  const { data, error } = await supabase
    .from("checklists")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Supabase] Error fetching checklists:", error);
    throw error;
  }

  return data || [];
}

export async function getChecklist(id: string): Promise<Checklist | null> {
  const { data, error } = await supabase
    .from("checklists")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("[Supabase] Error fetching checklist:", error);
    throw error;
  }

  return data;
}

export async function createChecklist(checklist: {
  project_id: string;
  title: string;
  description?: string;
  status?: Checklist["status"];
}): Promise<Checklist> {
  const { data, error } = await supabase
    .from("checklists")
    .insert([{ status: "draft", ...checklist }])
    .select()
    .single();

  if (error) {
    console.error("[Supabase] Error creating checklist:", error);
    throw error;
  }

  return data;
}

export async function updateChecklist(
  id: string,
  updates: Partial<Omit<Checklist, "id" | "created_at" | "updated_at">>
): Promise<Checklist> {
  const { data, error } = await supabase
    .from("checklists")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[Supabase] Error updating checklist:", error);
    throw error;
  }

  return data;
}

export async function deleteChecklist(id: string): Promise<void> {
  const { error } = await supabase.from("checklists").delete().eq("id", id);

  if (error) {
    console.error("[Supabase] Error deleting checklist:", error);
    throw error;
  }
}

// =============================================================================
// Checklist Items Operations
// =============================================================================

export async function getChecklistItems(checklistId: string): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("checklist_id", checklistId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[Supabase] Error fetching checklist items:", error);
    throw error;
  }

  return data || [];
}

export async function createChecklistItem(item: {
  checklist_id: string;
  requirement_text: string;
  code_reference?: string;
  sort_order?: number;
}): Promise<ChecklistItem> {
  const { data, error } = await supabase
    .from("checklist_items")
    .insert([item])
    .select()
    .single();

  if (error) {
    console.error("[Supabase] Error creating checklist item:", error);
    throw error;
  }

  return data;
}

export async function updateChecklistItem(
  id: string,
  updates: Partial<Omit<ChecklistItem, "id" | "created_at" | "updated_at">>
): Promise<ChecklistItem> {
  const { data, error } = await supabase
    .from("checklist_items")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[Supabase] Error updating checklist item:", error);
    throw error;
  }

  return data;
}

export async function deleteChecklistItem(id: string): Promise<void> {
  const { error } = await supabase.from("checklist_items").delete().eq("id", id);

  if (error) {
    console.error("[Supabase] Error deleting checklist item:", error);
    throw error;
  }
}

// Mark checklist item as compliant/non-compliant
export async function markChecklistItemCompliance(
  id: string,
  isCompliant: boolean | null,
  notes?: string
): Promise<ChecklistItem> {
  const updates: Partial<ChecklistItem> = {
    is_compliant: isCompliant,
    checked_at: isCompliant !== null ? new Date().toISOString() : null,
  };

  if (notes !== undefined) {
    updates.notes = notes;
  }

  return updateChecklistItem(id, updates);
}
