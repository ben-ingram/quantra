"use server";

import { createClient } from "@supabase/supabase-js";
import { openai } from "@/app/lib/openai";

// =============================================================================
// Configuration
// =============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const EMBEDDING_MODEL = "text-embedding-3-small";

// Thresholds
const TEXT_MATCH_THRESHOLD = 0.5;
const TEXT_MATCH_COUNT = 8;
const TABLE_MATCH_THRESHOLD = 0.82;
const TABLE_MATCH_COUNT = 3;
const CHAPTER_ROUTING_THRESHOLD = 0.3;
const CHAPTER_ROUTING_COUNT = 3;

// =============================================================================
// Types
// =============================================================================

export interface RAGProjectContext {
  id: string;
  state?: string;
  libraryId?: string;
  jurisdiction?: string;
}

// =============================================================================
// BIM Element Types
// =============================================================================

export interface BimElement {
  id: string;
  globalId: string;
  name: string | null;
  category: string;
  level: string | null;
  typeName: string | null;
  properties: Record<string, unknown>;
  volume: number | null;
  area: number | null;
  height: number | null;
  width: number | null;
  length: number | null;
  systemName: string | null;
  systemType: string | null;
  masterformatCode: string | null;
}

export interface BimQueryIntent {
  type: "element_lookup" | "property_search" | "semantic_search" | "count_query" | "none";
  globalId?: string;
  elementName?: string;
  category?: string;
  level?: string;
  propertyFilter?: {
    path: string[];
    value: string;
  };
  searchQuery?: string;
}

export interface TextChunk {
  id: string;
  content: string;
  sectionNumber: string | null;
  sectionTitle: string | null;
  metadata: Record<string, unknown>;
  jurisdiction: string | null;
  codeName: string | null;
  codeVersion: string | null;
  pageNumber: number | null;
  chapter: string | null;
  libraryId: string | null;
  vectorScore: number;
  keywordScore: number;
  combinedScore: number;
}

export interface CodeTable {
  id: string;
  tableId: string;
  tableTitle: string | null;
  summary: string;
  data: Record<string, unknown> | unknown[];
  metadata: Record<string, unknown>;
  jurisdiction: string | null;
  codeName: string | null;
  sectionReference: string | null;
  chapter: string | null;
  vectorScore: number;
  keywordScore: number;
  combinedScore: number;
}

// =============================================================================
// Project Spec Types (Design Requirements)
// =============================================================================

export interface ProjectSpec {
  id: string;
  projectId: string;
  csiDivision: string | null;
  sectionTitle: string | null;
  parameterName: string | null;
  requirementText: string;
  minValue: number | null;
  maxValue: number | null;
  targetValue: number | null;
  unit: string | null;
  sourceFile: string | null;
  similarity: number;
}

export interface ChapterMatch {
  chapterId: string;
  libraryId: string;
  chapterNumber: string;
  chapterTitle: string;
  similarity: number;
}

export interface ComplianceData {
  textContext: string;
  textChunks: TextChunk[];
  tableContext: CodeTable[];
  routedChapters: ChapterMatch[];
  query: string;
  libraryId: string | null;
  embeddingTime: number;
  routingTime: number;
  searchTime: number;
  // Design Requirements (from project_specs)
  designRequirements: ProjectSpec[];
  designContext?: string;
  // BIM Data (if element query detected)
  bimElements?: BimElement[];
  bimContext?: string;
  bimQueryIntent?: BimQueryIntent;
}

// =============================================================================
// Supabase Client
// =============================================================================

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Missing Supabase configuration");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// =============================================================================
// Embedding Generation
// =============================================================================

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

// =============================================================================
// Library Resolution
// =============================================================================

/**
 * Resolve the library ID based on project context
 * Priority: explicit libraryId > state lookup > default
 */
async function resolveLibraryId(
  supabase: ReturnType<typeof getSupabaseClient>,
  context?: RAGProjectContext
): Promise<string | null> {
  // If explicit libraryId provided, use it
  if (context?.libraryId) {
    return context.libraryId;
  }

  // If state provided, look up the active library for that state
  if (context?.state) {
    const { data } = await supabase
      .from("code_libraries")
      .select("id")
      .eq("state", context.state)
      .eq("status", "active")
      .eq("jurisdiction", context.jurisdiction || "Statewide")
      .single();

    if (data) {
      return data.id;
    }

    // Fallback: try just state without jurisdiction match
    const { data: fallback } = await supabase
      .from("code_libraries")
      .select("id")
      .eq("state", context.state)
      .eq("status", "active")
      .limit(1)
      .single();

    if (fallback) {
      return fallback.id;
    }
  }

  // Default: return the first active library (likely FBC)
  const { data: defaultLib } = await supabase
    .from("code_libraries")
    .select("id")
    .eq("status", "active")
    .limit(1)
    .single();

  return defaultLib?.id || null;
}

// =============================================================================
// Chapter Routing (The "Map" Step)
// =============================================================================

/**
 * Semantic chapter routing - find the most relevant chapters for a query
 *
 * This is the "Map" step that:
 * 1. Takes the user query embedding
 * 2. Searches code_structure table for semantically similar chapters
 * 3. Returns top N chapters to focus the search
 */
