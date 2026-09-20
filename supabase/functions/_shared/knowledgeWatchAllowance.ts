/**
 * Knowledge Watch research allowance — server enforcement.
 * Keep limits in sync with src/lib/content/knowledgeWatch.ts
 */

export type ResearchAllowance = "light" | "standard" | "thorough";
export type AutomatedResearchMode = "paused" | "on";

export type ResearchAllowanceLimits = {
  searches: number;
  pages: number;
  tokens: number;
  cost_units: number;
};

export const RESEARCH_ALLOWANCE_LIMITS: Record<ResearchAllowance, ResearchAllowanceLimits> = {
  light: { searches: 20, pages: 40, tokens: 200_000, cost_units: 50 },
  standard: { searches: 80, pages: 160, tokens: 800_000, cost_units: 200 },
  thorough: { searches: 250, pages: 500, tokens: 2_500_000, cost_units: 600 },
};

export type WatchUsage = {
  period_ym: string;
  searches_used: number;
  pages_used: number;
  tokens_used: number;
  cost_units_used: number;
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

export type AllowanceCheckResult =
  | { ok: true; remaining: ResearchAllowanceLimits }
  | {
      ok: false;
      reason: "paused" | "searches" | "pages" | "tokens" | "cost_units";
      remaining: ResearchAllowanceLimits;
      message: string;
    };

export function checkResearchAllowance(input: {
  automatedResearch: AutomatedResearchMode;
  allowance: ResearchAllowance;
  usage: WatchUsage;
  need?: Partial<ResearchAllowanceLimits>;
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
      message: "Automated research is paused.",
    };
  }
  if (remaining.searches < need.searches) {
    return {
      ok: false,
      reason: "searches",
      remaining,
      message: `Search allowance exhausted for ${input.usage.period_ym}.`,
    };
  }
  if (remaining.pages < need.pages) {
    return {
      ok: false,
      reason: "pages",
      remaining,
      message: `Page-fetch allowance exhausted for ${input.usage.period_ym}.`,
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

/** Cheap gate before spending budget. */
export function shouldDeepResearch(input: {
  hasKnownKnowledgeMatch: boolean;
  materialSignalCount: number;
  inferredOnly: boolean;
}): { research: boolean; skipReason?: string } {
  if (input.hasKnownKnowledgeMatch && input.materialSignalCount === 0) {
    return {
      research: false,
      skipReason: "Existing Knowledge covers this subject; no new material signals.",
    };
  }
  if (input.inferredOnly) {
    return {
      research: false,
      skipReason: "Only inferred signals — not treated as confirmed updates.",
    };
  }
  return { research: true };
}

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
