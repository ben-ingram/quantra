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
const TABLE_MATCH_THRESHOLD = 0.82; // Higher threshold - only want highly relevant tables
const TABLE_MATCH_COUNT = 3;

// =============================================================================
// Types
// =============================================================================

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
  vectorScore: number;
  keywordScore: number;
  combinedScore: number;
}

export interface CodeTable {
  id: string;
  tableId: string;
  tableTitle: string | null;
  summary: string;
  data: Record<string, unknown> | unknown[]; // The raw JSONB data
  metadata: Record<string, unknown>;
  jurisdiction: string | null;
  codeName: string | null;
  sectionReference: string | null;
  vectorScore: number;
  keywordScore: number;
  combinedScore: number;
}

export interface ComplianceData {
  textContext: string;
  textChunks: TextChunk[];
  tableContext: CodeTable[];
  query: string;
  embeddingTime: number;
  searchTime: number;
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
// Hybrid Text Search
// =============================================================================

async function searchTextChunks(
  supabase: ReturnType<typeof getSupabaseClient>,
  queryText: string,
  queryEmbedding: number[],
  options: {
    jurisdiction?: string;
    codeName?: string;
    matchThreshold?: number;
    matchCount?: number;
  } = {}
): Promise<TextChunk[]> {
  const {
    jurisdiction,
    codeName,
    matchThreshold = TEXT_MATCH_THRESHOLD,
    matchCount = TEXT_MATCH_COUNT,
  } = options;

  const { data, error } = await supabase.rpc("hybrid_search", {
    query_text: queryText,
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
    filter_jurisdiction: jurisdiction || null,
    filter_code_name: codeName || null,
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
    jurisdiction?: string;
    codeName?: string;
    matchThreshold?: number;
    matchCount?: number;
  } = {}
): Promise<CodeTable[]> {
  const {
    jurisdiction,
    codeName,
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
  });

  if (error) {
    console.error("[RetrieveComplianceData] Table search error:", error);
    // Don't throw - tables are optional, just return empty
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
    vectorScore: row.vector_score as number,
    keywordScore: row.keyword_score as number,
    combinedScore: row.combined_score as number,
  }));
}

// =============================================================================
// Format Text Context
// =============================================================================

function formatTextContext(chunks: TextChunk[]): string {
  if (chunks.length === 0) {
    return "NO RELEVANT CODE SECTIONS FOUND";
  }

  return chunks
    .map((chunk, index) => {
      const sectionInfo = [
        chunk.sectionNumber,
        chunk.sectionTitle,
      ]
        .filter(Boolean)
        .join(" - ");

      const sourceInfo = [
        chunk.codeName,
        chunk.codeVersion,
        chunk.jurisdiction,
      ]
        .filter(Boolean)
        .join(" | ");

      return `### Match ${index + 1} (Combined Score: ${(chunk.combinedScore * 100).toFixed(1)}% | Vector: ${(chunk.vectorScore * 100).toFixed(1)}% | Keyword: ${(chunk.keywordScore * 100).toFixed(1)}%)
**Section:** ${sectionInfo || "Unknown"}
**Source:** ${sourceInfo || "Unknown"}
**Page:** ${chunk.pageNumber || "N/A"}

${chunk.content}
---`;
    })
    .join("\n\n");
}

// =============================================================================
// Main Retrieval Function
// =============================================================================

/**
 * Retrieves compliance data using hybrid search (semantic + keyword).
 *
 * This is the "Router" that:
 * 1. Generates embedding for the query
 * 2. Runs parallel searches on text chunks and code tables
 * 3. Returns structured data for the LLM analyst
 *
 * @param userQuery - The compliance question or defect description
 * @param options - Optional filters for jurisdiction, code name, etc.
 * @returns ComplianceData with textContext string and tableContext array
 */
export async function retrieveComplianceData(
  userQuery: string,
  options: {
    jurisdiction?: string;
    codeName?: string;
    textMatchThreshold?: number;
    textMatchCount?: number;
    tableMatchThreshold?: number;
    tableMatchCount?: number;
  } = {}
): Promise<ComplianceData> {
  const startTime = Date.now();

  // Validate input
  if (!userQuery?.trim()) {
    throw new Error("Query is required");
  }

  const supabase = getSupabaseClient();

  // Step 1: Generate embedding
  console.log("[RetrieveComplianceData] Generating embedding...");
  const embeddingStart = Date.now();
  const queryEmbedding = await generateEmbedding(userQuery);
  const embeddingTime = Date.now() - embeddingStart;

  // Step 2: Run parallel searches
  console.log("[RetrieveComplianceData] Running hybrid searches...");
  const searchStart = Date.now();

  const [textChunks, tableContext] = await Promise.all([
    // Text retrieval with hybrid search
    searchTextChunks(supabase, userQuery, queryEmbedding, {
      jurisdiction: options.jurisdiction,
      codeName: options.codeName,
      matchThreshold: options.textMatchThreshold,
      matchCount: options.textMatchCount,
    }),
    // Table retrieval with higher threshold
    searchCodeTables(supabase, userQuery, queryEmbedding, {
      jurisdiction: options.jurisdiction,
      codeName: options.codeName,
      matchThreshold: options.tableMatchThreshold ?? TABLE_MATCH_THRESHOLD,
      matchCount: options.tableMatchCount,
    }),
  ]);

  const searchTime = Date.now() - searchStart;

  // Step 3: Format text context for LLM
  const textContext = formatTextContext(textChunks);

  console.log(
    `[RetrieveComplianceData] Found ${textChunks.length} text chunks, ${tableContext.length} tables in ${Date.now() - startTime}ms`
  );

  return {
    textContext,
    textChunks,
    tableContext,
    query: userQuery,
    embeddingTime,
    searchTime,
  };
}

// =============================================================================
// Convenience function for quick retrieval
// =============================================================================

/**
 * Quick retrieval with sensible defaults for Florida Building Code
 */
export async function quickRetrieve(
  query: string,
  jurisdiction: string = "Florida"
): Promise<{
  textContext: string;
  tables: Array<{ tableId: string; data: unknown }>;
  stats: { textChunks: number; tables: number; totalTime: number };
}> {
  const startTime = Date.now();

  const result = await retrieveComplianceData(query, {
    jurisdiction,
    textMatchCount: 5,
    tableMatchThreshold: 0.80,
  });

  return {
    textContext: result.textContext,
    tables: result.tableContext.map((t) => ({
      tableId: t.tableId,
      data: t.data,
    })),
    stats: {
      textChunks: result.textChunks.length,
      tables: result.tableContext.length,
      totalTime: Date.now() - startTime,
    },
  };
}