async function routeToChapters(
  supabase: ReturnType<typeof getSupabaseClient>,
  queryEmbedding: number[],
  libraryId: string | null,
  options: {
    matchThreshold?: number;
    matchCount?: number;
  } = {}
): Promise<ChapterMatch[]> {
  const {
    matchThreshold = CHAPTER_ROUTING_THRESHOLD,
    matchCount = CHAPTER_ROUTING_COUNT,
  } = options;

  const { data, error } = await supabase.rpc("route_to_chapters", {
    query_embedding: queryEmbedding,
    p_library_id: libraryId,
    p_state: null, // Already resolved to library
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    console.error("[RetrieveComplianceData] Chapter routing error:", error);
    // Don't throw - routing is optional, just return empty
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    chapterId: row.chapter_id as string,
    libraryId: row.library_id as string,
    chapterNumber: row.chapter_number as string,
    chapterTitle: row.chapter_title as string,
    similarity: row.similarity as number,
  }));
}

// =============================================================================
// Hybrid Text Search
// =============================================================================

async function searchTextChunks(
  supabase: ReturnType<typeof getSupabaseClient>,
  queryText: string,
  queryEmbedding: number[],
  options: {
    libraryId?: string | null;
    jurisdiction?: string;
    codeName?: string;
    chapters?: string[];
    matchThreshold?: number;
    matchCount?: number;
  } = {}
): Promise<TextChunk[]> {
  const {
    libraryId,
    jurisdiction,
    codeName,
    chapters,
    matchThreshold = TEXT_MATCH_THRESHOLD,
    matchCount = TEXT_MATCH_COUNT,
  } = options;

  // If we have specific chapters to search, search each and combine
  if (chapters && chapters.length > 0) {
    const allChunks: TextChunk[] = [];
    const perChapterCount = Math.ceil(matchCount / chapters.length);

    // Search each chapter in parallel
    const chapterSearches = chapters.map((chapter) =>
      supabase.rpc("hybrid_search", {
        query_text: queryText,
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: perChapterCount,
        filter_jurisdiction: jurisdiction || null,
        filter_code_name: codeName || null,
        filter_chapter: chapter,
        filter_library_id: libraryId || null,
      })
    );

    const results = await Promise.all(chapterSearches);

    for (const { data, error } of results) {
      if (error) {
        console.error("[RetrieveComplianceData] Chapter search error:", error);
        continue;
      }

      const chunks = (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        content: row.content as string,
        sectionNumber: row.section_number as string | null,
        sectionTitle: row.section_title as string | null,
        metadata: (row.metadata as Record<string, unknown>) || {},
        jurisdiction: row.jurisdiction as string | null,
        codeName: row.code_name as string | null,
        codeVersion: row.code_version as string | null,
        pageNumber: row.page_number as number | null,
        chapter: row.chapter as string | null,
        libraryId: row.library_id as string | null,
        vectorScore: row.vector_score as number,
        keywordScore: row.keyword_score as number,
        combinedScore: row.combined_score as number,
      }));

      allChunks.push(...chunks);
    }

    // Sort by combined score and dedupe
    const seen = new Set<string>();
    return allChunks
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .filter((chunk) => {
        if (seen.has(chunk.id)) return false;
        seen.add(chunk.id);
        return true;
      })
      .slice(0, matchCount);
  }

  // No specific chapters - search across all (fallback)
  const { data, error } = await supabase.rpc("hybrid_search", {
    query_text: queryText,
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
    filter_jurisdiction: jurisdiction || null,
    filter_code_name: codeName || null,
    filter_chapter: null,
    filter_library_id: libraryId || null,
  });

  if (error) {
    console.error("[RetrieveComplianceData] Hybrid search error:", error);
    throw new Error(`Hybrid search failed: ${error.message}`);
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    content: row.content as string,
    sectionNumber: row.section_number as string | null,
    sectionTitle: row.section_title as string | null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    jurisdiction: row.jurisdiction as string | null,
    codeName: row.code_name as string | null,
    codeVersion: row.code_version as string | null,
    pageNumber: row.page_number as number | null,
    chapter: row.chapter as string | null,
    libraryId: row.library_id as string | null,
    vectorScore: row.vector_score as number,
    keywordScore: row.keyword_score as number,
    combinedScore: row.combined_score as number,
  }));
}

// =============================================================================
// Table Search
// =============================================================================

async function searchCodeTables(
  supabase: ReturnType<typeof getSupabaseClient>,
  queryText: string,
  queryEmbedding: number[],
  options: {
    libraryId?: string | null;
    jurisdiction?: string;
    codeName?: string;
    chapter?: string;
    matchThreshold?: number;
    matchCount?: number;
  } = {}
): Promise<CodeTable[]> {
  const {
    libraryId,
    jurisdiction,
    codeName,
    chapter,
    matchThreshold = TABLE_MATCH_THRESHOLD,
    matchCount = TABLE_MATCH_COUNT,
  } = options;

  const { data, error } = await supabase.rpc("search_code_tables", {
    query_text: queryText,
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
    filter_jurisdiction: jurisdiction || null,
    filter_code_name: codeName || null,
    filter_chapter: chapter || null,
    // Note: search_code_tables may need to be updated to support library_id
  });

  if (error) {
    console.error("[RetrieveComplianceData] Table search error:", error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    tableId: row.table_id as string,
    tableTitle: row.table_title as string | null,
    summary: row.summary as string,
    data: row.data as Record<string, unknown> | unknown[],
    metadata: (row.metadata as Record<string, unknown>) || {},
    jurisdiction: row.jurisdiction as string | null,
    codeName: row.code_name as string | null,
    sectionReference: row.section_reference as string | null,
    chapter: row.chapter as string | null,
    vectorScore: row.vector_score as number,
    keywordScore: row.keyword_score as number,
    combinedScore: row.combined_score as number,
  }));
}

