/**
 * Knowledge Watch — discovery signals, source filters, and research allowances.
 *
 * Discovery signals propose subjects for investigation. They are NOT operational
 * `signals` (Issues triage) and never grant publish permission.
 *
 * @Docs/29_Knowledge.md · @Docs/32_Phase3_Knowledge_Depth_And_Hardening.md
 */

export type DiscoverySourceType =
  | "regulatory_update"
  | "official_guidance"
  | "potential_change"
  | "seasonal"
  | "knowledge_gap"
  | "user_demand"
  | "property_work_pattern";

export type DiscoverySourceFilter = DiscoverySourceType | "all";

/** Confidence of the assessment — never present "inferred" as a confirmed regulatory update. */
export type DiscoveryConfidence = "high" | "medium" | "low" | "inferred";

export type DiscoverySignal = {
  type: DiscoverySourceType;
  /** Short chip label, e.g. "Heating season approaching" */
  label: string;
  /** What changed or was observed (human-readable). */
  observation: string;
  confidence: DiscoveryConfidence;
  /** ISO detection / observation time when known. */
  detectedAt: string | null;
  /** Source URLs when known (never invent). */
  sourceUrls: string[];
  /** Strength for picking top reasons (higher = stronger). */
  strength: number;
};

export const DISCOVERY_SOURCE_FILTERS: {
  id: DiscoverySourceFilter;
  label: string;
}[] = [
  { id: "all", label: "All sources" },
  { id: "regulatory_update", label: "Regulatory updates" },
  { id: "official_guidance", label: "Changes to official guidance" },
  { id: "potential_change", label: "Potential change" },
  { id: "seasonal", label: "Seasonal relevance" },
  { id: "knowledge_gap", label: "Knowledge gaps" },
  { id: "user_demand", label: "User questions and search demand" },
  { id: "property_work_pattern", label: "Patterns in property work" },
];

export const DISCOVERY_SOURCE_LABELS: Record<DiscoverySourceType, string> = {
  regulatory_update: "Regulatory update",
  official_guidance: "Official guidance changed",
  potential_change: "Potential change",
  seasonal: "Seasonal relevance",
  knowledge_gap: "Knowledge gap",
  user_demand: "User demand",
  property_work_pattern: "Property work pattern",
};

export type ResearchAllowance = "light" | "standard" | "thorough";
export type AutomatedResearchMode = "paused" | "on";

/** Explicit monthly caps — enforced server-side; UI disable is not enough. */
export type ResearchAllowanceLimits = {
  searches: number;
  pages: number;
  tokens: number;
  cost_units: number;
};

export const RESEARCH_ALLOWANCE_LIMITS: Record<ResearchAllowance, ResearchAllowanceLimits> = {
  // Conservative defaults — prefer known sources over deep crawl.
  light: { searches: 20, pages: 40, tokens: 200_000, cost_units: 50 },
  standard: { searches: 80, pages: 160, tokens: 800_000, cost_units: 200 },
  thorough: { searches: 250, pages: 500, tokens: 2_500_000, cost_units: 600 },
};

export const DEFAULT_WATCH_SETTINGS = {
  automated_research: "paused" as AutomatedResearchMode,
  research_allowance: "light" as ResearchAllowance,
};

export type WatchUsage = {
  period_ym: string;
  searches_used: number;
  pages_used: number;
  tokens_used: number;
  cost_units_used: number;
};

export type AllowanceCheckResult =
  | { ok: true; remaining: ResearchAllowanceLimits }
  | {
      ok: false;
      reason: "paused" | "searches" | "pages" | "tokens" | "cost_units";
      remaining: ResearchAllowanceLimits;
      message: string;
    };

