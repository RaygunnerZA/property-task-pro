/**
 * The AI call boundary. Every provider call in Filla should go through here.
 *
 * Five jobs, in order:
 *   1. gate the org's AI allowance
 *   2. resolve which strategies may serve the capability
 *   3. validate the response against the capability's declared shape
 *   4. retry once on an invalid shape, then fall back to the next strategy
 *   5. log one ai_requests row per provider call
 *
 * Allowance is derived from ai_requests, so an unlogged call is an unmetered call.
 * That makes step 5 a billing requirement, not an observability nicety.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  estimateCost,
  logAiRequest,
  EMPTY_USAGE,
  type AiRequestStatus,
  type TokenUsage,
} from "./aiObservability.ts";
import {
  assertAiOpsAllowed,
  aiOpsCostUnits,
  aiOpsMeteringKey,
  type AiOpsGate,
} from "./aiEntitlements.ts";
import {
  CAPABILITIES,
  TimeoutError,
  isRetryableFailure,
  normaliseProvider,
  resolveStrategies,
  type Capability,
  type Provider,
  type Strategy,
} from "./aiRouting.ts";

export type { Capability, Strategy } from "./aiRouting.ts";

/** What a strategy executor returns: the raw payload plus reported token usage. */
export interface ExecutorOutput {
  raw: unknown;
  usage?: TokenUsage;
}

/**
 * Executes one strategy. Prompt and payload shaping stay with the calling function,
 * because those differ per capability; the boundary owns everything around the call.
 */
export type StrategyExecutor = (strategy: Strategy) => Promise<ExecutorOutput>;

export interface RunCapabilityParams<T> {
  capability: Capability;
  orgId: string;
  userId?: string | null;
  /** Executors keyed by strategy id. Strategies without an executor are skipped. */
  executors: Record<string, StrategyExecutor>;
  /** Throws (ideally SchemaError) when the payload does not match the contract. */
  validate: (raw: unknown) => T;
  input?: { pdf?: boolean; vision?: boolean };
  /** Upstream provider the resolver must avoid (Knowledge critic distinctness). */
  mustDifferFrom?: string | null;
  entity?: { type?: string | null; id?: string | null };
  metadata?: Record<string, unknown>;
  /** Override the catalogued cost units for this capability. */
  costUnits?: number;
  /** Set when the caller has already asserted the allowance. Ignored for escalation. */
  skipGate?: boolean;
  /**
   * A user-initiated deeper second pass ("try a deeper analysis on this sheet").
   * Metered as its own operation at its own cost units and always gated, because
   * automatic escalation is an unbounded cost multiplier against ai_ops_allowance.
   */
  escalation?: boolean;
  /**
   * Whether a second strategy may serve the job when the first fails. Off means
   * one strategy only (still retried once on a bad shape). Callers set this
   * explicitly because sending data to a second provider is a deliberate choice.
   */
  allowFallback?: boolean;
}

export interface RunCapabilityResult<T> {
  ok: boolean;
  /** True when the AI allowance is exhausted — callers fall back to manual paths. */
  blocked: boolean;
  value: T | null;
  strategy: Strategy | null;
  status: AiRequestStatus;
  error: string | null;
  gate: AiOpsGate | null;
  /** Provider calls actually made, including retries. */
  attempts: number;
}

function availableProviders(): Provider[] {
  const providers: Provider[] = [];
  if (Deno.env.get("GEMINI_API_KEY")) providers.push("GEMINI");
  if (Deno.env.get("OPENAI_API_KEY")) providers.push("OPENAI");
  if (Deno.env.get("LOVABLE_API_KEY")) providers.push("LOVABLE");
  return providers;
}

/** Emergency pins from ai_route_overrides, cached per warm isolate. */
const OVERRIDE_TTL_MS = 60_000;
let overrideCache: { at: number; byCapability: Record<string, string> } | null = null;

/**
 * Reads active route pins. Any failure returns no overrides, so the compiled
 * defaults apply — a broken override table must never take down every AI feature.
 */
async function routeOverrides(
  serviceClient: SupabaseClient
): Promise<Record<string, string>> {
  const now = Date.now();
  if (overrideCache && now - overrideCache.at < OVERRIDE_TTL_MS) {
    return overrideCache.byCapability;
  }

  try {
    const { data, error } = await serviceClient.rpc("active_ai_route_overrides");
    if (error) throw new Error(error.message);

    const byCapability: Record<string, string> = {};
    for (const row of (data ?? []) as { capability?: string; strategy?: string }[]) {
      if (row?.capability && row?.strategy) byCapability[row.capability] = row.strategy;
    }
    overrideCache = { at: now, byCapability };
    return byCapability;
  } catch (err) {
    console.warn("[aiCall] route overrides unavailable — using compiled defaults:", err);
    // Cache the empty result too, so one broken read does not add a round trip
    // to every call for the next minute.
    overrideCache = { at: now, byCapability: {} };
    return {};
  }
}