// =============================================================================
// Project Specs Search (Design Requirements)
// =============================================================================

const SPEC_MATCH_THRESHOLD = 0.5;
const SPEC_MATCH_COUNT = 3;

/**
 * Search project specifications (design requirements) using vector similarity
 *
 * This searches the project_specs table which contains requirements extracted
 * from the project's specification PDFs (CSI MasterFormat documents).
 */
async function searchProjectSpecs(
  supabase: ReturnType<typeof getSupabaseClient>,
  projectId: string,
  queryEmbedding: number[],
  options: {
    matchThreshold?: number;
    matchCount?: number;
    csiDivision?: string;
  } = {}
): Promise<ProjectSpec[]> {
  const {
    matchThreshold = SPEC_MATCH_THRESHOLD,
    matchCount = SPEC_MATCH_COUNT,
    csiDivision,
  } = options;

  // Use the database function for vector similarity search
  const { data, error } = await supabase.rpc("search_project_specs", {
    p_project_id: projectId,
    p_query_embedding: queryEmbedding,
    p_match_threshold: matchThreshold,
    p_match_count: matchCount,
  });

  if (error) {
    console.error("[RetrieveComplianceData] Project specs search error:", error);
    return [];
  }

  // Filter by CSI division if specified
  let results = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    projectId: projectId,
    csiDivision: row.csi_division as string | null,
    sectionTitle: row.section_title as string | null,
    parameterName: row.parameter_name as string | null,
    requirementText: row.requirement_text as string,
    minValue: row.min_value as number | null,
    maxValue: row.max_value as number | null,
    targetValue: row.target_value as number | null,
    unit: row.unit as string | null,
    sourceFile: null, // Not returned by RPC
    similarity: row.similarity as number,
  }));

  // Apply CSI division filter if provided
  if (csiDivision) {
    results = results.filter(
      (spec: ProjectSpec) =>
        spec.csiDivision &&
        spec.csiDivision.toLowerCase().includes(csiDivision.toLowerCase())
    );
  }

  return results;
}

/**
 * Format project specs (design requirements) into context for LLM
 */
function formatDesignContext(specs: ProjectSpec[]): string {
  if (specs.length === 0) {
    return "";
  }

  let context = "## DESIGN REQUIREMENTS (Project Specifications)\n\n";
  context +=
    "These are the project-specific requirements from the specification documents.\n";
  context +=
    "**Design specs typically override code minimums when they are stricter.**\n\n";

  specs.forEach((spec, index) => {
    context += `### Spec ${index + 1}: ${spec.parameterName || "Requirement"}`;
    if (spec.csiDivision) {
      context += ` (CSI ${spec.csiDivision})`;
    }
    context += `\n`;
    context += `**Similarity:** ${(spec.similarity * 100).toFixed(1)}%\n`;

    if (spec.sectionTitle) {
      context += `**Section:** ${spec.sectionTitle}\n`;
    }

    // Show numeric limits
    const limits: string[] = [];
    if (spec.minValue !== null) {
      limits.push(`Min: ${spec.minValue}${spec.unit ? ` ${spec.unit}` : ""}`);
    }
    if (spec.maxValue !== null) {
      limits.push(`Max: ${spec.maxValue}${spec.unit ? ` ${spec.unit}` : ""}`);
    }
    if (spec.targetValue !== null) {
      limits.push(
        `Target: ${spec.targetValue}${spec.unit ? ` ${spec.unit}` : ""}`
      );
    }

    if (limits.length > 0) {
      context += `**Limits:** ${limits.join(" | ")}\n`;
    }

    if (spec.requirementText) {
      context += `**Requirement:** ${spec.requirementText}\n`;
    }

    context += "\n---\n\n";
  });

  return context;
}

// =============================================================================
// BIM Intent Detection
// =============================================================================

