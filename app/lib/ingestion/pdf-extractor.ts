/**
 * PDF Text Extraction Utilities
 *
 * Extracts text from PDF files with page-level control.
 * Uses unpdf which is designed for serverless/Node.js environments.
 */

import { extractText, getDocumentProxy } from "unpdf";

// =============================================================================
// Types
// =============================================================================

export interface PdfPage {
  pageNumber: number;
  text: string;
}

export interface PdfExtractionResult {
  totalPages: number;
  pages: PdfPage[];
  fullText: string;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
  };
}

// =============================================================================
// Extraction Functions
// =============================================================================

/**
 * Extract text from a PDF buffer
 *
 * @param pdfBuffer - The PDF file as a Buffer
 * @param options - Extraction options
 * @returns Extraction result with pages and metadata
 */
export async function extractPdfText(
  pdfBuffer: Buffer,
  options: {
    maxPages?: number;
    startPage?: number;
  } = {}
): Promise<PdfExtractionResult> {
  const { maxPages, startPage = 1 } = options;

  // Convert Buffer to Uint8Array
  const data = new Uint8Array(pdfBuffer);

  // Get document proxy for metadata
  const pdf = await getDocumentProxy(data);
  const totalPages = pdf.numPages;

  // Calculate page range
  const endPage = maxPages ? Math.min(startPage + maxPages - 1, totalPages) : totalPages;

  const pages: PdfPage[] = [];
  const pageTexts: string[] = [];

  // Extract text from each page
  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Combine text items into a single string
    const pageText = textContent.items
      .map((item: { str?: string }) => item.str || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    pages.push({
      pageNumber: pageNum,
      text: pageText,
    });
    pageTexts.push(pageText);
  }

  // Get metadata
  let metadata: PdfExtractionResult["metadata"] = {};
  try {
    const metaResult = await pdf.getMetadata();
    const info = metaResult?.info as Record<string, string> | undefined;
    metadata = {
      title: info?.Title,
      author: info?.Author,
      subject: info?.Subject,
      creator: info?.Creator,
    };
  } catch {
    // Metadata extraction can fail for some PDFs
  }

  return {
    totalPages,
    pages,
    fullText: pageTexts.join("\n\n"),
    metadata,
  };
}

/**
 * Simple text extraction using unpdf's built-in extractText
 * More reliable for basic use cases
 */
export async function extractPdfTextSimple(
  pdfBuffer: Buffer
): Promise<{ text: string; totalPages: number }> {
  const data = new Uint8Array(pdfBuffer);
  const { text, totalPages } = await extractText(data, { mergePages: true });
  return { text: text as string, totalPages };
}

/**
 * Extract only the first N pages of a PDF
 * Useful for extracting chapter title/metadata
 */
export async function extractFirstPages(
  pdfBuffer: Buffer,
  pageCount: number = 2
): Promise<string> {
  const result = await extractPdfText(pdfBuffer, { maxPages: pageCount });
  return result.pages.map((p) => p.text).join("\n\n");
}

/**
 * Split PDF text into chunks suitable for embedding
 */
export function chunkText(
  text: string,
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
    separator?: string;
  } = {}
): string[] {
  const {
    chunkSize = 1500,
    chunkOverlap = 200,
    separator = "\n",
  } = options;

  // First, split by separator
  const segments = text.split(separator).filter((s) => s.trim());

  const chunks: string[] = [];
  let currentChunk = "";

  for (const segment of segments) {
    const trimmedSegment = segment.trim();

    // If adding this segment would exceed chunk size
    if (currentChunk.length + trimmedSegment.length + 1 > chunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());

        // Start new chunk with overlap from previous
        const words = currentChunk.split(" ");
        const overlapWords = words.slice(-Math.floor(chunkOverlap / 5));
        currentChunk = overlapWords.join(" ") + " " + trimmedSegment;
      } else {
        // Segment itself is too long, force split
        let remaining = trimmedSegment;
        while (remaining.length > chunkSize) {
          chunks.push(remaining.slice(0, chunkSize));
          remaining = remaining.slice(chunkSize - chunkOverlap);
        }
        currentChunk = remaining;
      }
    } else {
      currentChunk += (currentChunk ? " " : "") + trimmedSegment;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Enhanced chunking that preserves section boundaries
 * Attempts to detect section numbers (e.g., "1011.5.2") and keep them together
 */
export function chunkBySection(
  text: string,
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
  } = {}
): Array<{ text: string; sectionNumber?: string }> {
  const { chunkSize = 1500, chunkOverlap = 200 } = options;

  // Regex to match section numbers like "1011.5.2" or "1011.5.2.1"
  const sectionPattern = /\b(\d{3,4}(?:\.\d+)+)\b/g;

  // Split text by section numbers while keeping them
  const parts = text.split(sectionPattern);

  const chunks: Array<{ text: string; sectionNumber?: string }> = [];
  let currentChunk = "";
  let currentSection: string | undefined;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Check if this part is a section number
    if (/^\d{3,4}(?:\.\d+)+$/.test(part)) {
      // If we have accumulated text, save it
      if (currentChunk.trim().length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          sectionNumber: currentSection,
        });
      }
      currentSection = part;
      currentChunk = part + " ";
      continue;
    }

    // Regular text
    if (currentChunk.length + part.length > chunkSize) {
      // Save current chunk
      if (currentChunk.trim().length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          sectionNumber: currentSection,
        });
      }

      // Start new chunk with overlap
      const words = currentChunk.split(" ");
      const overlapWords = words.slice(-Math.floor(chunkOverlap / 5));
      currentChunk = overlapWords.join(" ") + " " + part;
    } else {
      currentChunk += part;
    }
  }

  // Final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      sectionNumber: currentSection,
    });
  }

  return chunks;
}