export async function runCapability<T>(
  serviceClient: SupabaseClient,
  params: RunCapabilityParams<T>
): Promise<RunCapabilityResult<T>> {
  const def = CAPABILITIES[params.capability];
  if (!def) {
    return {
      ok: false,
      blocked: false,
      value: null,
      strategy: null,
      status: "error",
      error: `Unknown capability: ${params.capability}`,
      gate: null,
      attempts: 0,
    };
  }

  const escalation = params.escalation === true;
  const meteringKey = aiOpsMeteringKey(def.functionName, escalation);
  const costUnits = params.costUnits ?? aiOpsCostUnits(meteringKey);

  let gate: AiOpsGate | null = null;
  // An escalation is always gated: it is the expensive path, and the caller's
  // earlier gate was for the cheap one.
  if (!params.skipGate || escalation) {
    gate = await assertAiOpsAllowed(serviceClient, params.orgId, meteringKey, costUnits);
    if (!gate.allowed) {
      return {
        ok: false,
        blocked: true,
        value: null,
        strategy: null,
        status: "error",
        error: gate.reason ?? "ai_allowance_exhausted",
        gate,
        attempts: 0,
      };
    }
  }

  const overrides = await routeOverrides(serviceClient);

  const eligible = resolveStrategies(params.capability, {
    availableProviders: availableProviders(),
    preferred: normaliseProvider(Deno.env.get("AI_PROVIDER")),
    input: params.input,
    mustDifferFrom: params.mustDifferFrom ?? null,
    override: overrides[params.capability] ?? null,
  }).filter((strategy) => Boolean(params.executors[strategy.id]));

  const candidates =
    params.allowFallback === false ? eligible.slice(0, 1) : eligible;

  if (candidates.length === 0) {
    return {
      ok: false,
      blocked: false,
      value: null,
      strategy: null,
      status: "error",
      error: "No eligible strategy for this capability",
      gate,
      attempts: 0,
    };
  }

  let attempts = 0;
  let lastError: string | null = null;

  for (let index = 0; index < candidates.length; index++) {
    const strategy = candidates[index];
    const executor = params.executors[strategy.id];
    // A later strategy serving the result means the primary failed.
    const strategyStatus: AiRequestStatus = index === 0 ? "success" : "fallback";

    // One retry, but only when the shape was wrong rather than the transport.
    for (let attempt = 0; attempt < 2; attempt++) {
      const started = Date.now();
      let usage: TokenUsage = EMPTY_USAGE;
      let status: AiRequestStatus = strategyStatus;
      let errorMessage: string | null = null;
      let thrown: unknown = null;
      let succeeded = false;
      let value: T | null = null;

      try {
        const output = await executor(strategy);
        usage = output.usage ?? EMPTY_USAGE;
        value = params.validate(output.raw);
        succeeded = true;
      } catch (err) {
        thrown = err;
        status = err instanceof TimeoutError ? "timeout" : "error";
        errorMessage = err instanceof Error ? err.message : String(err);
        lastError = errorMessage;
      } finally {
        if (strategy.kind === "model") {
          attempts += 1;
          logAiRequest(serviceClient, {
            org_id: params.orgId,
            user_id: params.userId ?? null,
            function_name: def.functionName,
            model_used: strategy.model,
            provider: strategy.provider,
            prompt_version: def.promptVersion,
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
            cost_usd: estimateCost(strategy.model, usage.input_tokens, usage.output_tokens),
            cost_units: costUnits,
            latency_ms: Date.now() - started,
            status,
            error_message: errorMessage,
            entity_type: params.entity?.type ?? null,
            entity_id: params.entity?.id ?? null,
            metadata: {
              ...(params.metadata ?? {}),
              capability: params.capability,
              strategy_id: strategy.id,
              attempt: attempt + 1,
              ...(escalation ? { escalation: true } : {}),
            },
          });
        }
      }

      if (succeeded) {
        return {
          ok: true,
          blocked: false,
          value: value as T,
          strategy,
          status: strategyStatus,
          error: null,
          gate,
          attempts,
        };
      }

      if (attempt === 0 && isRetryableFailure(thrown)) continue;
      break;
    }
  }

  return {
    ok: false,
    blocked: false,
    value: null,
    strategy: null,
    status: "error",
    error: lastError ?? "All strategies failed",
    gate,
    attempts,
  };
}
