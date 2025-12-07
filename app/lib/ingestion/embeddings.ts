/**
 * Embedding Generation Utilities
 *
 * Generates vector embeddings using OpenAI's embedding models.
 */

import OpenAI from "openai";

// =============================================================================
// Types
// =============================================================================

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  totalTokens: number;
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
// Embedding Functions
// =============================================================================

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const openai = getOpenAI();

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 1536,
  });

  return {
    embedding: response.data[0].embedding,
    tokenCount: response.usage?.total_tokens || 0,
  };
}

/**
 * Generate embeddings for multiple texts in batch
 * OpenAI supports up to 2048 inputs per request
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  options: {
    batchSize?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<BatchEmbeddingResult> {
  const { batchSize = 100, onProgress } = options;
  const openai = getOpenAI();

  const allEmbeddings: number[][] = [];
  let totalTokens = 0;

  // Process in batches
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
      dimensions: 1536,
    });

    // Embeddings come back in same order as input
    for (const item of response.data) {
      allEmbeddings.push(item.embedding);
    }

    totalTokens += response.usage?.total_tokens || 0;

    if (onProgress) {
      onProgress(Math.min(i + batchSize, texts.length), texts.length);
    }

    // Small delay between batches to avoid rate limits
    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return {
    embeddings: allEmbeddings,
    totalTokens,
  };
}

/**
 * Format embedding array for Supabase pgvector
 * Supabase expects embeddings as a string representation of the array
 */
export function formatEmbeddingForSupabase(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
