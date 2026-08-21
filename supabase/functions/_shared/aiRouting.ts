/**
 * Capability routing for the AI call boundary — pure logic, no Deno/network access
 * so it can be unit tested from the app test suite.
 *
 * A capability is a job with a contract. A strategy is how that job gets done:
 * either a model call or a deterministic (non-AI) path. Callers never name models.
 */

export type Provider = "GEMINI" | "OPENAI" | "LOVABLE";

export type StrategyKind = "model" | "deterministic";

export interface Strategy {
  /** Stable id used to look up an executor, e.g. "model:gemini-2.0-flash". */
  id: string;
  kind: StrategyKind;
  /** "NONE" for deterministic strategies, which need no credentials. */
  provider: Provider | "NONE";
  /** Model identifier, or the deterministic strategy name. Logged as `model_used`. */
  model: string;
  vision: boolean;
  pdf: boolean;
  structuredJson: boolean;
  costClass: "none" | "low" | "high";
}

/**
 * Approved strategies. Adding a model here is a reviewable change with a git history,
 * which is deliberate: an approved-model change is security and cost relevant.
 */
export const STRATEGIES: Record<string, Strategy> = {
  "model:gemini-2.0-flash": {
    id: "model:gemini-2.0-flash",
    kind: "model",
    provider: "GEMINI",
    model: "gemini-2.0-flash",
    vision: true,
    pdf: true,
    structuredJson: true,
    costClass: "low",
  },
  "model:gpt-4o-mini": {
    id: "model:gpt-4o-mini",
    kind: "model",
    provider: "OPENAI",
    model: "gpt-4o-mini",
    vision: true,
    // OpenAI chat completions cannot take a raw PDF; this was previously an
    // inline `effectiveMime !== "application/pdf"` check in ai-doc-analyse.
    pdf: false,
    structuredJson: true,
    costClass: "low",
  },
  "model:google/gemini-2.0-flash": {
    id: "model:google/gemini-2.0-flash",
    kind: "model",
    provider: "LOVABLE",
    model: "google/gemini-2.0-flash",
    vision: true,
    pdf: true,
    structuredJson: true,
    costClass: "low",
  },
  "deterministic:rule-based-task": {
    id: "deterministic:rule-based-task",
    kind: "deterministic",
    provider: "NONE",
    model: "rule-based-task",
    vision: false,
    pdf: false,
    structuredJson: true,
    costClass: "none",
  },
  "deterministic:pdf-text": {
    id: "deterministic:pdf-text",
    kind: "deterministic",
    provider: "NONE",
    model: "pdf-text",
    vision: false,
    pdf: true,
    structuredJson: true,
    costClass: "none",
  },
};

export type Capability =
  | "task_extraction"
  | "document_analysis"
  | "photo_asset_identification"
  | "compliance_clause_rewrite"
  | "knowledge_critique"
  | "plan_label_extraction";

export interface CapabilityRequirements {
  vision?: boolean;
  pdf?: boolean;
  structuredJson?: boolean;
}

export interface CapabilityDef {
  /** Edge function name — drives `ai_requests.function_name` and cost units. */
  functionName: string;
  /** Pinned with the model: a prompt tuned for one provider may not suit another. */
  promptVersion: string;
  requires: CapabilityRequirements;
  /** Preferred strategies, best first. Later entries are fallbacks. */
  order: string[];
  /**
   * Ch 7: the Knowledge critic must not reuse the extractor's provider, or the
   * second opinion is theatre. Enforced in `resolveStrategies`.
   */
  requireDistinctProvider?: boolean;
}

export const CAPABILITIES: Record<Capability, CapabilityDef> = {
  task_extraction: {
    functionName: "ai-extract",
    promptVersion: "task-extraction-v1",
    requires: { structuredJson: true },
    order: [
      "model:google/gemini-2.0-flash",
      "model:gemini-2.0-flash",
      "model:gpt-4o-mini",
      "deterministic:rule-based-task",
    ],
  },
  document_analysis: {
    functionName: "ai-doc-analyse",
    promptVersion: "doc-analysis-v2",
    requires: { vision: true, structuredJson: true },
    order: ["model:gemini-2.0-flash", "model:gpt-4o-mini"],
  },
  photo_asset_identification: {
    functionName: "ai-image-analyse",
    promptVersion: "image-analysis-v2",
    requires: { vision: true, structuredJson: true },
    order: ["model:gemini-2.0-flash", "model:gpt-4o-mini"],
  },
  compliance_clause_rewrite: {
    functionName: "compliance-clause-rewrite",
    promptVersion: "clause-rewrite-v1",
    requires: { structuredJson: true },
    order: [
      "model:google/gemini-2.0-flash",
      "model:gpt-4o-mini",
      "model:gemini-2.0-flash",
    ],
  },
  knowledge_critique: {
    functionName: "knowledge-critic",
    promptVersion: "knowledge-critic-v1",
    requires: { structuredJson: true },
    order: ["model:gpt-4o-mini", "model:gemini-2.0-flash"],
    requireDistinctProvider: true,
  },
  plan_label_extraction: {
    functionName: "building-plan-process",
    promptVersion: "plan-spaces-v1",
    requires: { vision: true, structuredJson: true },
    order: ["model:gemini-2.0-flash", "model:gpt-4o-mini"],
  },
};

