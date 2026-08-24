/** Current Gemini Flash model for direct API calls (override via GEMINI_FLASH_MODEL). */
export const GEMINI_FLASH_MODEL =
  Deno.env.get("GEMINI_FLASH_MODEL")?.trim() || "gemini-3.6-flash";

export function geminiGenerateContentUrl(
  model: string = GEMINI_FLASH_MODEL,
  apiKey: string
): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}

/** Dedicated Gemini key for platform Knowledge intake (workbook, doc proposals, critic). */
export function knowledgeGeminiApiKey(): string | undefined {
  const dedicated = Deno.env.get("FILLA_KNOWLEDGE_GEMINI_API_KEY")?.trim();
  if (dedicated) return dedicated;
  return Deno.env.get("GEMINI_API_KEY")?.trim() || undefined;
}

/** General Gemini key for org-facing AI (documents, images, compliance, etc.). */
export function generalGeminiApiKey(): string | undefined {
  const general = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (general) return general;
  return Deno.env.get("FILLA_KNOWLEDGE_GEMINI_API_KEY")?.trim() || undefined;
}

export function hasGeminiProvider(): boolean {
  return Boolean(generalGeminiApiKey());
}
