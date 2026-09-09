/**
 * Shared Knowledge guidance draft contract (interactive + Gemini Batch).
 * Never verifies or publishes. Model output is untrusted until validateDraft.
 */

import { SchemaError } from "./aiRouting.ts";

export interface GuidanceDraft {
  summary: string;
  notes?: string;
}

export const GUIDANCE_PROMPT_VERSION = "knowledge-guidance-draft-v1";

export const SYSTEM_GENERATE =
  "You write concise canonical Knowledge guidance for homeowners and property managers. " +
  "Guidance is not an article. Target: one or two complete sentences, usually 25–60 words, " +
  "maximum ~90 words. Plain language. Answer: (1) when it applies, (2) what to know or do, " +
  "(3) any jurisdiction/timing/uncertainty qualification present in the structured record. " +
  "Use ONLY supported fields and linked official sources. Do NOT invent legal duties, deadlines, " +
  "frequencies, penalties, insurance consequences, geographic applicability, or professional requirements. " +
  "Do not pad to meet a word count. Return JSON only: " +
  '{"summary":"1-2 sentences","notes":"optional caveats"}.';

export const SYSTEM_IMPROVE =
  "You improve short or circular Knowledge guidance into meaningful homeowner prose. " +
  "Expand and clarify ONLY using the existing guidance, title, applicability, classification, " +
  "trigger, action, evidence, frequency, risk, and linked authoritative sources. " +
  "Target: one or two complete sentences, usually 25–60 words (max ~90). " +
  "Do NOT invent legal duties, deadlines, frequencies, penalties, insurance consequences, " +
  "geographic applicability, or professional requirements. Do not praise the source. " +
  "Return JSON only: {\"summary\":\"improved 1-2 sentences\",\"notes\":\"optional caveats\"}.";

export function guidanceSystemForMode(mode: "generate" | "improve"): string {
  return mode === "improve" ? SYSTEM_IMPROVE : SYSTEM_GENERATE;
}

export function validateDraft(raw: unknown): GuidanceDraft {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SchemaError("Guidance response was not a JSON object");
  }
  const parsed = raw as Record<string, unknown>;
  const summary = String(parsed.summary ?? "").trim();
  if (summary.length < 12) {
    throw new SchemaError("Guidance summary too short");
  }
  if (/^\d{1,6}$/.test(summary) || /^https?:\/\//i.test(summary)) {
    throw new SchemaError("Guidance must not be a row number or URL");
  }
  if (
    /\b(this knowledge (provides|offers)|overall,?\s+this is reliable|enhancing its credibility)\b/i.test(
      summary
    )
  ) {
    throw new SchemaError("Guidance must not use generic AI commentary");
  }
  return {
    summary: summary.slice(0, 900),
    notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
  };
}

export type GuidanceSourceLink = {
  label?: string | null;
  url?: string | null;
  source_type?: string | null;
};

export function buildGuidanceUserPayload(input: {
  mode: "generate" | "improve";
  title: string | null;
  summary: string | null;
  body: string | null;
  attributes: Record<string, unknown> | null;
  applicability: unknown;
  linkedSources: GuidanceSourceLink[];
}): string {
  const attrs = input.attributes ?? {};
  return JSON.stringify({
    mode: input.mode,
    title: input.title,
    existing_guidance: input.summary || input.body || null,
    body: input.body,
    attributes: {
      legal_status: attrs.legal_status ?? attrs.classification ?? null,
      applies_when: attrs.applies_when ?? null,
      action: attrs.action ?? null,
      evidence: attrs.evidence ?? null,
      frequency: attrs.frequency ?? null,
      risk_or_consequence: attrs.risk_or_consequence ?? null,
      trigger_type: attrs.trigger_type ?? null,
    },
    applicability: input.applicability,
    linked_sources: input.linkedSources.map((s) => ({
      label: s.label,
      url: s.url,
      source_type: s.source_type,
    })),
  });
}
