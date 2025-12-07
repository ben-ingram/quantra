/**
 * Code Book Ingestion Library
 *
 * Export all ingestion utilities for easy importing.
 */

export {
  extractPdfText,
  extractFirstPages,
  chunkText,
  chunkBySection,
  type PdfPage,
  type PdfExtractionResult,
} from "./pdf-extractor";

export {
  extractChapterMetadata,
  extractChapterFromFilename,
  generateChapterEmbeddingText,
  type ChapterMetadata,
  type ChapterExtractionResult,
} from "./chapter-extractor";

export {
  generateEmbedding,
  generateEmbeddingsBatch,
  formatEmbeddingForSupabase,
  type EmbeddingResult,
  type BatchEmbeddingResult,
} from "./embeddings";
