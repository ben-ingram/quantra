/**
 * Chapter Metadata Extraction using LLM
 *
 * Extracts chapter number and title from PDF text using OpenAI.
 */

import OpenAI from "openai";

// =============================================================================
// Types
// =============================================================================

export interface ChapterMetadata {
  number: string;
  title: string;
  description?: string;
  topics?: string[];
}

export interface ChapterExtractionResult {
  success: boolean;
  metadata?: ChapterMetadata;
  error?: string;
  rawResponse?: string;
}

// =============================================================================
// OpenAI Client
// =============================================================================

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// =============================================================================
// Extraction Functions
// =============================================================================

/**
 * Extract chapter metadata from the first pages of a PDF chapter
 *
 * @param firstPagesText - Text from the first 1-2 pages of the PDF
 * @param filename - Original filename (used as fallback hint)
 * @returns Extracted chapter metadata
 */
export async function extractChapterMetadata(
  firstPagesText: string,
  filename?: string
): Promise<ChapterExtractionResult> {
  const openai = getOpenAI();

  // Truncate text if too long (keep first ~4000 chars)
  const truncatedText = firstPagesText.slice(0, 4000);

  const prompt = `You are analyzing the first pages of a building code chapter PDF.

Extract the Chapter Number and Chapter Title from the following text.

Rules:
1. The chapter number should be just the number (e.g., "10", "3", "11A")
2. The chapter title should be the official title (e.g., "Means of Egress", "Accessibility")
3. Also provide a brief description of what this chapter covers
4. List 3-5 key topics this chapter addresses

${filename ? `Filename hint: ${filename}` : ""}

TEXT FROM PDF:
---
${truncatedText}
---

Respond with ONLY valid JSON in this exact format:
{
  "number": "10",
  "title": "Means of Egress",
  "description": "Requirements for exit access, exits, and exit discharge including doors, stairs, ramps, corridors, and emergency lighting.",
  "topics": ["egress", "exits", "stairs", "doors", "emergency lighting"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert at analyzing building code documents. You extract structured information accurately and return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim();

    if (!content) {
      return {
        success: false,
        error: "Empty response from LLM",
      };
    }

    // Parse JSON response
    try {
      // Handle potential markdown code blocks
      let jsonStr = content;
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "");
      }

      const parsed = JSON.parse(jsonStr) as ChapterMetadata;

      // Validate required fields
      if (!parsed.number || !parsed.title) {
        return {
          success: false,
          error: "Missing required fields in response",
          rawResponse: content,
        };
      }

      return {
        success: true,
        metadata: {
          number: parsed.number.toString(),
          title: parsed.title,
          description: parsed.description,
          topics: parsed.topics,
        },
      };
    } catch (parseError) {
      return {
        success: false,
        error: `Failed to parse JSON: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
        rawResponse: content,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `OpenAI API error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Fallback extraction using regex patterns
 * Used when LLM extraction fails
 */
export function extractChapterFromFilename(
  filename: string
): ChapterMetadata | null {
  // Try various filename patterns
  const patterns = [
    // Chapter_10.pdf, Chapter10.pdf, Chapter-10.pdf
    /(?:Chapter|Ch)[_\-\s]?(\d+[A-Z]?)/i,
    // 10_Means_of_Egress.pdf
    /^(\d+[A-Z]?)[_\-\s]+(.+?)\.pdf$/i,
    // FBC_Ch10_Egress.pdf
    /Ch(\d+[A-Z]?)[_\-\s]+(.+?)\.pdf$/i,
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      const number = match[1];
      // If we captured a title too
      const rawTitle = match[2]?.replace(/[_-]/g, " ").trim();

      return {
        number,
        title: rawTitle || `Chapter ${number}`,
      };
    }
  }

  return null;
}

/**
 * Generate embedding text for a chapter
 * Combines title, description, and topics for better semantic matching
 */
export function generateChapterEmbeddingText(metadata: ChapterMetadata): string {
  const parts = [
    `Chapter ${metadata.number}: ${metadata.title}`,
    metadata.description,
    metadata.topics?.length
      ? `Key topics: ${metadata.topics.join(", ")}`
      : null,
  ].filter(Boolean);

  return parts.join(". ");
}
