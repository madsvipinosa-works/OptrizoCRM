import { createGoogleGenerativeAI } from "@ai-sdk/google";

export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-pro";

export const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
});

/**
 * Returns the configured Gemini model instance.
 * Defaults to "gemini-1.5-pro" for high reasoning quality,
 * and allows dynamic override via the GEMINI_MODEL environment variable.
 */
export function getAIModel(overrideModel?: string) {
  const modelName = overrideModel || process.env.GEMINI_MODEL || "gemini-1.5-pro";
  return googleAI(modelName);
}
