/**
 * Infer Knowledge structured fields from verified/extracted claims.
 *
 * Rule: a candidate must not be blocked by a field that claims already
 * establish. Mixed must/should is a classification, not a missing field.
 * Only remain unresolved when claims support no interpretation.
 */

export type LegalStrength = "must" | "should" | "exception" | "explanatory";

export type ClaimLike = {
  claim_text?: string | null;
  category?: string | null;
  verification_status?: string | null;
  applicability?: Record<string, unknown> | null;
  critic_result?: Record<string, unknown> | null;
};

export type RequirementGroup = {
  id: string;
  title: string;
  strength: LegalStrength;
  summary: string;
  claimIndexes: number[];
  /** Re-letting, access, communal flues — not part of the lead summary. */
  conditional: boolean;
};

export type InferredKnowledgeFields = {
  legal_status: string | null;
  classificationLabel: string | null;
  trigger_type: string | null;
  triggerLabel: string | null;
  applies_when: string | null;
  timing: string | null;
  action: string | null;
  evidence: string | null;
  responsible_party: string | null;
  groups: RequirementGroup[];
  composedAnswer: string | null;
  composedTitle: string | null;
  foundCount: number;
  foundLine: (sourceCount: number) => string;
  classificationMissing: boolean;
  triggerMissing: boolean;
};

const ATTRIBUTE_KEYS = [
  "legal_status",
  "classification",
  "trigger_type",
  "event_trigger",
  "applies_when",
  "timing",
  "frequency",
  "action",
  "evidence",
  "responsible_party",
] as const;

