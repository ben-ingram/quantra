"use server";

import { getServiceClient } from "@/app/lib/supabase";
import { openai, MODELS } from "@/app/lib/openai";

// =============================================================================
// Types
// =============================================================================

export interface ExtractedSpec {
  csi_division: string | null;
  section_title: string | null;
  parameter_name: string | null;
  requirement_text: string;
  min_value: number | null;
  max_value: number | null;
  target_value: number | null;
  unit: string | null;
}

export interface IngestionResult {
  success: boolean;
  totalChunks: number;
  totalSpecsExtracted: number;
  totalSpecsInserted: number;
  errors: string[];
}

// =============================================================================
// PDF Text Extraction using unpdf (serverless-compatible)
// =============================================================================

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  // Dynamic import to avoid issues with SSR
  const { extractText } = await import("unpdf");

  const data = new Uint8Array(pdfBuffer);
  const result = await extractText(data, { mergePages: true });

  return result.text as string;
}

// =============================================================================
// CSI Section Chunking
// =============================================================================

interface CSIChunk {
  csiDivision: string | null;
  sectionTitle: string | null;
  content: string;
}

/**
 * Chunk PDF text by CSI MasterFormat sections
 * Looks for patterns like "SECTION 03 30 00" or "SECTION 05 12 00"
 */
function chunkByCSISection(text: string): CSIChunk[] {
  // Pattern to match CSI section headers
  // Examples: "SECTION 03 30 00", "SECTION 05 12 00 - STRUCTURAL STEEL"
  const sectionPattern = /SECTION\s+(\d{2}\s*\d{2}\s*\d{2})\s*[-–—]?\s*([A-Z][A-Za-z\s\-\/&,]+)?/gi;

  const chunks: CSIChunk[] = [];
  const matches: { index: number; division: string; title: string | null }[] = [];

  // Find all section headers
  let match;
  while ((match = sectionPattern.exec(text)) !== null) {
    matches.push({
      index: match.index,
      division: match[1].replace(/\s+/g, ' ').trim(),
      title: match[2]?.trim() || null,
    });
  }

  if (matches.length === 0) {
    // No CSI sections found - treat entire document as one chunk
    console.log("[SpecIngestion] No CSI sections found, using full text as single chunk");
    return [{
      csiDivision: null,
      sectionTitle: null,
      content: text.substring(0, 15000), // Limit size
    }];
  }

  // Extract content between sections
  for (let i = 0; i < matches.length; i++) {
    const startIdx = matches[i].index;
    const endIdx = i < matches.length - 1 ? matches[i + 1].index : text.length;
    const content = text.substring(startIdx, endIdx).trim();

    // Limit chunk size to avoid token limits
    const truncatedContent = content.substring(0, 8000);

    chunks.push({
      csiDivision: matches[i].division,
      sectionTitle: matches[i].title,
      content: truncatedContent,
    });
  }

  console.log(`[SpecIngestion] Found ${chunks.length} CSI sections`);
  return chunks;
}

// =============================================================================
// OpenAI Extraction Prompt
// =============================================================================

const EXTRACTION_SYSTEM_PROMPT = `You are a Specification Extraction Engine for construction project specifications.

Your job is to extract ALL numeric quality tolerances, requirements, and parameters from the provided specification text.

RULES:
1. ONLY extract values that are EXPLICITLY stated in the text. Do NOT hallucinate or infer values.
2. If a value is given as a range (e.g., "4 inches plus/minus 1 inch"), convert it:
   - min_value: 3
   - max_value: 5
   - target_value: 4
3. If only a minimum is given (e.g., "minimum 3000 psi"), set min_value only.
4. If only a maximum is given (e.g., "not to exceed 8 inches"), set max_value only.
5. If an exact value is given (e.g., "slump shall be 4 inches"), set target_value.
6. Extract the unit of measurement (inches, psi, degrees F, mm, etc.)
7. Include the full requirement text for context.
8. Identify the parameter name (e.g., "Slump", "Compressive Strength", "Cover Depth")

OUTPUT FORMAT:
Return a JSON object with a "specs" array. Each spec object must have:
{
  "csi_division": "03 30 00",
  "section_title": "Cast-in-Place Concrete",
  "parameter_name": "Slump",
  "requirement_text": "Concrete slump shall be 4 inches plus or minus 1 inch at point of placement.",
  "min_value": 3,
  "max_value": 5,
  "target_value": 4,
  "unit": "inches"
}

If a field is not applicable, use null.
If no extractable specs are found, return {"specs": []}.

IMPORTANT: Do not hallucinate. Only extract values present in the text.`;

