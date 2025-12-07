"use server";

import { getServiceClient } from "@/app/lib/supabase";
import { generateEmbedding } from "@/app/lib/ingestion/embeddings";

// =============================================================================
// Types
// =============================================================================

export interface BimElementProperties {
  id: string;
  globalId: string;
  name: string | null;
  category: string;
  subcategory: string | null;
  level: string | null;
  levelElevation: number | null;
  typeName: string | null;
  typeId: string | null;

  // Dimensions
  volume: number | null;
  area: number | null;
  length: number | null;
  height: number | null;
  width: number | null;
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  } | null;

  // Full properties from IFC
  properties: Record<string, unknown>;

  // System (for MEP)
  systemName: string | null;
  systemType: string | null;

  // Classification
  masterformatCode: string | null;
  uniformatCode: string | null;
  omniclassCode: string | null;

  // Source
  sourceFile: string | null;
  ifcSchema: string | null;

  // Status
  status: string;
  phase: string | null;
}

export interface BimElementSummary {
  id: string;
  globalId: string;
  name: string | null;
  category: string;
  level: string | null;
  typeName: string | null;
}

// =============================================================================
// Get Element Properties by Global ID
// =============================================================================

/**
 * Fetch full element properties from Supabase by global ID
 * This is called on-demand when user clicks an element in 3D viewer
 */