// Patterns for detecting BIM element queries
const BIM_ELEMENT_PATTERNS = {
  // Direct ID references (e.g., "Wall 105", "Element 2tO7F9$2X5fv")
  elementId: /(?:wall|door|window|slab|beam|column|element|stair|roof|ceiling)\s*(?:#|id:?\s*)?([A-Za-z0-9$_-]+)/i,
  // IFC GUID pattern (22-character base64)
  ifcGuid: /([0-9A-Za-z$_]{22})/,
  // Fire rating queries
  fireRating: /fire[- ]?rat(?:ed|ing)|fire[- ]?resistance|hour[- ]?rat(?:ed|ing)/i,
  // Level queries
  levelQuery: /(?:on|at|in)\s+(?:level|floor)\s+(\d+|[A-Za-z]+\d*)/i,
  // Count queries
  countQuery: /how many|count|number of|total/i,
  // Category queries
  categoryQuery: /(?:all|every|any)\s+(?:the\s+)?(walls?|doors?|windows?|slabs?|beams?|columns?|stairs?|roofs?|ceilings?)/i,
};

// Map common names to IFC categories
const CATEGORY_MAP: Record<string, string> = {
  wall: "IfcWall",
  walls: "IfcWall",
  door: "IfcDoor",
  doors: "IfcDoor",
  window: "IfcWindow",
  windows: "IfcWindow",
  slab: "IfcSlab",
  slabs: "IfcSlab",
  floor: "IfcSlab",
  floors: "IfcSlab",
  beam: "IfcBeam",
  beams: "IfcBeam",
  column: "IfcColumn",
  columns: "IfcColumn",
  stair: "IfcStair",
  stairs: "IfcStair",
  roof: "IfcRoof",
  roofs: "IfcRoof",
  ceiling: "IfcCovering",
  ceilings: "IfcCovering",
};

/**
 * Detect BIM query intent from user query
 */
function detectBimQueryIntent(query: string): BimQueryIntent {
  const lowerQuery = query.toLowerCase();

  // Check for direct element ID or name reference
  const elementMatch = query.match(BIM_ELEMENT_PATTERNS.elementId);
  if (elementMatch) {
    const identifier = elementMatch[1];
    // Check if it looks like an IFC GUID
    if (identifier.length === 22 && /^[0-9A-Za-z$_]+$/.test(identifier)) {
      return {
        type: "element_lookup",
        globalId: identifier,
      };
    }
    return {
      type: "element_lookup",
      elementName: elementMatch[0],
    };
  }

  // Check for IFC GUID in query
  const guidMatch = query.match(BIM_ELEMENT_PATTERNS.ifcGuid);
  if (guidMatch && guidMatch[1].length === 22) {
    return {
      type: "element_lookup",
      globalId: guidMatch[1],
    };
  }

  // Check for count queries
  if (BIM_ELEMENT_PATTERNS.countQuery.test(lowerQuery)) {
    const categoryMatch = lowerQuery.match(BIM_ELEMENT_PATTERNS.categoryQuery);
    const levelMatch = query.match(BIM_ELEMENT_PATTERNS.levelQuery);

    if (categoryMatch || levelMatch) {
      return {
        type: "count_query",
        category: categoryMatch ? CATEGORY_MAP[categoryMatch[1].toLowerCase()] : undefined,
        level: levelMatch ? levelMatch[1] : undefined,
        searchQuery: query,
      };
    }
  }

  // Check for fire rating queries
  if (BIM_ELEMENT_PATTERNS.fireRating.test(lowerQuery)) {
    const levelMatch = query.match(BIM_ELEMENT_PATTERNS.levelQuery);
    const categoryMatch = lowerQuery.match(BIM_ELEMENT_PATTERNS.categoryQuery);

    return {
      type: "property_search",
      propertyFilter: {
        path: ["Pset_WallCommon", "FireRating"],
        value: "", // Will match any fire rating
      },
      category: categoryMatch ? CATEGORY_MAP[categoryMatch[1].toLowerCase()] : undefined,
      level: levelMatch ? levelMatch[1] : undefined,
      searchQuery: query,
    };
  }

  // Check for category + level queries (e.g., "walls on Level 2")
  const categoryMatch = lowerQuery.match(BIM_ELEMENT_PATTERNS.categoryQuery);
  const levelMatch = query.match(BIM_ELEMENT_PATTERNS.levelQuery);

  if (categoryMatch || levelMatch) {
    return {
      type: "semantic_search",
      category: categoryMatch ? CATEGORY_MAP[categoryMatch[1].toLowerCase()] : undefined,
      level: levelMatch ? levelMatch[1] : undefined,
      searchQuery: query,
    };
  }

  // No BIM intent detected
  return { type: "none" };
}

// =============================================================================
// BIM Element Lookup Functions
// =============================================================================

/**
 * Lookup a specific BIM element by global ID
 */
async function lookupBimElementById(
  supabase: ReturnType<typeof getSupabaseClient>,
  projectId: string,
  globalId: string
): Promise<BimElement | null> {
  const { data, error } = await supabase
    .from("model_elements")
    .select("*")
    .eq("project_id", projectId)
    .eq("global_id", globalId)
    .single();

  if (error || !data) {
    console.log(`[BIM] Element not found: ${globalId}`);
    return null;
  }

  return mapToBimElement(data);
}

/**
 * Search BIM elements by name pattern
 */
async function searchBimElementsByName(
  supabase: ReturnType<typeof getSupabaseClient>,
  projectId: string,
  namePattern: string,
  limit: number = 5
): Promise<BimElement[]> {
  const { data, error } = await supabase
    .from("model_elements")
    .select("*")
    .eq("project_id", projectId)
    .ilike("name", `%${namePattern}%`)
    .limit(limit);

  if (error) {
    console.error("[BIM] Name search error:", error);
    return [];
  }

  return (data || []).map(mapToBimElement);
}

/**
 * Search BIM elements by property (e.g., FireRating)
 */
async function searchBimElementsByProperty(
  supabase: ReturnType<typeof getSupabaseClient>,
  projectId: string,
  propertyPath: string[],
  propertyValue: string | null,
  options: {
    category?: string;
    level?: string;
    limit?: number;
  } = {}
): Promise<BimElement[]> {
  const { category, level, limit = 20 } = options;

  // Build the JSONB path query
  let query = supabase
    .from("model_elements")
    .select("*")
    .eq("project_id", projectId);

  // Filter by property existence or value
  if (propertyValue) {
    // Exact value match
    const pathString = propertyPath.join(",");
    query = query.filter(`properties->>${pathString}`, "eq", propertyValue);
  } else {
    // Just check if property exists (not null)
    // Use raw filter for JSONB path existence
    const firstKey = propertyPath[0];
    query = query.not("properties", "is", null);
    query = query.filter(`properties->${firstKey}`, "not.is", null);
  }

  if (category) {
    query = query.ilike("category", `%${category}%`);
  }

  if (level) {
    query = query.ilike("level", `%${level}%`);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    console.error("[BIM] Property search error:", error);
    return [];
  }

  return (data || []).map(mapToBimElement);
}

/**
 * Semantic search for BIM elements
 */
async function searchBimElementsSemantic(
  supabase: ReturnType<typeof getSupabaseClient>,
  projectId: string,
  queryEmbedding: number[],
  options: {
    category?: string;
    level?: string;
    matchThreshold?: number;
    matchCount?: number;
  } = {}
): Promise<BimElement[]> {
  const { category, level, matchThreshold = 0.7, matchCount = 10 } = options;

  const { data, error } = await supabase.rpc("search_model_elements", {
    p_project_id: projectId,
    p_query_embedding: queryEmbedding,
    p_match_threshold: matchThreshold,
    p_match_count: matchCount,
    p_category: category || null,
    p_level: level || null,
  });

  if (error) {
    console.error("[BIM] Semantic search error:", error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    globalId: row.global_id as string,
    name: row.name as string | null,
    category: row.category as string,
    level: row.level as string | null,
    typeName: row.type_name as string | null,
    properties: (row.properties as Record<string, unknown>) || {},
    volume: null,
    area: null,
    height: null,
    width: null,
    length: null,
    systemName: null,
    systemType: null,
    masterformatCode: null,
  }));
}