const BUCKETS: Array<{
  id: string;
  title: string;
  pattern: RegExp;
  conditional: boolean;
}> = [
  {
    id: "gas_safe",
    title: "Use a Gas Safe registered engineer for covered work",
    pattern: /\bgas safe|registered (gas )?engineer|gas fitter\b/i,
    conditional: false,
  },
  {
    id: "service",
    title: "Service appliances and flues according to manufacturer instructions, or annually where unavailable",
    pattern:
      /\b(manufacturer('s)? instructions|annual(ly)? servic|service(d|ing)? .{0,40}(appliance|flue)|where .{0,30}unavailable)\b/i,
    conditional: false,
  },
  {
    id: "relet",
    title: "Complete re-letting safety checks and provide the relevant record",
    pattern:
      /\b(re-?lett|new tenant|new tenancy|before (a )?tenant|gas safety (record|certificate)|lgsc|provide .{0,20}record)\b/i,
    conditional: true,
  },
  {
    id: "access",
    title: "Manage tenant access and retain evidence of reasonable attempts",
    pattern: /\b(tenant access|access to the|reasonable attempt|refus(e|al)|cannot gain access)\b/i,
    conditional: true,
  },
  {
    id: "communal",
    title: "Maintain communal or passing flues where applicable",
    pattern: /\b(communal|passing flue|shared flue|flue serving more)\b/i,
    conditional: true,
  },
  {
    id: "maintain",
    title: "Maintain landlord-supplied gas appliances, flues and installation pipework safely",
    pattern:
      /\b(safe condition|installation pipework|keep .{0,40}(appliance|flue|pipework)|maintain .{0,40}(appliance|flue|pipework))\b/i,
    conditional: false,
  },
];

const SEASONAL_TIMING =
  /heating season|before winter|autumn service|seasonal prep|before the heating/i;

const MUST =
  /\b(must|shall|required to|it is the law|legal(ly)? required|statutory|obligation to|have to)\b/i;
const SHOULD =
  /\b(should|recommend(ed|s)?|good practice|expected (practice|to)|hse recommends|advisable)\b/i;
const EXCEPTION = /\b(except|unless|exclud(e|ing)|does not apply|not required where)\b/i;

function textOf(claim: ClaimLike): string {
  return String(claim.claim_text ?? "").trim();
}

function usableClaims(claims: ClaimLike[]): Array<ClaimLike & { index: number }> {
  return claims
    .map((c, index) => ({ ...c, index }))
    .filter((c) => {
      const status = String(c.verification_status ?? "extracted");
      if (status === "rejected" || status === "unknown") return false;
      return textOf(c).length >= 8;
    });
}

export function inferLegalStrength(claim: ClaimLike): LegalStrength {
  const stored =
    (claim.applicability && typeof claim.applicability.legal_strength === "string"
      ? claim.applicability.legal_strength
      : null) ||
    (claim.critic_result && typeof claim.critic_result.legal_strength === "string"
      ? claim.critic_result.legal_strength
      : null);
  if (stored === "must" || stored === "should" || stored === "exception" || stored === "explanatory") {
    return stored;
  }
  const category = String(claim.category ?? "");
  const text = textOf(claim);
  if (category === "exception" || EXCEPTION.test(text)) return "exception";
  if (SHOULD.test(text) && !MUST.test(text)) return "should";
  if (MUST.test(text) || category === "obligation") return "must";
  if (category === "evidence" || category === "testing" || category === "standard") {
    return SHOULD.test(text) ? "should" : "explanatory";
  }
  if (category === "applicability" || category === "responsibility" || category === "consequence") {
    return "explanatory";
  }
  return "explanatory";
}

export function clusterRequirementGroups(claims: ClaimLike[]): RequirementGroup[] {
  const usable = usableClaims(claims);
  const assigned = new Set<number>();
  const groups: RequirementGroup[] = [];

  for (const bucket of BUCKETS) {
    const indexes: number[] = [];
    for (const claim of usable) {
      if (assigned.has(claim.index)) continue;
      if (bucket.pattern.test(textOf(claim))) {
        indexes.push(claim.index);
        assigned.add(claim.index);
      }
    }
    if (indexes.length === 0) continue;
    const members = indexes.map((i) => claims[i]);
    const strengths = members.map(inferLegalStrength);
    const strength: LegalStrength = strengths.includes("must")
      ? "must"
      : strengths.includes("should")
        ? "should"
        : strengths.includes("exception")
          ? "exception"
          : "explanatory";
    const lead =
      members.find((c) => inferLegalStrength(c) === strength) ?? members[0];
    groups.push({
      id: bucket.id,
      title: bucket.title,
      strength,
      summary: textOf(lead),
      claimIndexes: indexes,
      conditional: bucket.conditional,
    });
  }

  for (const claim of usable) {
    if (assigned.has(claim.index)) continue;
    if (inferLegalStrength(claim) === "explanatory") continue;
    if (String(claim.category ?? "") === "applicability") continue;
    assigned.add(claim.index);
    const strength = inferLegalStrength(claim);
    const text = textOf(claim);
    groups.push({
      id: `claim-${claim.index}`,
      title: text.replace(/[.]+$/, "").slice(0, 110),
      strength,
      summary: text,
      claimIndexes: [claim.index],
      conditional: /re-?lett|new tenant|access|communal|passing flue/i.test(text),
    });
  }

  return groups;
}

function pickClaim(
  claims: ClaimLike[],
  pred: (c: ClaimLike) => boolean
): string | null {
  const hit = usableClaims(claims).find((c) => pred(c));
  return hit ? textOf(hit) : null;
}

function joinUnique(parts: string[]): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  if (out.length === 0) return null;
  if (out.length === 1) return out[0];
  return `${out.slice(0, -1).join("; ")}; ${out[out.length - 1]}`;
}

export function looksLikeLandlordGasKnowledge(input: {
  title?: string | null;
  summary?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  claims?: ClaimLike[];
}): boolean {
  const blob = [
    input.title,
    input.summary,
    input.sourceTitle,
    input.sourceUrl,
    ...(input.claims ?? []).map((c) => c.claim_text),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!blob) return false;
  const gas = /\bgas (safe|appliance|appliances|fitting|safety)\b|\bflue(s)?\b.{0,40}\bgas\b|\blandlord.{0,40}gas\b/;
  const hseGas = /hse\.gov\.uk\/gas|landlords-landlords-duties/;
  return gas.test(blob) || hseGas.test(blob);
}

export function looksLikeSeasonalPackageTitle(title: string | null | undefined): boolean {
  return /before the heating season|heating-season|seasonal prep/i.test(title ?? "");
}

export function durableGasKnowledgeTitle(jurisdiction?: string | null): string {
  const place = (jurisdiction ?? "").trim();
  return place
    ? `Landlord gas-appliance and flue maintenance — ${place}`
    : "Landlord gas-appliance and flue maintenance";
}

export function inferKnowledgeFieldsFromClaims(input: {
  claims: ClaimLike[];
  attributes?: Record<string, unknown> | null;
  title?: string | null;
  summary?: string | null;
  jurisdiction?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
}): InferredKnowledgeFields {
  const claims = input.claims ?? [];
  const groups = clusterRequirementGroups(claims);
  const strengths = groups.map((g) => g.strength);
  const hasMust = strengths.includes("must") || claims.some((c) => inferLegalStrength(c) === "must");
  const hasShould =
    strengths.includes("should") || claims.some((c) => inferLegalStrength(c) === "should");

  let legal_status: string | null = null;
  let classificationLabel: string | null = null;
  if (hasMust && hasShould) {
    legal_status = "mandatory_with_recommendations";
    classificationLabel = "Mandatory requirement, with some recommended practices";
  } else if (hasMust) {
    legal_status = "mandatory";
    classificationLabel = "Mandatory requirement";
  } else if (hasShould) {
    legal_status = "recommended";
    classificationLabel = "Official recommendation / expected practice";
  }

  const existingLegal = String(
    (input.attributes as Record<string, unknown> | undefined)?.legal_status ??
      (input.attributes as Record<string, unknown> | undefined)?.classification ??
      ""
  ).trim();
  if (!legal_status && existingLegal && !/not set|unknown|n\/?a/i.test(existingLegal)) {
    legal_status = existingLegal;
    classificationLabel = existingLegal;
  }

  const landlord =
    pickClaim(claims, (c) => /landlord/i.test(textOf(c)) || c.category === "responsibility") ||
    (hasMust ? "A landlord responsible for gas appliances, flues or installation pipework" : null);
  const applies_when =
    pickClaim(claims, (c) => c.category === "applicability") ||
    (looksLikeLandlordGasKnowledge(input)
      ? "A landlord is responsible for gas appliances, flues or installation pipework in rented premises"
      : landlord);

  const timingParts: string[] = [];
  if (claims.some((c) => /ongoing|safe condition|at all times|keep .{0,20}safe/i.test(textOf(c)))) {
    timingParts.push("Ongoing maintenance");
  }
  if (claims.some((c) => /manufacturer/i.test(textOf(c)))) {
    timingParts.push("service according to manufacturer instructions, or annually where unavailable");
  } else if (claims.some((c) => /annual/i.test(textOf(c)))) {
    timingParts.push("annual servicing where manufacturer instructions are unavailable");
  }
  if (claims.some((c) => /re-?lett|new tenant|new tenancy/i.test(textOf(c)))) {
    timingParts.push("additional checks may apply before re-letting");
  }
  const timing = joinUnique(timingParts);

  const triggerFlags = {
    continuous: /ongoing|continuous|safe condition|at all times|keep .{0,20}safe|maintain/i.test(
      claims.map(textOf).join(" ")
    ),
    scheduled: /annual|manufacturer|every year|interval/i.test(claims.map(textOf).join(" ")),
    event: /re-?lett|new tenant|before (a )?tenant|when a tenancy/i.test(claims.map(textOf).join(" ")),
  };
  let trigger_type: string | null = null;
  if (triggerFlags.continuous && (triggerFlags.scheduled || triggerFlags.event)) {
    trigger_type = "continuous";
  } else if (triggerFlags.continuous) trigger_type = "continuous";
  else if (triggerFlags.scheduled) trigger_type = "scheduled";
  else if (triggerFlags.event) trigger_type = "event_driven";

  const triggerLabel = timing
    ? timing.charAt(0).toUpperCase() + timing.slice(1)
    : trigger_type === "continuous"
      ? "Continuous"
      : trigger_type === "scheduled"
        ? "Scheduled"
        : trigger_type === "event_driven"
          ? "Event-driven"
          : null;

  const action =
    groups.find((g) => g.strength === "must")?.summary ||
    pickClaim(claims, (c) => c.category === "obligation") ||
    null;
  const evidence =
    pickClaim(claims, (c) => c.category === "evidence" || /record|certificate|correspondence|retain/i.test(textOf(c))) ||
    (looksLikeLandlordGasKnowledge(input)
      ? "Keep service records and tenant correspondence sufficient to demonstrate maintenance and reasonable access attempts"
      : null);
  const responsible_party =
    pickClaim(claims, (c) => c.category === "responsibility") ||
    (looksLikeLandlordGasKnowledge(input) ? "Landlord" : null);

  const composedAnswer = composeLeadAnswer(groups, input);

  const composedTitle = looksLikeLandlordGasKnowledge(input)
    ? durableGasKnowledgeTitle(input.jurisdiction)
    : null;

  const foundCount = groups.length;

  return {
    legal_status,
    classificationLabel,
    trigger_type,
    triggerLabel,
    applies_when,
    timing,
    action,
    evidence,
    responsible_party,
    groups,
    composedAnswer,
    composedTitle,
    foundCount,
    foundLine: (sourceCount: number) => {
      const n = foundCount;
      const item =
        n === 1 ? "related requirement" : "related requirements and recommendations";
      const src =
        sourceCount <= 0
          ? "the linked source"
          : sourceCount === 1
            ? "one authoritative source"
            : `${sourceCount} authoritative sources`;
      if (n === 0) {
        return `Filla found facts from ${src}.`;
      }
      if (n === 1) {
        return `Filla found one ${item} from ${src}.`;
      }
      const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
      const countWord = n <= 10 ? words[n] : String(n);
      return `Filla found ${countWord} ${item} from ${src}.`;
    },
    classificationMissing: !legal_status,
    triggerMissing: !trigger_type && !timing && !applies_when,
  };
}

function sentence(text: string): string {
  const t = text.trim().replace(/[.]+$/, "");
  return t ? `${t}.` : "";
}

function composeLeadAnswer(
  groups: RequirementGroup[],
  input: {
    claims: ClaimLike[];
    title?: string | null;
    summary?: string | null;
    sourceUrl?: string | null;
    sourceTitle?: string | null;
  }
): string | null {
  const byId = new Map(groups.map((g) => [g.id, g]));
  if (looksLikeLandlordGasKnowledge(input) && byId.has("maintain")) {
    const parts = [
      byId.get("maintain")?.summary,
      byId.get("service")?.summary,
      byId.get("gas_safe")?.summary,
    ]
      .filter(Boolean)
      .map((t) => sentence(String(t)));
    if (parts.length >= 2) return parts.join(" ");
  }
  const core = groups.filter((g) => !g.conditional && g.strength !== "explanatory");
  const lead = (core.length > 0 ? core : groups.filter((g) => !g.conditional)).slice(0, 3);
  const parts = lead.map((g) => sentence(g.summary)).filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function looksLikeSeasonalTiming(value: string | null | undefined): boolean {
  return SEASONAL_TIMING.test(value ?? "");
}

function summaryNeedsRepair(summary: string | null | undefined, inferred: InferredKnowledgeFields): boolean {
  const s = (summary ?? "").trim();
  if (!inferred.composedAnswer) return false;
  if (!s || s.length < 40) return true;
  if (s.length > 420) return true;
  const topics = [/\bre-?lett/, /\baccess\b/, /\bcommunal\b/, /\bmanufacturer/].filter((p) =>
    p.test(s)
  ).length;
  return topics >= 3;
}

export function attributesPatchFromInference(
  existing: Record<string, unknown> | null | undefined,
  inferred: InferredKnowledgeFields,
  opts?: { overwriteSeasonalTiming?: boolean }
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(existing ?? {}) };
  const fill = (key: string, value: string | null, overwrite = false) => {
    if (!value) return;
    const current = typeof next[key] === "string" ? String(next[key]).trim() : "";
    if (current && !overwrite && !/not set|unknown|^n\/?a$/i.test(current)) return;
    next[key] = value;
  };
  fill("legal_status", inferred.legal_status);
  fill("classification", inferred.classificationLabel);
  fill("trigger_type", inferred.trigger_type);
  const seasonal =
    Boolean(opts?.overwriteSeasonalTiming) ||
    looksLikeSeasonalTiming(String(next.applies_when ?? "")) ||
    looksLikeSeasonalTiming(String(next.timing ?? "")) ||
    looksLikeSeasonalTiming(String(next.frequency ?? ""));
  fill("applies_when", inferred.applies_when, seasonal);
  fill("timing", inferred.timing, seasonal);
  fill("frequency", inferred.timing, seasonal);
  fill("action", inferred.action);
  fill("evidence", inferred.evidence);
  fill("responsible_party", inferred.responsible_party);
  return next;
}

export function jurisdictionFromApplicability(applicability: unknown): string | null {
  if (!applicability || typeof applicability !== "object") return null;
  const raw = (applicability as { jurisdictions?: unknown }).jurisdictions;
  if (Array.isArray(raw) && raw[0]) return String(raw[0]).trim() || null;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

export function buildKnowledgeRepairPatch(input: {
  title?: string | null;
  summary?: string | null;
  attributes?: Record<string, unknown> | null;
  applicability?: unknown;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  claims: ClaimLike[];
}): {
  title: string | null;
  summary: string | null;
  attributes: Record<string, unknown>;
  changed: boolean;
} {
  const inferred = inferKnowledgeFieldsFromClaims({
    claims: input.claims,
    attributes: input.attributes,
    title: input.title,
    summary: input.summary,
    jurisdiction: jurisdictionFromApplicability(input.applicability),
    sourceUrl: input.sourceUrl,
    sourceTitle: input.sourceTitle,
  });
  const seasonalTitle = looksLikeSeasonalPackageTitle(input.title);
  const landlordGas = looksLikeLandlordGasKnowledge(input);
  const overwriteSeasonal = seasonalTitle && landlordGas;
  const attributes = attributesPatchFromInference(input.attributes, inferred, {
    overwriteSeasonalTiming: overwriteSeasonal,
  });
  const title =
    overwriteSeasonal && inferred.composedTitle ? inferred.composedTitle : (input.title ?? null);
  const summary = summaryNeedsRepair(input.summary, inferred)
    ? inferred.composedAnswer
    : input.summary ?? inferred.composedAnswer;
  const changed =
    title !== (input.title ?? null) ||
    summary !== (input.summary ?? null) ||
    inferenceChangedAttributes(input.attributes, attributes);
  return { title, summary: summary ?? null, attributes, changed };
}

export function inferenceChangedAttributes(
  existing: Record<string, unknown> | null | undefined,
  patched: Record<string, unknown>
): boolean {
  for (const key of ATTRIBUTE_KEYS) {
    const a = String((existing ?? {})[key] ?? "");
    const b = String(patched[key] ?? "");
    if (a !== b) return true;
  }
  return false;
}