/**
 * Extract specifications from a chunk using OpenAI
 */
async function extractSpecsFromChunk(
  chunk: CSIChunk
): Promise<ExtractedSpec[]> {
  const userPrompt = `Extract all numeric quality tolerances and requirements from this specification section:

CSI DIVISION: ${chunk.csiDivision || "Unknown"}
SECTION TITLE: ${chunk.sectionTitle || "Unknown"}

TEXT:
${chunk.content}

Return a JSON object with a "specs" array containing all extracted specifications.`;

  try {
    const completion = await openai.chat.completions.create({
      model: MODELS.FAST, // Use faster model for extraction
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      console.warn("[SpecIngestion] Empty response from OpenAI");
      return [];
    }

    const parsed = JSON.parse(responseContent);
    const specs = parsed.specs || [];

    // Ensure CSI division and section title are set from chunk
    return specs.map((spec: Partial<ExtractedSpec>) => ({
      csi_division: spec.csi_division || chunk.csiDivision,
      section_title: spec.section_title || chunk.sectionTitle,
      parameter_name: spec.parameter_name || null,
      requirement_text: spec.requirement_text || "",
      min_value: spec.min_value ?? null,
      max_value: spec.max_value ?? null,
      target_value: spec.target_value ?? null,
      unit: spec.unit || null,
    }));
  } catch (error) {
    console.error("[SpecIngestion] OpenAI extraction error:", error);
    return [];
  }
}

// =============================================================================
// Embedding Generation
// =============================================================================

/**
 * Generate embeddings for specs using OpenAI
 */
async function generateEmbeddings(specs: ExtractedSpec[]): Promise<number[][]> {
  if (specs.length === 0) return [];

  // Create embedding text for each spec
  const texts = specs.map((spec) => {
    const parts = [];
    if (spec.parameter_name) parts.push(spec.parameter_name);
    if (spec.section_title) parts.push(spec.section_title);
    if (spec.requirement_text) parts.push(spec.requirement_text.substring(0, 500));
    return parts.join(" - ");
  });

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });

    return response.data.map((item) => item.embedding);
  } catch (error) {
    console.error("[SpecIngestion] Embedding generation error:", error);
    // Return empty arrays as fallback
    return specs.map(() => []);
  }
}

// =============================================================================
// Main Ingestion Function - From URL
// =============================================================================

/**
 * Ingest project specifications from a PDF file URL
 *
 * @param projectId - The project UUID
 * @param fileUrl - URL to the uploaded PDF file (from Supabase Storage or external)
 * @returns Ingestion result with stats
 */
export async function ingestProjectSpecs(
  projectId: string,
  fileUrl: string
): Promise<IngestionResult> {
  const errors: string[] = [];

  // Validate inputs - MUST fail if no PDF provided
  if (!projectId) {
    return {
      success: false,
      totalChunks: 0,
      totalSpecsExtracted: 0,
      totalSpecsInserted: 0,
      errors: ["Project ID is required"],
    };
  }

  if (!fileUrl) {
    return {
      success: false,
      totalChunks: 0,
      totalSpecsExtracted: 0,
      totalSpecsInserted: 0,
      errors: ["File URL is required - no PDF provided"],
    };
  }

  console.log(`[SpecIngestion] Starting ingestion for project ${projectId}`);
  console.log(`[SpecIngestion] File URL: ${fileUrl}`);

  const supabase = getServiceClient();

  try {
    // ==========================================================================
    // STEP 1: Download PDF from URL
    // ==========================================================================
    console.log("[SpecIngestion] Downloading PDF...");

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    console.log(`[SpecIngestion] PDF downloaded: ${pdfBuffer.length} bytes`);

    // Use the buffer ingestion function
    return await ingestProjectSpecsFromBuffer(projectId, pdfBuffer, fileUrl.split('/').pop() || 'uploaded.pdf');

  } catch (error) {
    console.error("[SpecIngestion] Fatal error:", error);
    return {
      success: false,
      totalChunks: 0,
      totalSpecsExtracted: 0,
      totalSpecsInserted: 0,
      errors: [error instanceof Error ? error.message : "Unknown error during ingestion"],
    };
  }
}

