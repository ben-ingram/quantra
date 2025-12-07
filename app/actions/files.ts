"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

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

export interface ProjectFile {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  file_type: "glb" | "gltf" | "ifc" | "pdf" | "jpg" | "jpeg" | "png" | "dwg" | "rvt";
  file_size_bytes: number | null;
  uploaded_at: string;
  bim_data?: BimEntityData | null;
  bim_parsed_at?: string | null;
}

export interface BimEntityCount {
  type: string;
  label: string;
  count: number;
  icon?: string;
}

export interface BimEntityData {
  entityCounts: BimEntityCount[];
  buildingName: string | null;
  siteName: string | null;
  projectName: string | null;
  storeyCount: number;
  storeyNames: string[];
  totalElements: number;
  parsedAt: string;
  parseTimeMs: number;
}

export interface UploadFileInput {
  project_id: string;
  file_name: string;
  file_type: ProjectFile["file_type"];
  file_size_bytes?: number;
  file_data: string; // Base64 encoded file data
}

// =============================================================================
// Actions
// =============================================================================

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("[Files] Error fetching project files:", error);
    throw new Error("Failed to fetch project files");
  }

  return data || [];
}

export async function getProjectBimModel(projectId: string): Promise<ProjectFile | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .in("file_type", ["glb", "gltf", "ifc"])
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("[Files] Error fetching BIM model:", error);
    return null;
  }

  return data;
}

export async function uploadProjectFile(input: UploadFileInput): Promise<ProjectFile> {
  // Validate environment variables
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.error("[Files] Missing Supabase environment variables:", {
      hasUrl: !!url,
      hasKey: !!key
    });
    throw new Error("Server configuration error: Missing Supabase credentials");
  }

  const supabase = getSupabaseClient();

  // Decode base64 file data
  const base64Data = input.file_data.split(",")[1] || input.file_data;
  const buffer = Buffer.from(base64Data, "base64");

  console.log("[Files] Uploading file:", {
    fileName: input.file_name,
    fileType: input.file_type,
    bufferSize: buffer.length,
    projectId: input.project_id,
  });

  // Generate unique file path
  const timestamp = Date.now();
  const safeName = input.file_name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const filePath = `projects/${input.project_id}/${timestamp}_${safeName}`;

  console.log("[Files] Storage path:", filePath);

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("project-files")
    .upload(filePath, buffer, {
      contentType: getContentType(input.file_type),
      upsert: false,
    });

  if (uploadError) {
    console.error("[Files] Storage upload error:", {
      message: uploadError.message,
      name: uploadError.name,
      cause: uploadError.cause,
      stack: uploadError.stack,
    });
    throw new Error(`Failed to upload file to storage: ${uploadError.message}`);
  }

  console.log("[Files] Upload successful:", uploadData);

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("project-files")
    .getPublicUrl(filePath);

  const file_url = urlData.publicUrl;

  // Create database record
  const { data, error } = await supabase
    .from("project_files")
    .insert([{
      project_id: input.project_id,
      file_name: input.file_name,
      file_url,
      file_type: input.file_type,
      file_size_bytes: input.file_size_bytes || buffer.length,
    }])
    .select()
    .single();

  if (error) {
    console.error("[Files] Database insert error:", error);
    throw new Error("Failed to save file record");
  }

  revalidatePath(`/project/${input.project_id}`);
  return data;
}

export async function deleteProjectFile(id: string, projectId: string): Promise<void> {
  const supabase = getSupabaseClient();

  // Get file record first
  const { data: file, error: fetchError } = await supabase
    .from("project_files")
    .select("file_url")
    .eq("id", id)
    .single();

  if (fetchError) {
    console.error("[Files] Error fetching file for deletion:", fetchError);
    throw new Error("Failed to find file");
  }

  // Extract storage path from URL
  if (file?.file_url) {
    const url = new URL(file.file_url);
    const storagePath = url.pathname.split("/project-files/")[1];
    if (storagePath) {
      await supabase.storage.from("project-files").remove([storagePath]);
    }
  }

  // Delete database record
  const { error } = await supabase
    .from("project_files")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[Files] Error deleting file:", error);
    throw new Error("Failed to delete file");
  }

  revalidatePath(`/project/${projectId}`);
}

// =============================================================================
// BIM Data Actions
// =============================================================================

/**
 * Save parsed BIM entity data to a project file
 */
export async function saveBimData(
  fileId: string,
  projectId: string,
  bimData: BimEntityData
): Promise<void> {
  const supabase = getSupabaseClient();

  // Update file record with BIM data
  const { error: fileError } = await supabase
    .from("project_files")
    .update({
      bim_data: bimData,
      bim_parsed_at: new Date().toISOString(),
    })
    .eq("id", fileId);

  if (fileError) {
    console.error("[Files] Error saving BIM data to file:", fileError);
    throw new Error("Failed to save BIM data");
  }

  // Generate summary text for checklist generation
  const summaryText = generateBimSummaryText(bimData);

  // Update project with denormalized BIM summary for quick access
  const { error: projectError } = await supabase
    .from("projects")
    .update({
      bim_element_counts: bimData.entityCounts,
      bim_storey_count: bimData.storeyCount,
      bim_total_elements: bimData.totalElements,
      bim_summary_text: summaryText,
    })
    .eq("id", projectId);

  if (projectError) {
    console.error("[Files] Error saving BIM summary to project:", projectError);
    // Don't throw - file was saved successfully
  }

  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/project/${projectId}/hub`);
}

/**
 * Get BIM data for a project (from the most recent BIM file)
 */
export async function getProjectBimData(projectId: string): Promise<BimEntityData | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("project_files")
    .select("bim_data")
    .eq("project_id", projectId)
    .in("file_type", ["ifc", "glb", "gltf"])
    .not("bim_data", "is", null)
    .order("bim_parsed_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("[Files] Error fetching BIM data:", error);
    return null;
  }

  return data?.bim_data as BimEntityData | null;
}

/**
 * Generate summary text for checklist generation context
 */
function generateBimSummaryText(data: BimEntityData): string {
  const lines: string[] = [];

  lines.push("BIM MODEL ANALYSIS:");

  if (data.buildingName) {
    lines.push(`Building: ${data.buildingName}`);
  }

  if (data.storeyCount > 0) {
    lines.push(`Floors: ${data.storeyCount} (${data.storeyNames.slice(0, 5).join(", ")}${data.storeyNames.length > 5 ? "..." : ""})`);
  }

  // Group key elements
  const keyElements = data.entityCounts.filter(e =>
    ["Doors", "Stairs", "Stair Flights", "Windows", "Railings", "Ramps", "Fire Suppression", "Spaces/Rooms"].includes(e.label)
  );

  if (keyElements.length > 0) {
    lines.push("Key Elements:");
    for (const el of keyElements) {
      lines.push(`  ${el.label}: ${el.count}`);
    }
  }

  lines.push(`Total Elements: ${data.totalElements}`);

  return lines.join("\n");
}

// =============================================================================
// Helpers
// =============================================================================

function getContentType(fileType: ProjectFile["file_type"]): string {
  const contentTypes: Record<string, string> = {
    glb: "model/gltf-binary",
    gltf: "model/gltf+json",
    ifc: "application/x-step",
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    dwg: "application/acad",
    rvt: "application/octet-stream",
  };
  return contentTypes[fileType] || "application/octet-stream";
}
