import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Model configuration
export const MODELS = {
  // GPT-4o for complex reasoning tasks like compliance analysis
  REASONING: "gpt-4o",
  // GPT-4o-mini for faster, simpler tasks
  FAST: "gpt-4o-mini",
} as const;
