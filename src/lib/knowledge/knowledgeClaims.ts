/**
 * Structured factual claims under a Knowledge item.
 * Summary/title stay concise; claims hold source-backed detail (or explicit unknowns).
 * AI must not invent facts — unknown means the source did not establish it.
 */

export const KNOWLEDGE_CLAIM_CATEGORIES = [
  "obligation",
  "applicability",
  "responsibility",
  "standard",
  "testing",
  "replacement",
  "evidence",
  "exception",
  "consequence",
  "unknown",
  "other",
] as const;

export type KnowledgeClaimCategory = (typeof KNOWLEDGE_CLAIM_CATEGORIES)[number];

export const KNOWLEDGE_CLAIM_STATUSES = [
  "extracted",
  "verified",
  "unresolved",
  "unknown",
  "rejected",
] as const;

export type KnowledgeClaimVerificationStatus = (typeof KNOWLEDGE_CLAIM_STATUSES)[number];

export type KnowledgeClaimInput = {
  claim_text: string;
  category?: string;
  applicability?: Record<string, unknown> | null;
  source_id?: string | null;
  source_location?: string | null;
  verification_status?: string;
  confidence?: number | null;
  critic_result?: Record<string, unknown> | null;
  established?: boolean;
};

export type KnowledgeClaimRow = {
  id?: string;
  knowledge_id?: string;
  claim_text: string;
  category: KnowledgeClaimCategory;
  applicability: Record<string, unknown>;
  source_id: string | null;
  source_location: string | null;
  verification_status: KnowledgeClaimVerificationStatus;
  confidence: number | null;
  critic_result: Record<string, unknown>;
  reviewed_at: string | null;
  reviewed_by: string | null;
  sort_order: number;
};

const CATEGORY_SET = new Set<string>(KNOWLEDGE_CLAIM_CATEGORIES);
const STATUS_SET = new Set<string>(KNOWLEDGE_CLAIM_STATUSES);

const ATTRIBUTE_CATEGORY: Record<string, KnowledgeClaimCategory> = {
  legal_status: "obligation",
  applies_when: "applicability",
  action: "obligation",
  frequency: "testing",
  timing: "testing",
  evidence: "evidence",
  responsible_party: "responsibility",
  professional_required: "responsibility",
  risk_or_consequence: "consequence",
  insurance_relevance: "consequence",
  local_variation: "exception",
};

export function isKnowledgeClaimCategory(value: string): value is KnowledgeClaimCategory {
  return CATEGORY_SET.has(value);
}

export function normalizeClaimCategory(raw: unknown): KnowledgeClaimCategory {
  if (typeof raw !== "string") return "other";
  const key = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (isKnowledgeClaimCategory(key)) return key;
  if (key === "requirement" || key === "duty") return "obligation";
  if (key === "maintenance") return "testing";
  if (key === "penalty" || key === "penalties") return "consequence";
  return "other";
}

export function normalizeClaimStatus(
  raw: unknown,
  established?: boolean
): KnowledgeClaimVerificationStatus {
  if (established === false) return "unknown";
  if (typeof raw !== "string") return "extracted";
  const key = raw.trim().toLowerCase();
  if (STATUS_SET.has(key)) return key as KnowledgeClaimVerificationStatus;
  return "extracted";
}

export function normalizeKnowledgeClaim(
  raw: KnowledgeClaimInput,
  sortOrder = 0
): KnowledgeClaimRow | null {
  const text =
    typeof raw.claim_text === "string"
      ? raw.claim_text.trim()
      : typeof (raw as { text?: unknown }).text === "string"
        ? String((raw as { text: string }).text).trim()
        : "";
  if (!text || text.length < 4) return null;

  const established = raw.established !== false;
  const status = normalizeClaimStatus(raw.verification_status, raw.established);

  return {
    claim_text: text.slice(0, 500),
    category: established ? normalizeClaimCategory(raw.category) : "unknown",
    applicability:
      raw.applicability && typeof raw.applicability === "object" && !Array.isArray(raw.applicability)
        ? raw.applicability
        : {},
    source_id: typeof raw.source_id === "string" ? raw.source_id : null,
    source_location:
      typeof raw.source_location === "string" ? raw.source_location.trim().slice(0, 240) || null : null,
    verification_status: status,
    confidence:
      typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
        ? Math.max(0, Math.min(1, raw.confidence))
        : null,
    critic_result:
      raw.critic_result && typeof raw.critic_result === "object" && !Array.isArray(raw.critic_result)
        ? raw.critic_result
        : {},
    reviewed_at: null,
    reviewed_by: null,
    sort_order: sortOrder,
  };
}