/**
 * Count BIM elements matching criteria
 */
async function countBimElements(
  supabase: ReturnType<typeof getSupabaseClient>,
  projectId: string,
  options: {
    category?: string;
    level?: string;
    propertyPath?: string[];
    propertyValue?: string;
  } = {}
): Promise<{ count: number; breakdown?: Record<string, number> }> {
  const { category, level } = options;

  let query = supabase
    .from("model_elements")
    .select("category", { count: "exact" })
    .eq("project_id", projectId);

  if (category) {
    query = query.ilike("category", `%${category}%`);
  }

  if (level) {
    query = query.ilike("level", `%${level}%`);
  }

  const { count, data, error } = await query;

  if (error) {
    console.error("[BIM] Count error:", error);
    return { count: 0 };
  }

  // Get breakdown by category
  const breakdown: Record<string, number> = {};
  if (data) {
    for (const row of data) {
      const cat = (row as Record<string, unknown>).category as string;
      breakdown[cat] = (breakdown[cat] || 0) + 1;
    }
  }

  return { count: count || 0, breakdown };
}

/**
 * Map database row to BimElement type
 */
function mapToBimElement(row: Record<string, unknown>): BimElement {
  return {
    id: row.id as string,
    globalId: row.global_id as string,
    name: row.name as string | null,
    category: row.category as string,
    level: row.level as string | null,
    typeName: row.type_name as string | null,
    properties: (row.properties as Record<string, unknown>) || {},
    volume: row.volume as number | null,
    area: row.area as number | null,
    height: row.height as number | null,
    width: row.width as number | null,
    length: row.length as number | null,
    systemName: row.system_name as string | null,
    systemType: row.system_type as string | null,
    masterformatCode: row.masterformat_code as string | null,
  };
}

// =============================================================================
// Format BIM Context for LLM
// =============================================================================

/**
 * Format BIM elements into context for LLM
 */
function formatBimContext(elements: BimElement[], intent: BimQueryIntent): string {
  if (elements.length === 0) {
    return "NO BIM ELEMENTS FOUND MATCHING THE QUERY";
  }

  let context = "## BIM MODEL DATA\n\n";
  context += `**Query Type:** ${intent.type}\n`;
  context += `**Elements Found:** ${elements.length}\n\n`;

  elements.forEach((element, index) => {
    context += `### Element ${index + 1}: ${element.name || "Unnamed"}\n`;
    context += `- **Global ID:** ${element.globalId}\n`;
    context += `- **Category:** ${element.category}\n`;
    context += `- **Type:** ${element.typeName || "N/A"}\n`;
    context += `- **Level:** ${element.level || "N/A"}\n`;

    // Dimensions
    const dims: string[] = [];
    if (element.height) dims.push(`Height: ${element.height}`);
    if (element.width) dims.push(`Width: ${element.width}`);
    if (element.length) dims.push(`Length: ${element.length}`);
    if (element.area) dims.push(`Area: ${element.area}`);
    if (element.volume) dims.push(`Volume: ${element.volume}`);
    if (dims.length > 0) {
      context += `- **Dimensions:** ${dims.join(", ")}\n`;
    }

    // System info (for MEP)
    if (element.systemName || element.systemType) {
      context += `- **System:** ${element.systemName || ""} (${element.systemType || ""})\n`;
    }

    // Classification
    if (element.masterformatCode) {
      context += `- **MasterFormat:** ${element.masterformatCode}\n`;
    }

    // Key Properties
    if (Object.keys(element.properties).length > 0) {
      context += `- **Properties:**\n`;
      context += formatPropertiesForContext(element.properties);
    }

    context += "\n---\n\n";
  });

  context += "\n**INSTRUCTION:** Compare these actual BIM element properties against the Code Requirements below. Identify any compliance issues.\n";

  return context;
}

/**
 * Format properties JSONB for readable context
 */