export function currentPeriodYm(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function remainingAllowance(
  limits: ResearchAllowanceLimits,
  usage: WatchUsage
): ResearchAllowanceLimits {
  return {
    searches: Math.max(0, limits.searches - usage.searches_used),
    pages: Math.max(0, limits.pages - usage.pages_used),
    tokens: Math.max(0, limits.tokens - usage.tokens_used),
    cost_units: Math.max(0, limits.cost_units - usage.cost_units_used),
  };
}

/**
 * Fail closed: paused or any exhausted dimension blocks further spend.
 * Call before each research unit; never silently exceed.
 */
export function checkResearchAllowance(input: {
  automatedResearch: AutomatedResearchMode;
  allowance: ResearchAllowance;
  usage: WatchUsage;
  /** Planned spend for this step (defaults to at least one search). */
  need?: Partial<ResearchAllowanceLimits>;
  /** Manual "Run Watch now" may run even when automated is paused, but still respects allowance. */
  trigger?: "scheduled" | "manual";
}): AllowanceCheckResult {
  const limits = RESEARCH_ALLOWANCE_LIMITS[input.allowance];
  const remaining = remainingAllowance(limits, input.usage);
  const need = {
    searches: input.need?.searches ?? 1,
    pages: input.need?.pages ?? 0,
    tokens: input.need?.tokens ?? 0,
    cost_units: input.need?.cost_units ?? 0,
  };

  if (input.automatedResearch === "paused" && input.trigger !== "manual") {
    return {
      ok: false,
      reason: "paused",
      remaining,
      message: "Automated research is paused. Turn it On or use Run Watch now.",
    };
  }

  if (remaining.searches < need.searches) {
    return {
      ok: false,
      reason: "searches",
      remaining,
      message: `Search allowance exhausted for ${input.usage.period_ym} (${limits.searches} searches).`,
    };
  }
  if (remaining.pages < need.pages) {
    return {
      ok: false,
      reason: "pages",
      remaining,
      message: `Page-fetch allowance exhausted for ${input.usage.period_ym} (${limits.pages} pages).`,
    };
  }
  if (remaining.tokens < need.tokens) {
    return {
      ok: false,
      reason: "tokens",
      remaining,
      message: `Token allowance exhausted for ${input.usage.period_ym}.`,
    };
  }
  if (remaining.cost_units < need.cost_units) {
    return {
      ok: false,
      reason: "cost_units",
      remaining,
      message: `Research cost-unit allowance exhausted for ${input.usage.period_ym}.`,
    };
  }

  return { ok: true, remaining };
}

export function formatAllowanceEstimate(allowance: ResearchAllowance): string {
  const l = RESEARCH_ALLOWANCE_LIMITS[allowance];
  return `~${l.searches} searches · ${l.pages} pages · ${Math.round(l.tokens / 1000)}k tokens / month`;
}

export function formatUsageLine(usage: WatchUsage, allowance: ResearchAllowance): string {
  const l = RESEARCH_ALLOWANCE_LIMITS[allowance];
  const searches = Number(usage?.searches_used ?? 0);
  const pages = Number(usage?.pages_used ?? 0);
  const tokens = Number(usage?.tokens_used ?? 0);
  return `${searches}/${l.searches} searches · ${pages}/${l.pages} pages · ${tokens.toLocaleString()}/${l.tokens.toLocaleString()} tokens`;
}

/** Strongest one or two reason labels for a queue row. */
export function topReasonChips(signals: DiscoverySignal[], max = 2): string[] {
  return [...signals]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, max)
    .map((s) => s.label);
}

export function packageMatchesSourceFilter(
  signals: DiscoverySignal[],
  filter: DiscoverySourceFilter
): boolean {
  if (filter === "all") return true;
  return signals.some((s) => s.type === filter);
}

/**
 * Deduplicate a proposed subject key into an existing subject map.
 * Returns the existing key when titles/keys collide.
 */