/**
 * `AI_PROVIDER` has historically been read three different ways (raw uppercase in
 * ai-extract, lowercased in ai-doc-analyse and building-plan-process). One parser.
 */
export function normaliseProvider(raw: string | null | undefined): Provider | null {
  const value = (raw ?? "").trim().toUpperCase();
  if (!value) return null;
  if (value.includes("LOVABLE")) return "LOVABLE";
  if (value.includes("OPENAI") || value.includes("GPT")) return "OPENAI";
  if (value.includes("GEMINI") || value.includes("GOOGLE")) return "GEMINI";
  return null;
}

export interface ResolveContext {
  /** Providers that currently have credentials configured. */
  availableProviders: Provider[];
  /** `AI_PROVIDER` preference, if set. */
  preferred?: Provider | null;
  /** Call-time input traits that tighten the capability's requirements. */
  input?: { pdf?: boolean; vision?: boolean };
  /** Provider that must not be reused (upstream extractor for the critic). */
  mustDifferFrom?: string | null;
  /** Phase 3 override: a strategy id pinned by a platform admin. */
  override?: string | null;
}

/**
 * Ordered, eligible strategies for a capability. Empty means the job cannot run
 * with the current credentials and constraints.
 */
export function resolveStrategies(
  capability: Capability,
  ctx: ResolveContext
): Strategy[] {
  const def = CAPABILITIES[capability];
  if (!def) return [];

  const ids = [...def.order];

  // An override is a pin, not a replacement: it goes first, the rest stay as fallbacks.
  if (ctx.override && STRATEGIES[ctx.override]) {
    const withoutOverride = ids.filter((id) => id !== ctx.override);
    ids.length = 0;
    ids.push(ctx.override, ...withoutOverride);
  }

  const needsVision = Boolean(def.requires.vision || ctx.input?.vision);
  const needsPdf = Boolean(def.requires.pdf || ctx.input?.pdf);
  const needsJson = Boolean(def.requires.structuredJson);
  const excludedProvider = def.requireDistinctProvider
    ? normaliseProvider(ctx.mustDifferFrom)
    : null;

  const available = new Set(ctx.availableProviders);

  const eligible = ids
    .map((id) => STRATEGIES[id])
    .filter((strategy): strategy is Strategy => Boolean(strategy))
    .filter((strategy) => {
      if (needsVision && !strategy.vision) return false;
      if (needsPdf && !strategy.pdf) return false;
      if (needsJson && !strategy.structuredJson) return false;
      if (strategy.kind === "model" && !available.has(strategy.provider as Provider)) {
        return false;
      }
      if (excludedProvider && strategy.provider === excludedProvider) return false;
      return true;
    });

  if (!ctx.preferred) return eligible;

  // Stable partition so the preferred provider leads without losing fallback order.
  const preferredFirst = eligible.filter((s) => s.provider === ctx.preferred);
  const rest = eligible.filter((s) => s.provider !== ctx.preferred);
  return [...preferredFirst, ...rest];
}

/** Raised when a provider response does not match the capability's declared shape. */
export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}

/** Raised when a provider call exceeded its latency budget. Logged as status `timeout`. */
export class TimeoutError extends Error {
  constructor(message = "Timeout") {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Parse model JSON that may arrive wrapped in a markdown fence. Replaces the
 * per-function `replace(/```json/…)` handling.
 */
export function parseJsonLoose(text: string): unknown {
  let candidate = (text ?? "").trim();
  if (!candidate) throw new SchemaError("Empty model response");

  const fenced = candidate.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fenced) candidate = fenced[1].trim();
  else candidate = candidate.replace(/```json\n?|\n?```/g, "").trim();

  try {
    return JSON.parse(candidate);
  } catch (err) {
    throw new SchemaError(`Model response was not valid JSON: ${String(err)}`);
  }
}

/** True when a failure is worth one immediate retry on the same strategy. */
export function isRetryableFailure(error: unknown): boolean {
  return error instanceof SchemaError;
}