export function normalizeKnowledgeClaims(raw: unknown): KnowledgeClaimRow[] {
  if (!Array.isArray(raw)) return [];
  const out: KnowledgeClaimRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as KnowledgeClaimInput & { text?: string };
    const normalized = normalizeKnowledgeClaim(
      {
        ...rec,
        claim_text: rec.claim_text || rec.text || "",
      },
      out.length
    );
    if (normalized) out.push(normalized);
    if (out.length >= 80) break;
  }
  return out;
}

/** Preserve intake attributes as claims instead of discarding them after summary. */
export function claimsFromKnowledgeAttributes(
  attributes: Record<string, unknown> | null | undefined
): KnowledgeClaimRow[] {
  if (!attributes) return [];
  const out: KnowledgeClaimRow[] = [];
  for (const [key, category] of Object.entries(ATTRIBUTE_CATEGORY)) {
    const value = attributes[key];
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (text.length < 4) continue;
    out.push({
      claim_text: text.slice(0, 500),
      category,
      applicability: {},
      source_id: null,
      source_location: null,
      verification_status: "extracted",
      confidence: null,
      critic_result: {},
      reviewed_at: null,
      reviewed_by: null,
      sort_order: out.length,
    });
  }
  return out;
}

export function mergeClaimsWithAttributeFallback(
  claims: unknown,
  attributes: Record<string, unknown> | null | undefined
): KnowledgeClaimRow[] {
  const explicit = normalizeKnowledgeClaims(claims);
  if (explicit.length > 0) return explicit;
  return claimsFromKnowledgeAttributes(attributes);
}

export function claimsForContentGrounding(claims: KnowledgeClaimRow[]): {
  verified: Array<{ text: string; category: string; source_location: string | null }>;
  unknown: Array<{ text: string; category: string }>;
} {
  return {
    verified: claims
      .filter((c) => c.verification_status === "verified")
      .map((c) => ({
        text: c.claim_text,
        category: c.category,
        source_location: c.source_location,
      })),
    unknown: claims
      .filter((c) => c.verification_status === "unknown" || c.verification_status === "unresolved")
      .map((c) => ({ text: c.claim_text, category: c.category })),
  };
}

export function summarizeKnowledgeClaims(claims: Array<{ verification_status?: string }>): {
  total: number;
  verified: number;
  extracted: number;
  unknown: number;
  unresolved: number;
  rejected: number;
} {
  const summary = {
    total: claims.length,
    verified: 0,
    extracted: 0,
    unknown: 0,
    unresolved: 0,
    rejected: 0,
  };
  for (const c of claims) {
    const status = String(c.verification_status ?? "");
    if (status === "verified") summary.verified += 1;
    else if (status === "extracted") summary.extracted += 1;
    else if (status === "unknown") summary.unknown += 1;
    else if (status === "unresolved") summary.unresolved += 1;
    else if (status === "rejected") summary.rejected += 1;
  }
  return summary;
}

export function claimStatusLabel(status: string): string {
  switch (status) {
    case "verified":
      return "Verified";
    case "extracted":
      return "Extracted";
    case "unknown":
      return "Unknown";
    case "unresolved":
      return "Unresolved";
    case "rejected":
      return "Rejected";
    default:
      return status || "Claim";
  }
}

export function serializeClaimsForRpc(claims: KnowledgeClaimRow[]): Record<string, unknown>[] {
  return claims.map((c) => ({
    claim_text: c.claim_text,
    category: c.category,
    applicability: c.applicability,
    source_id: c.source_id,
    source_location: c.source_location,
    verification_status: c.verification_status,
    confidence: c.confidence,
    critic_result: c.critic_result,
  }));
}
