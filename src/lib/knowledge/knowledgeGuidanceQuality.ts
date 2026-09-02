/**
 * Deterministic guidance quality for Knowledge review.
 * States: Missing → Needs improvement → Meaningful draft → Verified (lifecycle).
 * Target length is ~25–60 words; drafts under MIN_MEANINGFUL_WORDS need Improve.
 */

/** Below this, guidance is too short for homeowner prose and needs Improve. */
export const MIN_MEANINGFUL_WORDS = 25;

import type { KnowledgeApplicability, KnowledgeRow } from "@/types/knowledge";

export type GuidanceQualityState =
  | "missing"
  | "needs_improvement"
  | "meaningful_draft"
  | "verified";

export type GuidanceQualityResult = {
  state: GuidanceQualityState;
  label: string;
  reasons: string[];
  wordCount: number;
  text: string | null;
};

const PLACEHOLDER_PHRASES =
  /\b(as required|as necessary|as applicable|as appropriate|if required|where required|etc\.?|tbd|todo|lorem ipsum)\b/i;

const GENERIC_AI =
  /\b(this knowledge (provides|offers|covers)|overall,?\s+this is (reliable|accurate|well[- ]structured)|enhancing its credibility|the draft knowledge provides)\b/i;

const UNSUPPORTED_CLAIM =
  /\b(you must (pay|fine|penalty)|penalty of|fine of|£\d|€\d|\$\d|imprisonment|criminal offence|always legally required)\b/i;

const ACTION_CUES =
  /\b(check|notify|review|obtain|ensure|maintain|inspect|install|replace|document|record|allow|follow|confirm|report|keep|contact|ask|update|inform|apply|submit|arrange|schedule|protect|avoid|do not|don't|must|should|need to|required to)\b/i;

const CONDITION_CUES =
  /\b(when|before|after|if|whenever|during|while|where|for|in case|once|unless|until|including|such as)\b/i;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,;|]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function attrString(
  attributes: Record<string, unknown> | undefined | null,
  key: string
): string | null {
  return asString(asRecord(attributes)[key]);
}

function parseApplicability(raw: KnowledgeRow["applicability"]): KnowledgeApplicability {
  const record = asRecord(raw);
  return {
    jurisdictions: asStringList(record.jurisdictions),
    regions: asStringList(record.regions),
    languages: asStringList(record.languages),
    audiences: asStringList(record.audiences) as KnowledgeApplicability["audiences"],
    unscoped: record.unscoped === true,
  };
}

function looksLikeRowNumberOrCellRef(value: string): boolean {
  const t = value.trim();
  if (/^\d{1,6}$/.test(t)) return true;
  if (/^[A-Za-z]{1,3}\d{1,6}$/.test(t)) return true;
  if (/^row\s*\d+$/i.test(t)) return true;
  return false;
}

function normalizeProse(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function looksLikeIdOrFragment(text: string): boolean {
  const t = text.trim();
  if (looksLikeRowNumberOrCellRef(t)) return true;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^[A-Z]{1,4}-[A-Z0-9-]{3,}$/i.test(t) && t.length < 48 && !/\s/.test(t)) {
    return true;
  }
  if (!/\s/.test(t) && t.length < 40) return true;
  if (!/[A-Za-zÀ-ÿ]{3,}/.test(t)) return true;
  return false;
}

function repeatsTitle(text: string, title: string | null | undefined): boolean {
  const nText = normalizeProse(text);
  const nTitle = normalizeProse(title || "");
  if (!nText || !nTitle) return false;
  if (nText === nTitle) return true;
  if (nTitle.length >= 12 && (nText.startsWith(nTitle) || nTitle.startsWith(nText))) {
    const shorter = Math.min(nText.length, nTitle.length);
    const longer = Math.max(nText.length, nTitle.length);
    if (shorter / longer >= 0.85) return true;
  }
  return false;
}

function hasCompleteSentenceShape(text: string): boolean {
  const t = text.trim();
  if (/[.!?…]/.test(t) && /[A-Za-zÀ-ÿ]/.test(t)) return true;
  const words = wordCount(t);
  return words >= 8 && ACTION_CUES.test(t) && CONDITION_CUES.test(t);
}

function omitsStructuredQualification(
  text: string,
  row: Pick<KnowledgeRow, "attributes" | "applicability" | "title">
): string | null {
  const attrs = asRecord(row.attributes);
  const when =
    attrString(attrs, "applies_when") || attrString(attrs, "timing") || "";
  if (when && when.trim().length >= 12) {
    const nText = normalizeProse(text);
    const whenNorm = normalizeProse(when);
    const keyTokens = whenNorm.split(" ").filter((w) => w.length > 4).slice(0, 4);
    const hit = keyTokens.filter((tok) => nText.includes(tok)).length;
    if (wordCount(text) < 20 && keyTokens.length >= 2 && hit === 0) {
      return "Omits the structured trigger/condition already on the record.";
    }
  }
  return null;
}

/**
 * Assess guidance prose quality. Does not grant verification.
 */