function formatPropertiesForContext(properties: Record<string, unknown>, indent: string = "  "): string {
  let result = "";

  // Priority property sets to show
  const prioritySets = [
    "Pset_WallCommon",
    "Pset_DoorCommon",
    "Pset_WindowCommon",
    "Pset_SlabCommon",
    "Pset_BeamCommon",
    "Pset_ColumnCommon",
    "Pset_StairCommon",
    "Qto_WallBaseQuantities",
    "Qto_SlabBaseQuantities",
    "Materials",
  ];

  for (const setName of prioritySets) {
    if (properties[setName]) {
      result += `${indent}**${setName}:**\n`;
      const pset = properties[setName] as Record<string, unknown>;

      if (Array.isArray(pset)) {
        result += `${indent}  ${pset.join(", ")}\n`;
      } else {
        for (const [key, value] of Object.entries(pset)) {
          if (value !== null && value !== undefined) {
            result += `${indent}  - ${key}: ${value}\n`;
          }
        }
      }
    }
  }

  // Show other properties if no priority sets found
  if (result === "") {
    for (const [key, value] of Object.entries(properties)) {
      if (typeof value === "object" && value !== null) {
        result += `${indent}**${key}:**\n`;
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          if (v !== null && v !== undefined) {
            result += `${indent}  - ${k}: ${v}\n`;
          }
        }
      } else if (value !== null && value !== undefined) {
        result += `${indent}- ${key}: ${value}\n`;
      }
    }
  }

  return result || `${indent}(No properties available)\n`;
}

// =============================================================================
// Format Text Context
// =============================================================================

function formatTextContext(
  chunks: TextChunk[],
  routedChapters: ChapterMatch[]
): string {
  if (chunks.length === 0) {
    return "NO RELEVANT CODE SECTIONS FOUND";
  }

  // Add chapter routing info at the top
  let context = "";

  if (routedChapters.length > 0) {
    context += "**SEMANTIC ROUTING - Relevant Chapters Identified:**\n";
    routedChapters.forEach((ch, i) => {
      context += `${i + 1}. Chapter ${ch.chapterNumber}: ${ch.chapterTitle} (${(ch.similarity * 100).toFixed(0)}% match)\n`;
    });
    context += "\n---\n\n";
  }

  // Add the code sections
  context += chunks
    .map((chunk, index) => {
      const sectionInfo = [chunk.sectionNumber, chunk.sectionTitle]
        .filter(Boolean)
        .join(" - ");

      const sourceInfo = [chunk.codeName, chunk.codeVersion, chunk.jurisdiction]
        .filter(Boolean)
        .join(" | ");

      return `### Match ${index + 1} (Combined Score: ${(chunk.combinedScore * 100).toFixed(1)}% | Vector: ${(chunk.vectorScore * 100).toFixed(1)}% | Keyword: ${(chunk.keywordScore * 100).toFixed(1)}%)
**Section:** ${sectionInfo || "Unknown"}
**Source:** ${sourceInfo || "Unknown"}
**Chapter:** ${chunk.chapter || "N/A"}
**Page:** ${chunk.pageNumber || "N/A"}

${chunk.content}
---`;
    })
    .join("\n\n");

  return context;
}

// =============================================================================
// Main Retrieval Function (Super RAG with Chapter Routing)
// =============================================================================

/**
 * Retrieves compliance data from BOTH Design Requirements AND Code Requirements.
 *
 * == NEW ARCHITECTURE ==
 *
 * Step A - Spec Check (The Design Target):
 * - Search project_specs table using vector similarity (projectId filter)
 * - Retrieve top 3 matches as "Design Requirements"
 *
 * Step B - Code Check (The Legal Minimum):
 * - Search code_sections table using hybrid search (library filter + chapter routing)
 * - Retrieve matches as "Code Requirements"
 *
 * Step C - Context Assembly:
 * - Combine both sets of results into the System Prompt
 * - Instruction to LLM: Compare Design Requirements against Code Requirements
 *   Design Requirements override Code when stricter. Report BOTH limits.
 *
 * == ORIGINAL PHASES (still active for code_sections) ==
 *
 * Phase 1 (Map): Route to relevant chapters
 * - Generate query embedding
 * - Search code_structure to find semantically similar chapters
 * - Identify which chapters are most relevant (e.g., "stairs" -> Chapter 10)
 *
 * Phase 2 (Search): Targeted search within routed chapters
 * - Run hybrid search on code_sections filtered by library + chapters
 * - Return the most relevant code sections
 *
 * @param userQuery - The compliance question or defect description
 * @param projectContext - Project context including state/libraryId and project ID
 * @param options - Search options including spec and code match thresholds
 * @returns ComplianceData with design requirements, code sections, and combined context
 */
