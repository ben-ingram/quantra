"use server";

/**
 * Code Book Ingestion Server Actions
 *
 * Handles ingestion of building code PDFs into the code library system.
 */

import { createClient } from "@supabase/supabase-js";
import {
  extractPdfText,
  extractFirstPages,
  chunkBySection,
} from "@/app/lib/ingestion/pdf-extractor";
import {
  extractChapterMetadata,
  extractChapterFromFilename,
  generateChapterEmbeddingText,
  type ChapterMetadata,
} from "@/app/lib/ingestion/chapter-extractor";
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  formatEmbeddingForSupabase,
} from "@/app/lib/ingestion/embeddings";

// =============================================================================
// Types
// =============================================================================

export interface CodeLibraryInput {
  name: string;
  shortName?: string;
  state: string;
  jurisdiction?: string;
  version?: string;
  description?: string;
}

export interface ChapterPdfInput {
  filename: string;
  data: string; // Base64 encoded PDF data
}

export interface IngestionProgress {
  stage: "initializing" | "extracting" | "chunking" | "embedding" | "saving" | "complete" | "error";
  currentChapter?: string;
  chaptersProcessed: number;
  totalChapters: number;
  sectionsProcessed: number;
  totalSections: number;
  message: string;
}

export interface IngestionResult {
  success: boolean;
  libraryId?: string;
  chaptersCreated: number;
  sectionsCreated: number;
  errors: string[];
  totalTokensUsed: number;
}

export interface ChapterIngestionResult {
  success: boolean;
  chapterId?: string;
  chapterNumber?: string;
  chapterTitle?: string;
  sectionsCreated: number;
  error?: string;
}

// =============================================================================
// Supabase Client
// =============================================================================

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(url, key);
}

// =============================================================================
// Library Management
// =============================================================================

/**
 * Create a new code library entry
 */
export async function createCodeLibrary(
  input: CodeLibraryInput
): Promise<{ id: string } | { error: string }> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("code_libraries")
    .insert({
      name: input.name,
      short_name: input.shortName,
      state: input.state,
      jurisdiction: input.jurisdiction || "Statewide",
      version: input.version,
      description: input.description,
      status: "draft", // Start as draft until ingestion complete
    })
    .select("id")
    .single();

  if (error) {
    console.error("[Ingestion] Failed to create library:", error);
    return { error: error.message };
  }

  return { id: data.id };
}

/**
 * Activate a code library after successful ingestion
 */
