import {
  looksLikeLandlordGasKnowledge,
  durableGasKnowledgeTitle,
} from "./knowledgeFieldInference.ts";

/**
 * Reject storage/path stubs used as Knowledge titles (e.g. fr.txt, F20744.txt).
 * Those come from HTML→txt intake when analysis falls back to the URL path segment.
 */

export function isOpaqueKnowledgeTitle(title: string | null | undefined): boolean {
  const t = (title ?? "").trim();
  if (!t) return true;
  if (t.length > 200) return true;
  // Filename with common intake extension
  if (/\.(txt|html?|pdf|docx?|csv|md)$/i.test(t)) return true;
  // Bare language / locale stub (Fedlex …/fr)
  if (/^(fr|en|de|it|es|nl|pt|pl|ru|zh|ja|ar)$/i.test(t)) return true;
  // Service-public style right IDs (F20744) or numeric-only
  if (/^[A-Z]?\d{3,8}$/i.test(t)) return true;
  // UUID / hex blob
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(t)) return true;
  if (/^[0-9a-f]{16,}$/i.test(t)) return true;
  return false;
}

/** Prefer a durable source title over a seasonal package topic. */
export function titleFromResearchContext(input: {
  proposalTitle?: string | null;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  topic?: string | null;
  jurisdiction?: string | null;
}): string | null {
  if (
    looksLikeLandlordGasKnowledge({
      title: input.proposalTitle,
      sourceTitle: input.sourceTitle,
      sourceUrl: input.sourceUrl,
    })
  ) {
    const durable = durableGasKnowledgeTitle(input.jurisdiction);
    if (!isOpaqueKnowledgeTitle(durable)) return durable;
  }
  const candidates = [
    input.proposalTitle,
    input.sourceTitle,
    input.topic && input.jurisdiction
      ? `${input.topic.trim()} — ${input.jurisdiction.trim()}`
      : null,
    input.topic,
  ];
  for (const c of candidates) {
    const t = (c ?? "").trim().slice(0, 200);
    if (t && !isOpaqueKnowledgeTitle(t)) return t;
  }
  return null;
}

/** Require enough substance to review — empty HTML shells must not become candidates. */
export function hasReviewableKnowledgeBody(input: {
  summary?: string | null;
  body?: string | null;
}): boolean {
  const summary = (input.summary ?? "").trim();
  const body = (input.body ?? "").trim();
  if (summary.length >= 40) return true;
  if (body.length >= 80) return true;
  if (summary.length >= 20 && body.length >= 40) return true;
  return false;
}