export async function retrieveComplianceData(
  userQuery: string,
  projectContext?: RAGProjectContext,
  options: {
    jurisdiction?: string;
    codeName?: string;
    chapter?: string; // Optional: skip routing if chapter is explicitly provided
    textMatchThreshold?: number;
    textMatchCount?: number;
    tableMatchThreshold?: number;
    tableMatchCount?: number;
    // Project specs options (design requirements)
    specMatchThreshold?: number; // Default: 0.5
    specMatchCount?: number; // Default: 3
    enableChapterRouting?: boolean; // Default: true
    enableBimLookup?: boolean; // Default: true - enable BIM data integration
    bimElementId?: string; // Optional: explicit BIM element ID from 3D viewer click
  } = {}
): Promise<ComplianceData> {
  const startTime = Date.now();
  const { enableChapterRouting = true, enableBimLookup = true } = options;

  // Validate input
  if (!userQuery?.trim()) {
    throw new Error("Query is required");
  }

  const supabase = getSupabaseClient();

  // Step 1: Resolve library
  console.log("[RetrieveComplianceData] Resolving library...");
  const libraryId = await resolveLibraryId(supabase, projectContext);
  console.log(`[RetrieveComplianceData] Using library: ${libraryId || "none"}`);

  // Step 2: Generate embedding
  console.log("[RetrieveComplianceData] Generating embedding...");
  const embeddingStart = Date.now();
  const queryEmbedding = await generateEmbedding(userQuery);
  const embeddingTime = Date.now() - embeddingStart;

  // ==========================================================================
  // Step 2.5: BIM Intent Detection & Query (NEW)
  // ==========================================================================
  let bimElements: BimElement[] = [];
  let bimContext: string | undefined;
  let bimQueryIntent: BimQueryIntent = { type: "none" };

  if (enableBimLookup && projectContext?.id) {
    console.log("[RetrieveComplianceData] Detecting BIM query intent...");

    // Check for explicit element ID from 3D viewer
    if (options.bimElementId) {
      console.log(`[RetrieveComplianceData] Explicit BIM element ID provided: ${options.bimElementId}`);
      bimQueryIntent = {
        type: "element_lookup",
        globalId: options.bimElementId,
      };
    } else {
      // Detect intent from query text
      bimQueryIntent = detectBimQueryIntent(userQuery);
    }

    console.log(`[RetrieveComplianceData] BIM intent: ${bimQueryIntent.type}`);

    // Execute BIM query based on intent
    if (bimQueryIntent.type !== "none") {
      console.log("[RetrieveComplianceData] Executing BIM query...");

      switch (bimQueryIntent.type) {
        case "element_lookup":
          if (bimQueryIntent.globalId) {
            // Direct lookup by ID
            const element = await lookupBimElementById(
              supabase,
              projectContext.id,
              bimQueryIntent.globalId
            );
            if (element) {
              bimElements = [element];
            }
          } else if (bimQueryIntent.elementName) {
            // Search by name
            bimElements = await searchBimElementsByName(
              supabase,
              projectContext.id,
              bimQueryIntent.elementName
            );
          }
          break;

        case "property_search":
          if (bimQueryIntent.propertyFilter) {
            bimElements = await searchBimElementsByProperty(
              supabase,
              projectContext.id,
              bimQueryIntent.propertyFilter.path,
              bimQueryIntent.propertyFilter.value || null,
              {
                category: bimQueryIntent.category,
                level: bimQueryIntent.level,
              }
            );
          }
          break;

        case "semantic_search":
          bimElements = await searchBimElementsSemantic(
            supabase,
            projectContext.id,
            queryEmbedding,
            {
              category: bimQueryIntent.category,
              level: bimQueryIntent.level,
              matchThreshold: 0.65,
              matchCount: 10,
            }
          );
          break;

        case "count_query":
          // For count queries, we still fetch elements but format differently
          const countResult = await countBimElements(
            supabase,
            projectContext.id,
            {
              category: bimQueryIntent.category,
              level: bimQueryIntent.level,
            }
          );
          // Create a summary context instead of element details
          bimContext = `## BIM MODEL COUNT QUERY\n\n`;
          bimContext += `**Total Elements Matching:** ${countResult.count}\n\n`;
          if (countResult.breakdown && Object.keys(countResult.breakdown).length > 0) {
            bimContext += "**Breakdown by Category:**\n";
            for (const [cat, count] of Object.entries(countResult.breakdown)) {
              bimContext += `- ${cat}: ${count}\n`;
            }
          }
          break;
      }

      // Format BIM context if we have elements (and didn't already set context for count query)
      if (bimElements.length > 0 && !bimContext) {
        bimContext = formatBimContext(bimElements, bimQueryIntent);
      }

      console.log(`[RetrieveComplianceData] BIM query returned ${bimElements.length} elements`);
    }
  }

  // Step 3: Phase 1 - Chapter Routing (if enabled and no explicit chapter)
  let routedChapters: ChapterMatch[] = [];
  let routingTime = 0;

  if (enableChapterRouting && !options.chapter && libraryId) {
    console.log("[RetrieveComplianceData] Phase 1: Routing to chapters...");
    const routingStart = Date.now();
    routedChapters = await routeToChapters(supabase, queryEmbedding, libraryId);
    routingTime = Date.now() - routingStart;

    if (routedChapters.length > 0) {
      console.log(
        `[RetrieveComplianceData] Routed to chapters: ${routedChapters.map((c) => c.chapterNumber).join(", ")}`
      );
    } else {
      console.log("[RetrieveComplianceData] No chapter routing results, will search all chapters");
    }
  }

  // Determine which chapters to search
  const chaptersToSearch = options.chapter
    ? [options.chapter] // Explicit chapter provided
    : routedChapters.length > 0
      ? routedChapters.map((c) => c.chapterNumber) // Use routed chapters
      : undefined; // Search all

  // ==========================================================================
  // Step 4: Phase 2 - Parallel Search (Design + Code)
  // ==========================================================================
  console.log("[RetrieveComplianceData] Phase 2: Searching design specs and code sections...");
  const searchStart = Date.now();

  // Step 4A: Search project_specs (Design Requirements) - if we have a project ID
  // Step 4B: Search code_sections (Code Requirements) - always
  const [designRequirements, textChunks, tableContext] = await Promise.all([
    // STEP A: Design Requirements (from project_specs)
    projectContext?.id
      ? searchProjectSpecs(supabase, projectContext.id, queryEmbedding, {
          matchThreshold: options.specMatchThreshold ?? SPEC_MATCH_THRESHOLD,
          matchCount: options.specMatchCount ?? SPEC_MATCH_COUNT,
        })
      : Promise.resolve([]),

    // STEP B: Code Requirements (from code_sections)
    searchTextChunks(supabase, userQuery, queryEmbedding, {
      libraryId,
      jurisdiction: options.jurisdiction,
      codeName: options.codeName,
      chapters: chaptersToSearch,
      matchThreshold: options.textMatchThreshold,
      matchCount: options.textMatchCount,
    }),

    // Code Tables (from code_tables)
    searchCodeTables(supabase, userQuery, queryEmbedding, {
      libraryId,
      jurisdiction: options.jurisdiction,
      codeName: options.codeName,
      chapter: chaptersToSearch?.[0], // Tables typically in primary chapter
      matchThreshold: options.tableMatchThreshold ?? TABLE_MATCH_THRESHOLD,
      matchCount: options.tableMatchCount,
    }),
  ]);

  const searchTime = Date.now() - searchStart;

  // ==========================================================================
  // Step 5: Context Assembly
  // ==========================================================================
  // Combine Design Requirements + Code Requirements for LLM
  // Instruction: Design specs override code if stricter

  let textContext = "";
  let designContext: string | undefined;

  // BIM Context (if applicable)
  if (bimContext) {
    textContext += bimContext + "\n\n---\n\n";
  }

  // Design Requirements (from project_specs) - THE DESIGN TARGET
  if (designRequirements.length > 0) {
    designContext = formatDesignContext(designRequirements);
    textContext += designContext;
    textContext += "\n---\n\n";
  }

  // Code Requirements (from code_sections) - THE LEGAL MINIMUM
  textContext += "## CODE REQUIREMENTS (Building Code - Legal Minimum)\n\n";
  textContext +=
    "These are the legal requirements from the applicable building code.\n";
  textContext +=
    "**Compare against Design Requirements above. Report BOTH limits.**\n\n";
  textContext += formatTextContext(textChunks, routedChapters);

  // Add instruction for LLM at the end
  textContext += "\n\n---\n\n";
  textContext += "## ANALYSIS INSTRUCTIONS\n\n";
  textContext +=
    "1. Compare 'Design Requirements' (project specs) against 'Code Requirements' (FBC).\n";
  textContext +=
    "2. The Design Requirements usually override the Code when they are STRICTER.\n";
  textContext += "3. Report BOTH limits in your response:\n";
  textContext += "   - **Code Minimum:** The legal baseline from building code\n";
  textContext += "   - **Design Requirement:** The project-specific requirement (if stricter)\n";
  textContext += "   - **Governing Limit:** Which one applies (typically the stricter one)\n";

  console.log(
    `[RetrieveComplianceData] Found ${designRequirements.length} design specs, ${textChunks.length} code sections, ${tableContext.length} tables, ${bimElements.length} BIM elements in ${Date.now() - startTime}ms`
  );
  console.log(
    `[RetrieveComplianceData] Timing: embedding=${embeddingTime}ms, routing=${routingTime}ms, search=${searchTime}ms`
  );

  return {
    textContext,
    textChunks,
    tableContext,
    routedChapters,
    query: userQuery,
    libraryId,
    embeddingTime,
    routingTime,
    searchTime,
    // Design Requirements (from project_specs)
    designRequirements,
    designContext,
    // BIM data
    bimElements: bimElements.length > 0 ? bimElements : undefined,
    bimContext,
    bimQueryIntent: bimQueryIntent.type !== "none" ? bimQueryIntent : undefined,
  };
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Quick retrieval with project context
 */
export async function quickRetrieve(
  query: string,
  projectContext?: RAGProjectContext,
  options: {
    chapter?: string;
  } = {}
): Promise<{
  textContext: string;
  tables: Array<{ tableId: string; data: unknown }>;
  routedChapters: ChapterMatch[];
  stats: {
    textChunks: number;
    tables: number;
    totalTime: number;
    libraryId: string | null;
  };
}> {
  const startTime = Date.now();

  const result = await retrieveComplianceData(query, projectContext, {
    chapter: options.chapter,
    textMatchCount: 5,
    tableMatchThreshold: 0.8,
  });

  return {
    textContext: result.textContext,
    tables: result.tableContext.map((t) => ({
      tableId: t.tableId,
      data: t.data,
    })),
    routedChapters: result.routedChapters,
    stats: {
      textChunks: result.textChunks.length,
      tables: result.tableContext.length,
      totalTime: Date.now() - startTime,
      libraryId: result.libraryId,
    },
  };
}

/**
 * Retrieve for a specific state (convenience wrapper)
 */
export async function retrieveForState(
  query: string,
  state: string,
  options: {
    chapter?: string;
    textMatchCount?: number;
  } = {}
): Promise<ComplianceData> {
  return retrieveComplianceData(
    query,
    { id: "temp", state },
    {
      chapter: options.chapter,
      textMatchCount: options.textMatchCount,
    }
  );
}