export function assessGuidanceQuality(
  row: Pick<
    KnowledgeRow,
    | "summary"
    | "body"
    | "title"
    | "attributes"
    | "applicability"
    | "status"
    | "reviewed_by"
    | "provenance"
  >
): GuidanceQualityResult {
  const text = (row.summary?.trim() || row.body?.trim() || "") || null;
  const words = text ? wordCount(text) : 0;

  if (!text) {
    return {
      state: "missing",
      label: "Missing",
      reasons: ["No guidance written yet."],
      wordCount: 0,
      text: null,
    };
  }

  const reasons: string[] = [];

  if (looksLikeIdOrFragment(text)) {
    reasons.push("Guidance is only an ID, number, URL, or fragment.");
  }
  if (repeatsTitle(text, row.title)) {
    reasons.push("Guidance merely repeats the title.");
  }
  if (GENERIC_AI.test(text)) {
    reasons.push("Guidance uses generic AI commentary.");
  }
  if (UNSUPPORTED_CLAIM.test(text)) {
    reasons.push("Guidance makes an unsupported legal, penalty, or insurance claim.");
  }
  if (PLACEHOLDER_PHRASES.test(text) && words < 35) {
    reasons.push(
      "Contains placeholders such as “as required” without explaining the relevant condition."
    );
  }
  if (!ACTION_CUES.test(text) && !/\bis\b|\bare\b|\bmeans\b/i.test(text)) {
    reasons.push("Lacks a clear action or factual guidance.");
  }
  if (!hasCompleteSentenceShape(text)) {
    reasons.push("Guidance is grammatically incomplete or not standalone prose.");
  }
  if (words > 90) {
    reasons.push("Guidance exceeds ~90 words; keep it concise.");
  }

  const omit = omitsStructuredQualification(text, row);
  if (omit) reasons.push(omit);

  if (words < 18 && PLACEHOLDER_PHRASES.test(text)) {
    if (!reasons.some((r) => /placeholder/i.test(r))) {
      reasons.push("Too short and circular to qualify as meaningful homeowner guidance.");
    }
  }

  if (words > 0 && words < MIN_MEANINGFUL_WORDS) {
    if (!reasons.some((r) => /too short/i.test(r))) {
      reasons.push(
        `Too short (${words} words); aim for about ${MIN_MEANINGFUL_WORDS}–60 words of homeowner guidance.`
      );
    }
  }

  if (reasons.length > 0) {
    return {
      state: "needs_improvement",
      label: "Needs improvement",
      reasons,
      wordCount: words,
      text,
    };
  }

  const verified =
    (row.status === "verified" || row.status === "published") &&
    Boolean(row.reviewed_by);

  if (verified) {
    return {
      state: "verified",
      label: "Verified",
      reasons: [],
      wordCount: words,
      text,
    };
  }

  return {
    state: "meaningful_draft",
    label: "Meaningful draft",
    reasons: [],
    wordCount: words,
    text,
  };
}

/** True when prose is good enough for critic (not Missing / Needs improvement). */
export function isMeaningfulGuidanceProse(
  row: Pick<
    KnowledgeRow,
    | "summary"
    | "body"
    | "title"
    | "attributes"
    | "applicability"
    | "status"
    | "reviewed_by"
    | "provenance"
  >
): boolean {
  const state = assessGuidanceQuality(row).state;
  return state === "meaningful_draft" || state === "verified";
}

/** Non-empty but fails quality — eligible for Improve guidance. */
export function needsGuidanceImprovement(
  row: Pick<
    KnowledgeRow,
    | "summary"
    | "body"
    | "title"
    | "attributes"
    | "applicability"
    | "status"
    | "reviewed_by"
    | "provenance"
  >
): boolean {
  return assessGuidanceQuality(row).state === "needs_improvement";
}

/** Empty canonical guidance. */
export function isGuidanceMissing(
  row: Pick<KnowledgeRow, "summary" | "body">
): boolean {
  return !(row.summary?.trim() || row.body?.trim());
}

/**
 * Stable fingerprint of critic-relevant fields (client-side).
 * Must stay aligned with SQL knowledge_critic_content_fingerprint.
 */
export function criticContentFingerprint(
  row: Pick<
    KnowledgeRow,
    "summary" | "body" | "attributes" | "applicability" | "title"
  >,
  sourceUrls: string[] = []
): string {
  const attrs = asRecord(row.attributes);
  const parts = [
    row.summary?.trim() || "",
    row.body?.trim() || "",
    attrString(attrs, "legal_status") || attrString(attrs, "classification") || "",
    attrString(attrs, "trigger_type") || attrString(attrs, "event_trigger") || "",
    attrString(attrs, "applies_when") || "",
    attrString(attrs, "action") || "",
    attrString(attrs, "evidence") || "",
    attrString(attrs, "frequency") || "",
    attrString(attrs, "risk_or_consequence") || "",
    JSON.stringify(row.applicability ?? {}),
    [...sourceUrls].map((u) => u.trim()).filter(Boolean).sort().join("|"),
  ];
  return parts.join("\n");
}

export function formatCriticField(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  if (!t) return null;
  if (/^(none\.?|n\/?a\.?|null|undefined|-|—|–)$/i.test(t)) return null;
  return t;
}