export function dedupeSubjectKey(
  proposedKey: string,
  proposedTitle: string,
  existing: Array<{ subjectKey: string; title: string }>
): { action: "new" | "merge"; subjectKey: string } {
  const key = proposedKey.trim().toLowerCase();
  const titleNorm = proposedTitle.trim().toLowerCase();
  for (const e of existing) {
    if (e.subjectKey === key) return { action: "merge", subjectKey: e.subjectKey };
    if (e.title.trim().toLowerCase() === titleNorm) {
      return { action: "merge", subjectKey: e.subjectKey };
    }
  }
  return { action: "new", subjectKey: key || "subject" };
}

/**
 * Cheap gate: skip deep research when nothing material changed.
 */
export function shouldDeepResearch(input: {
  hasKnownKnowledgeMatch: boolean;
  signals: DiscoverySignal[];
  lastCheckedAt?: string | null;
  now?: Date;
}): { research: boolean; skipReason?: string } {
  if (input.hasKnownKnowledgeMatch && input.signals.length === 0) {
    return { research: false, skipReason: "Existing Knowledge covers this subject; no new signals." };
  }
  const material = input.signals.filter(
    (s) =>
      (s.confidence === "high" || s.confidence === "medium") && s.type !== "potential_change"
  );
  if (input.signals.length > 0 && input.signals.every((s) => s.type === "potential_change")) {
    return {
      research: false,
      skipReason: "Potential change only — monitor linked sources; do not rewrite Knowledge.",
    };
  }
  if (material.length === 0 && input.signals.every((s) => s.confidence === "inferred")) {
    return {
      research: false,
      skipReason: "Only inferred signals — cheap check only; not treated as confirmed updates.",
    };
  }
  if (input.lastCheckedAt) {
    const last = new Date(input.lastCheckedAt).getTime();
    const now = (input.now ?? new Date()).getTime();
    if (Number.isFinite(last) && now - last < 24 * 60 * 60 * 1000 && material.length === 0) {
      return { research: false, skipReason: "Checked within 24h with no material change." };
    }
  }
  return { research: true };
}

export type DeriveDiscoverySignalsInput = {
  subjectKey: string;
  title: string;
  sourceKinds: string[];
  knowledgeStatuses: string[];
  whyNow?: string;
  windowLabel?: string | null;
  heatingSeason: boolean;
  coverageIncomplete: boolean;
  provenanceHints?: Array<{
    url?: string | null;
    label?: string | null;
    detectedAt?: string | null;
    changeKind?: string | null;
  }>;
  now?: Date;
};

/**
 * Attribute discovery reasons from existing Knowledge / schedule context.
 * Does not invent confirmed regulatory updates from weak heuristics.
 */