export async function activateCodeLibrary(
  libraryId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();

  // First, deactivate any existing active library for the same state/jurisdiction
  const { data: library } = await supabase
    .from("code_libraries")
    .select("state, jurisdiction")
    .eq("id", libraryId)
    .single();

  if (library) {
    await supabase
      .from("code_libraries")
      .update({ status: "superseded" })
      .eq("state", library.state)
      .eq("jurisdiction", library.jurisdiction)
      .eq("status", "active");
  }

  // Activate the new library
  const { error } = await supabase
    .from("code_libraries")
    .update({ status: "active" })
    .eq("id", libraryId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get all code libraries
 */
export async function getCodeLibraries(): Promise<
  Array<{
    id: string;
    name: string;
    shortName: string | null;
    state: string;
    jurisdiction: string;
    version: string | null;
    status: string;
    chapterCount: number;
    sectionCount: number;
  }>
> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc("get_code_libraries");

  if (error) {
    console.error("[Ingestion] Failed to get libraries:", error);
    return [];
  }

  return (data || []).map((lib: Record<string, unknown>) => ({
    id: lib.id as string,
    name: lib.name as string,
    shortName: lib.short_name as string | null,
    state: lib.state as string,
    jurisdiction: lib.jurisdiction as string,
    version: lib.version as string | null,
    status: lib.status as string,
    chapterCount: Number(lib.chapter_count) || 0,
    sectionCount: Number(lib.section_count) || 0,
  }));
}

// =============================================================================
// Chapter Ingestion
// =============================================================================

/**
 * Ingest a single chapter PDF
 *
 * 1. Extract first 2 pages for metadata
 * 2. Use LLM to extract chapter number and title
 * 3. Create code_structure entry with embedding
 * 4. Chunk the full PDF text
 * 5. Generate embeddings for all chunks
 * 6. Insert into code_sections
 */
export async function ingestChapterPdf(
  libraryId: string,
  pdf: ChapterPdfInput
): Promise<ChapterIngestionResult> {
  const supabase = getSupabaseAdmin();

  try {
    console.log(`[Ingestion] Processing chapter: ${pdf.filename}`);

    // Decode base64 PDF data
    const base64Data = pdf.data.split(",")[1] || pdf.data;
    const pdfBuffer = Buffer.from(base64Data, "base64");

    // Step 1: Extract first pages for metadata
    console.log("[Ingestion] Extracting first pages...");
    const firstPagesText = await extractFirstPages(pdfBuffer, 2);

    // Step 2: Extract chapter metadata using LLM
    console.log("[Ingestion] Extracting chapter metadata with LLM...");
    let chapterMetadata: ChapterMetadata | null = null;

    const llmResult = await extractChapterMetadata(firstPagesText, pdf.filename);
    if (llmResult.success && llmResult.metadata) {
      chapterMetadata = llmResult.metadata;
      console.log(`[Ingestion] LLM extracted: Chapter ${chapterMetadata.number} - ${chapterMetadata.title}`);
    } else {
      // Fallback to filename extraction
      console.log("[Ingestion] LLM extraction failed, trying filename fallback...");
      chapterMetadata = extractChapterFromFilename(pdf.filename);

      if (!chapterMetadata) {
        return {
          success: false,
          sectionsCreated: 0,
          error: `Failed to extract chapter metadata: ${llmResult.error || "Unknown error"}`,
        };
      }
      console.log(`[Ingestion] Filename extracted: Chapter ${chapterMetadata.number} - ${chapterMetadata.title}`);
    }

    // Step 3: Generate embedding for chapter title
    console.log("[Ingestion] Generating chapter embedding...");
    const chapterEmbeddingText = generateChapterEmbeddingText(chapterMetadata);
    const chapterEmbedding = await generateEmbedding(chapterEmbeddingText);

    // Step 4: Insert/update code_structure entry
    console.log("[Ingestion] Saving chapter structure...");
    const { data: chapterData, error: chapterError } = await supabase
      .from("code_structure")
      .upsert(
        {
          library_id: libraryId,
          chapter_number: chapterMetadata.number,
          chapter_title: chapterMetadata.title,
          description: chapterMetadata.description,
          topics: chapterMetadata.topics,
          embedding: formatEmbeddingForSupabase(chapterEmbedding.embedding),
        },
        {
          onConflict: "library_id,chapter_number",
        }
      )
      .select("id")
      .single();

    if (chapterError) {
      console.error("[Ingestion] Chapter insert error:", chapterError);
      return {
        success: false,
        sectionsCreated: 0,
        error: `Failed to save chapter structure: ${chapterError.message}`,
      };
    }

    const chapterId = chapterData.id;

    // Step 5: Extract full text and chunk
    console.log("[Ingestion] Extracting full PDF text...");
    const fullPdf = await extractPdfText(pdfBuffer);
    const chunks = chunkBySection(fullPdf.fullText, {
      chunkSize: 1500,
      chunkOverlap: 200,
    });

    console.log(`[Ingestion] Created ${chunks.length} chunks`);

    if (chunks.length === 0) {
      return {
        success: true,
        chapterId,
        chapterNumber: chapterMetadata.number,
        chapterTitle: chapterMetadata.title,
        sectionsCreated: 0,
      };
    }

    // Step 6: Generate embeddings for all chunks
    console.log("[Ingestion] Generating embeddings for chunks...");
    const chunkTexts = chunks.map((c) => c.text);
    const embeddingsResult = await generateEmbeddingsBatch(chunkTexts, {
      batchSize: 50,
      onProgress: (completed, total) => {
        console.log(`[Ingestion] Embeddings: ${completed}/${total}`);
      },
    });

    // Step 7: Prepare code_sections records
    console.log("[Ingestion] Preparing section records...");
    const sectionRecords = chunks.map((chunk, index) => ({
      library_id: libraryId,
      chapter_id: chapterId,
      chapter: chapterMetadata!.number,
      content: chunk.text,
      section_number: chunk.sectionNumber || null,
      section_title: null, // Could be extracted with more processing
      embedding: formatEmbeddingForSupabase(embeddingsResult.embeddings[index]),
      metadata: {
        filename: pdf.filename,
        chapterTitle: chapterMetadata!.title,
        chunkIndex: index,
        totalChunks: chunks.length,
      },
      jurisdiction: null, // Will be set from library
      code_name: null, // Will be set from library
    }));

    // Step 8: Batch insert into code_sections
    console.log("[Ingestion] Inserting sections...");
    const batchSize = 100;
    let sectionsCreated = 0;

    for (let i = 0; i < sectionRecords.length; i += batchSize) {
      const batch = sectionRecords.slice(i, i + batchSize);

      const { error: insertError } = await supabase
        .from("code_sections")
        .insert(batch);

      if (insertError) {
        console.error(`[Ingestion] Section insert error (batch ${i}):`, insertError);
        // Continue with other batches
      } else {
        sectionsCreated += batch.length;
      }
    }

    // Update section count in code_structure
    await supabase
      .from("code_structure")
      .update({ section_count: sectionsCreated })
      .eq("id", chapterId);

    console.log(`[Ingestion] Chapter ${chapterMetadata.number} complete: ${sectionsCreated} sections`);

    return {
      success: true,
      chapterId,
      chapterNumber: chapterMetadata.number,
      chapterTitle: chapterMetadata.title,
      sectionsCreated,
    };
  } catch (error) {
    console.error("[Ingestion] Chapter ingestion error:", error);
    return {
      success: false,
      sectionsCreated: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Full Code Book Ingestion
// =============================================================================

/**
 * Ingest a complete code book (multiple chapter PDFs)
 *
 * @param library - Library metadata
 * @param chapters - Array of chapter PDFs
 * @returns Ingestion result with statistics
 */
export async function ingestCodeBook(
  library: CodeLibraryInput,
  chapters: ChapterPdfInput[]
): Promise<IngestionResult> {
  const errors: string[] = [];
  let totalSectionsCreated = 0;
  let chaptersCreated = 0;
  let totalTokensUsed = 0;

  console.log(`[Ingestion] Starting code book ingestion: ${library.name}`);
  console.log(`[Ingestion] Processing ${chapters.length} chapters`);

  // Step 1: Create the library
  const libraryResult = await createCodeLibrary(library);

  if ("error" in libraryResult) {
    return {
      success: false,
      chaptersCreated: 0,
      sectionsCreated: 0,
      errors: [libraryResult.error],
      totalTokensUsed: 0,
    };
  }

  const libraryId = libraryResult.id;
  console.log(`[Ingestion] Created library with ID: ${libraryId}`);

  // Step 2: Process each chapter
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    console.log(`[Ingestion] Processing chapter ${i + 1}/${chapters.length}: ${chapter.filename}`);

    const result = await ingestChapterPdf(libraryId, chapter);

    if (result.success) {
      chaptersCreated++;
      totalSectionsCreated += result.sectionsCreated;
    } else {
      errors.push(`${chapter.filename}: ${result.error}`);
    }
  }

  // Step 3: Activate library if successful
  if (chaptersCreated > 0) {
    const activateResult = await activateCodeLibrary(libraryId);
    if (!activateResult.success) {
      errors.push(`Failed to activate library: ${activateResult.error}`);
    }
  }

  console.log(`[Ingestion] Complete: ${chaptersCreated} chapters, ${totalSectionsCreated} sections`);

  return {
    success: errors.length === 0,
    libraryId,
    chaptersCreated,
    sectionsCreated: totalSectionsCreated,
    errors,
    totalTokensUsed,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Delete a code library and all associated data
 */
export async function deleteCodeLibrary(
  libraryId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();

  // Delete sections first (due to FK constraints)
  await supabase.from("code_sections").delete().eq("library_id", libraryId);

  // Delete structure
  await supabase.from("code_structure").delete().eq("library_id", libraryId);

  // Delete library
  const { error } = await supabase
    .from("code_libraries")
    .delete()
    .eq("id", libraryId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get chapter structure for a library
 */
export async function getLibraryChapters(
  libraryId: string
): Promise<
  Array<{
    id: string;
    chapterNumber: string;
    chapterTitle: string;
    description: string | null;
    sectionCount: number;
  }>
> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("code_structure")
    .select("id, chapter_number, chapter_title, description, section_count")
    .eq("library_id", libraryId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[Ingestion] Failed to get chapters:", error);
    return [];
  }

  return (data || []).map((ch) => ({
    id: ch.id,
    chapterNumber: ch.chapter_number,
    chapterTitle: ch.chapter_title,
    description: ch.description,
    sectionCount: ch.section_count || 0,
  }));
}