export async function getElementProperties(
  projectId: string,
  globalId: string
): Promise<{ success: boolean; element: BimElementProperties | null; error?: string }> {
  try {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("model_elements")
      .select("*")
      .eq("project_id", projectId)
      .eq("global_id", globalId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found
        return { success: false, element: null, error: "Element not found" };
      }
      console.error("[BimElements] Error fetching element:", error);
      return { success: false, element: null, error: error.message };
    }

    const element: BimElementProperties = {
      id: data.id,
      globalId: data.global_id,
      name: data.name,
      category: data.category,
      subcategory: data.subcategory,
      level: data.level,
      levelElevation: data.level_elevation,
      typeName: data.type_name,
      typeId: data.type_id,
      volume: data.volume,
      area: data.area,
      length: data.length,
      height: data.height,
      width: data.width,
      boundingBox: data.bounding_box,
      properties: data.properties || {},
      systemName: data.system_name,
      systemType: data.system_type,
      masterformatCode: data.masterformat_code,
      uniformatCode: data.uniformat_code,
      omniclassCode: data.omniclass_code,
      sourceFile: data.source_file,
      ifcSchema: data.ifc_schema,
      status: data.status,
      phase: data.phase,
    };

    return { success: true, element };
  } catch (error) {
    console.error("[BimElements] Error:", error);
    return {
      success: false,
      element: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Get Element Properties by Name (Fallback)
// =============================================================================

/**
 * Fetch element by name pattern (for when globalId is not available in mesh userData)
 */
export async function getElementByName(
  projectId: string,
  name: string
): Promise<{ success: boolean; element: BimElementProperties | null; error?: string }> {
  try {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("model_elements")
      .select("*")
      .eq("project_id", projectId)
      .ilike("name", `%${name}%`)
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: false, element: null, error: "Element not found" };
      }
      return { success: false, element: null, error: error.message };
    }

    const element: BimElementProperties = {
      id: data.id,
      globalId: data.global_id,
      name: data.name,
      category: data.category,
      subcategory: data.subcategory,
      level: data.level,
      levelElevation: data.level_elevation,
      typeName: data.type_name,
      typeId: data.type_id,
      volume: data.volume,
      area: data.area,
      length: data.length,
      height: data.height,
      width: data.width,
      boundingBox: data.bounding_box,
      properties: data.properties || {},
      systemName: data.system_name,
      systemType: data.system_type,
      masterformatCode: data.masterformat_code,
      uniformatCode: data.uniformat_code,
      omniclassCode: data.omniclass_code,
      sourceFile: data.source_file,
      ifcSchema: data.ifc_schema,
      status: data.status,
      phase: data.phase,
    };

    return { success: true, element };
  } catch (error) {
    return {
      success: false,
      element: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Get Elements Summary for Project (Lightweight)
// =============================================================================

/**
 * Get lightweight element summaries for building element list
 * Does NOT include full properties - use for UI lists
 */
export async function getProjectElementsSummary(
  projectId: string,
  options?: {
    category?: string;
    level?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{
  success: boolean;
  elements: BimElementSummary[];
  totalCount: number;
  error?: string;
}> {
  try {
    const supabase = getServiceClient();
    const { category, level, limit = 100, offset = 0 } = options || {};

    let query = supabase
      .from("model_elements")
      .select("id, global_id, name, category, level, type_name", { count: "exact" })
      .eq("project_id", projectId)
      .eq("status", "active");

    if (category) {
      query = query.ilike("category", `%${category}%`);
    }

    if (level) {
      query = query.ilike("level", `%${level}%`);
    }

    const { data, count, error } = await query
      .order("category")
      .order("name")
      .range(offset, offset + limit - 1);

    if (error) {
      return { success: false, elements: [], totalCount: 0, error: error.message };
    }

    const elements: BimElementSummary[] = (data || []).map((row) => ({
      id: row.id,
      globalId: row.global_id,
      name: row.name,
      category: row.category,
      level: row.level,
      typeName: row.type_name,
    }));

    return { success: true, elements, totalCount: count || 0 };
  } catch (error) {
    return {
      success: false,
      elements: [],
      totalCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Get Project Element Statistics
// =============================================================================

export interface ProjectElementStats {
  totalElements: number;
  byCategory: Record<string, number>;
  byLevel: Record<string, number>;
  byType: Record<string, number>;
}

export async function getProjectElementStats(
  projectId: string
): Promise<{ success: boolean; stats: ProjectElementStats | null; error?: string }> {
  try {
    const supabase = getServiceClient();

    // Get total count
    const { count: totalElements } = await supabase
      .from("model_elements")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "active");

    // Get breakdown by category
    const { data: categoryData } = await supabase
      .from("model_elements")
      .select("category")
      .eq("project_id", projectId)
      .eq("status", "active");

    const byCategory: Record<string, number> = {};
    for (const row of categoryData || []) {
      const cat = row.category;
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    // Get breakdown by level
    const { data: levelData } = await supabase
      .from("model_elements")
      .select("level")
      .eq("project_id", projectId)
      .eq("status", "active")
      .not("level", "is", null);

    const byLevel: Record<string, number> = {};
    for (const row of levelData || []) {
      const lvl = row.level || "Unknown";
      byLevel[lvl] = (byLevel[lvl] || 0) + 1;
    }

    // Get breakdown by type (top 20)
    const { data: typeData } = await supabase
      .from("model_elements")
      .select("type_name")
      .eq("project_id", projectId)
      .eq("status", "active")
      .not("type_name", "is", null);

    const byType: Record<string, number> = {};
    for (const row of typeData || []) {
      const typeName = row.type_name || "Unknown";
      byType[typeName] = (byType[typeName] || 0) + 1;
    }

    return {
      success: true,
      stats: {
        totalElements: totalElements || 0,
        byCategory,
        byLevel,
        byType,
      },
    };
  } catch (error) {
    return {
      success: false,
      stats: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Search Elements by Property
// =============================================================================

export async function searchElementsByProperty(
  projectId: string,
  propertyPath: string[], // e.g., ["Pset_WallCommon", "FireRating"]
  propertyValue?: string // Optional: specific value to match
): Promise<{ success: boolean; elements: BimElementSummary[]; error?: string }> {
  try {
    const supabase = getServiceClient();

    // Build the JSONB path for querying
    const firstKey = propertyPath[0];

    let query = supabase
      .from("model_elements")
      .select("id, global_id, name, category, level, type_name")
      .eq("project_id", projectId)
      .not("properties", "is", null)
      .filter(`properties->${firstKey}`, "not.is", null);

    if (propertyValue && propertyPath.length > 1) {
      // If we have a specific nested value to match
      const pathStr = propertyPath.join(",");
      query = query.filter(`properties->>${pathStr}`, "eq", propertyValue);
    }

    const { data, error } = await query.limit(50);

    if (error) {
      return { success: false, elements: [], error: error.message };
    }

    const elements: BimElementSummary[] = (data || []).map((row) => ({
      id: row.id,
      globalId: row.global_id,
      name: row.name,
      category: row.category,
      level: row.level,
      typeName: row.type_name,
    }));

    return { success: true, elements };
  } catch (error) {
    return {
      success: false,
      elements: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Semantic Search for Elements
// =============================================================================

export async function searchElementsSemantic(
  projectId: string,
  query: string,
  options?: {
    category?: string;
    level?: string;
    matchCount?: number;
  }
): Promise<{ success: boolean; elements: BimElementSummary[]; error?: string }> {
  try {
    const supabase = getServiceClient();
    const { category, level, matchCount = 10 } = options || {};

    // Generate embedding for the search query
    const embeddingResult = await generateEmbedding(query);
    if (!embeddingResult.embedding) {
      return { success: false, elements: [], error: "Failed to generate embedding" };
    }

    // Use the search function
    const { data, error } = await supabase.rpc("search_model_elements", {
      p_project_id: projectId,
      p_query_embedding: embeddingResult.embedding,
      p_match_threshold: 0.65,
      p_match_count: matchCount,
      p_category: category || null,
      p_level: level || null,
    });

    if (error) {
      return { success: false, elements: [], error: error.message };
    }

    const elements: BimElementSummary[] = (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      globalId: row.global_id as string,
      name: row.name as string | null,
      category: row.category as string,
      level: row.level as string | null,
      typeName: row.type_name as string | null,
    }));

    return { success: true, elements };
  } catch (error) {
    return {
      success: false,
      elements: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Batch Get Element Properties
// =============================================================================

/**
 * Get properties for multiple elements at once (for batch compliance checking)
 */
export async function getBatchElementProperties(
  projectId: string,
  globalIds: string[]
): Promise<{ success: boolean; elements: BimElementProperties[]; error?: string }> {
  try {
    if (globalIds.length === 0) {
      return { success: true, elements: [] };
    }

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("model_elements")
      .select("*")
      .eq("project_id", projectId)
      .in("global_id", globalIds);

    if (error) {
      return { success: false, elements: [], error: error.message };
    }

    const elements: BimElementProperties[] = (data || []).map((row) => ({
      id: row.id,
      globalId: row.global_id,
      name: row.name,
      category: row.category,
      subcategory: row.subcategory,
      level: row.level,
      levelElevation: row.level_elevation,
      typeName: row.type_name,
      typeId: row.type_id,
      volume: row.volume,
      area: row.area,
      length: row.length,
      height: row.height,
      width: row.width,
      boundingBox: row.bounding_box,
      properties: row.properties || {},
      systemName: row.system_name,
      systemType: row.system_type,
      masterformatCode: row.masterformat_code,
      uniformatCode: row.uniformat_code,
      omniclassCode: row.omniclass_code,
      sourceFile: row.source_file,
      ifcSchema: row.ifc_schema,
      status: row.status,
      phase: row.phase,
    }));

    return { success: true, elements };
  } catch (error) {
    return {
      success: false,
      elements: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