export function deriveDiscoverySignals(input: DeriveDiscoverySignalsInput): DiscoverySignal[] {
  const now = input.now ?? new Date();
  const detectedAt = now.toISOString();
  const signals: DiscoverySignal[] = [];
  const kinds = new Set(input.sourceKinds.map((k) => k.toLowerCase()));
  const why = (input.whyNow ?? "").toLowerCase();

  if (kinds.has("operational_discovery")) {
    signals.push({
      type: "property_work_pattern",
      label: "Pattern in property work",
      observation: "Recurring operational themes suggested this subject for investigation.",
      confidence: "medium",
      detectedAt,
      sourceUrls: [],
      strength: 60,
    });
  }

  if (kinds.has("community_brain")) {
    signals.push({
      type: "user_demand",
      label: "User questions and search demand",
      observation: "Community / cohort patterns indicated demand for guidance on this subject.",
      confidence: "medium",
      detectedAt,
      sourceUrls: [],
      strength: 55,
    });
  }

  if (input.coverageIncomplete || input.knowledgeStatuses.includes("candidate")) {
    signals.push({
      type: "knowledge_gap",
      label: "Knowledge gap",
      observation: "Coverage is incomplete or unverified Knowledge remains for this subject.",
      confidence: "high",
      detectedAt,
      sourceUrls: [],
      strength: 70,
    });
  }

  const seasonalHint =
    input.heatingSeason &&
    (/heat|boiler|chimney|flue|gutter|autumn|winter|frost/i.test(input.subjectKey) ||
      /heat|boiler|chimney|season|autumn/i.test(why) ||
      Boolean(input.windowLabel && /heat|season|autumn|winter/i.test(input.windowLabel)));

  if (seasonalHint) {
    signals.push({
      type: "seasonal",
      label: "Heating season approaching",
      observation: input.windowLabel
        ? `Seasonal window: ${input.windowLabel}.`
        : "Seasonal calendar relevance for heating / autumn maintenance.",
      confidence: "medium",
      detectedAt,
      sourceUrls: [],
      strength: 65,
    });
  }

  // Stale Knowledge suggests possible guidance drift — explicitly inferred, not confirmed.
  if (input.knowledgeStatuses.includes("stale")) {
    signals.push({
      type: "official_guidance",
      label: "Possible guidance drift",
      observation:
        "Existing Knowledge is marked stale. This is an inferred watch signal — not a confirmed official guidance change.",
      confidence: "inferred",
      detectedAt,
      sourceUrls: [],
      strength: 40,
    });
  }

  for (const hint of input.provenanceHints ?? []) {
    const change = (hint.changeKind ?? "").toLowerCase();
    const urls = hint.url ? [hint.url] : [];
    if (
      change.includes("potential_change") ||
      change.includes("news") ||
      change.includes("consultation") ||
      change.includes("announcement")
    ) {
      signals.push({
        type: "potential_change",
        label: "Potential change",
        observation:
          hint.label ||
          "A government announcement or consultation may eventually affect this subject. Current guidance remains valid until legislation or operational guidance is updated.",
        confidence: "medium",
        detectedAt: hint.detectedAt ?? detectedAt,
        sourceUrls: urls,
        strength: 50,
      });
    } else if (change.includes("regulat") || change.includes("statute") || change.includes("law")) {
      signals.push({
        type: "regulatory_update",
        label: "Regulatory update",
        observation: hint.label || "Authoritative source indicated a regulatory change.",
        confidence: urls.length ? "high" : "medium",
        detectedAt: hint.detectedAt ?? detectedAt,
        sourceUrls: urls,
        strength: 90,
      });
    } else if (change.includes("guidance") || change.includes("official")) {
      signals.push({
        type: "official_guidance",
        label: "Official guidance changed",
        observation: hint.label || "Official guidance source changed.",
        confidence: urls.length ? "high" : "medium",
        detectedAt: hint.detectedAt ?? detectedAt,
        sourceUrls: urls,
        strength: 85,
      });
    } else if (change.includes("seasonal")) {
      signals.push({
        type: "seasonal",
        label: hint.label || "Seasonal relevance",
        observation: hint.label
          ? `Watch detection: ${hint.label}.`
          : "Watch proposed this subject for seasonal relevance.",
        confidence: "medium",
        detectedAt: hint.detectedAt ?? detectedAt,
        sourceUrls: urls,
        strength: 65,
      });
    } else if (change.includes("knowledge_gap") || change.includes("gap")) {
      signals.push({
        type: "knowledge_gap",
        label: hint.label || "Knowledge gap",
        observation: "Watch proposed this subject because coverage was missing.",
        confidence: "high",
        detectedAt: hint.detectedAt ?? detectedAt,
        sourceUrls: urls,
        strength: 70,
      });
    }
  }

  // Prefer higher-confidence duplicates of the same type.
  const byType = new Map<DiscoverySourceType, DiscoverySignal>();
  for (const s of signals) {
    const prev = byType.get(s.type);
    if (!prev || s.strength > prev.strength) byType.set(s.type, s);
  }
  return [...byType.values()].sort((a, b) => b.strength - a.strength);
}

export function confidenceLabel(c: DiscoveryConfidence): string {
  switch (c) {
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    case "low":
      return "Low confidence";
    case "inferred":
      return "Inferred — not confirmed";
  }
}