// =============================================================================
// Main Ingestion Function - From Buffer
// =============================================================================

/**
 * Ingest project specifications from a PDF buffer
 * Used by the API route that receives file uploads directly
 *
 * @param projectId - The project UUID
 * @param pdfBuffer - PDF file as a Buffer
 * @param fileName - Original file name
 * @returns Ingestion result with stats
 */
export async function ingestProjectSpecsFromBuffer(
  projectId: string,
  pdfBuffer: Buffer,
  fileName: string
): Promise<IngestionResult> {
  const errors: string[] = [];

  // Validate inputs - MUST fail if no PDF provided
  if (!projectId) {
    return {
      success: false,
      totalChunks: 0,
      totalSpecsExtracted: 0,
      totalSpecsInserted: 0,
      errors: ["Project ID is required"],
    };
  }

  if (!pdfBuffer || pdfBuffer.length === 0) {
    return {
      success: false,
      totalChunks: 0,
      totalSpecsExtracted: 0,
      totalSpecsInserted: 0,
      errors: ["PDF buffer is empty - no file provided"],
    };
  }

  console.log(`[SpecIngestion] Starting buffer ingestion for project ${projectId}`);
  console.log(`[SpecIngestion] File: ${fileName}, Size: ${pdfBuffer.length} bytes`);

  const supabase = getServiceClient();

  try {
    // ==========================================================================
    // STEP 1: Extract text from PDF buffer
    // ==========================================================================
    console.log("[SpecIngestion] Extracting text from PDF...");

    const fullText = await extractTextFromPdf(pdfBuffer);

    if (!fullText || fullText.trim().length === 0) {
      throw new Error("No text extracted from PDF - file may be image-based or corrupted");
    }

    console.log(`[SpecIngestion] Extracted ${fullText.length} characters`);

    // ==========================================================================
    // STEP 2: Chunk by CSI Section
    // ==========================================================================
    console.log("[SpecIngestion] Chunking by CSI sections...");

    const chunks = chunkByCSISection(fullText);
    console.log(`[SpecIngestion] Created ${chunks.length} chunks`);

    // ==========================================================================
    // STEP 3: Extract specs from each chunk using OpenAI
    // ==========================================================================
    console.log("[SpecIngestion] Extracting specifications with OpenAI...");

    const allSpecs: ExtractedSpec[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[SpecIngestion] Processing chunk ${i + 1}/${chunks.length}: ${chunk.csiDivision || 'Unknown'}`);

      try {
        const specs = await extractSpecsFromChunk(chunk);
        allSpecs.push(...specs);
        console.log(`[SpecIngestion] Extracted ${specs.length} specs from chunk ${i + 1}`);
      } catch (chunkError) {
        const errorMsg = `Error processing chunk ${i + 1}: ${chunkError instanceof Error ? chunkError.message : 'Unknown error'}`;
        console.error(`[SpecIngestion] ${errorMsg}`);
        errors.push(errorMsg);
      }

      // Small delay to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`[SpecIngestion] Total specs extracted: ${allSpecs.length}`);

    if (allSpecs.length === 0) {
      return {
        success: true,
        totalChunks: chunks.length,
        totalSpecsExtracted: 0,
        totalSpecsInserted: 0,
        errors: ["No specifications extracted from PDF - document may not contain numeric requirements"],
      };
    }

    // ==========================================================================
    // STEP 4: Generate embeddings
    // ==========================================================================
    console.log("[SpecIngestion] Generating embeddings...");

    const embeddings = await generateEmbeddings(allSpecs);
    console.log(`[SpecIngestion] Generated ${embeddings.length} embeddings`);

    // ==========================================================================
    // STEP 5: Insert into project_specs table
    // ==========================================================================
    console.log("[SpecIngestion] Inserting into database...");

    // Prepare records for insertion
    const records = allSpecs.map((spec, index) => ({
      project_id: projectId,
      csi_division: spec.csi_division,
      section_title: spec.section_title,
      parameter_name: spec.parameter_name,
      requirement_text: spec.requirement_text,
      min_value: spec.min_value,
      max_value: spec.max_value,
      target_value: spec.target_value,
      unit: spec.unit,
      embedding: embeddings[index]?.length > 0 ? embeddings[index] : null,
      source_file: fileName,
      metadata: {
        ingested_at: new Date().toISOString(),
        extraction_model: MODELS.FAST,
      },
    }));

    // Insert in batches
    const batchSize = 50;
    let totalInserted = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      const { data, error: insertError } = await supabase
        .from("project_specs")
        .insert(batch)
        .select("id");

      if (insertError) {
        const errorMsg = `Insert error at batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`;
        console.error(`[SpecIngestion] ${errorMsg}`);
        errors.push(errorMsg);
      } else {
        totalInserted += data?.length || 0;
      }
    }

    console.log(`[SpecIngestion] Inserted ${totalInserted} specs into database`);

    return {
      success: true,
      totalChunks: chunks.length,
      totalSpecsExtracted: allSpecs.length,
      totalSpecsInserted: totalInserted,
      errors,
    };

  } catch (error) {
    console.error("[SpecIngestion] Fatal error:", error);
    return {
      success: false,
      totalChunks: 0,
      totalSpecsExtracted: 0,
      totalSpecsInserted: 0,
      errors: [error instanceof Error ? error.message : "Unknown error during ingestion"],
    };
  }
}

// =============================================================================
// Query Specs
// =============================================================================

export async function searchProjectSpecs(
  projectId: string,
  query: string,
  options?: {
    csiDivision?: string;
    matchCount?: number;
    threshold?: number;
  }
): Promise<{
  success: boolean;
  specs: Array<ExtractedSpec & { id: string; similarity: number }>;
  error?: string;
}> {
  try {
    const supabase = getServiceClient();

    // Generate embedding for query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });

    const queryEmbedding = embeddingResponse.data[0]?.embedding;
    if (!queryEmbedding) {
      return { success: false, specs: [], error: "Failed to generate query embedding" };
    }

    // Search using the database function
    const { data, error } = await supabase.rpc("search_project_specs", {
      p_project_id: projectId,
      p_query_embedding: queryEmbedding,
      p_match_threshold: options?.threshold || 0.5,
      p_match_count: options?.matchCount || 10,
    });

    if (error) {
      console.error("[SpecSearch] Error:", error);
      return { success: false, specs: [], error: error.message };
    }

    return { success: true, specs: data || [] };
  } catch (error) {
    console.error("[SpecSearch] Error:", error);
    return {
      success: false,
      specs: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Get Specs by Division
// =============================================================================

export async function getProjectSpecsByDivision(
  projectId: string,
  csiDivision?: string
): Promise<{
  success: boolean;
  specs: Array<ExtractedSpec & { id: string }>;
  error?: string;
}> {
  try {
    const supabase = getServiceClient();

    let query = supabase
      .from("project_specs")
      .select("*")
      .eq("project_id", projectId)
      .order("csi_division")
      .order("parameter_name");

    if (csiDivision) {
      query = query.ilike("csi_division", `%${csiDivision}%`);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, specs: [], error: error.message };
    }

    return { success: true, specs: data || [] };
  } catch (error) {
    return {
      success: false,
      specs: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Get Specs Count
// =============================================================================

export async function getProjectSpecsCount(
  projectId: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const supabase = getServiceClient();

    const { count, error } = await supabase
      .from("project_specs")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId);

    if (error) {
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: count || 0 };
  } catch (error) {
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Delete Specs
// =============================================================================

export async function deleteProjectSpecs(
  projectId: string,
  specIds?: string[]
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    const supabase = getServiceClient();

    let query = supabase.from("project_specs").delete();

    if (specIds && specIds.length > 0) {
      query = query.in("id", specIds);
    } else {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query.select("id");

    if (error) {
      return { success: false, deletedCount: 0, error: error.message };
    }

    return { success: true, deletedCount: data?.length || 0 };
  } catch (error) {
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
