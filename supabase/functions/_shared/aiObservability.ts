/**
 * Shared AI observability utility for Supabase edge functions.
 * Import with: import { logAiRequest, estimateCost } from "../_shared/aiObservability.ts";
 *
 * Usage pattern:
 *   const start = Date.now();
 *   let status: AiRequestStatus = "success";
 *   let errorMessage: string | null = null;
 *   try {
 *     result = await callProvider(...);
 *   } catch (err) {
 *     status = err.name === "AbortError" ? "timeout" : "error";
 *     errorMessage = String(err);
 *   } finally {
 *     logAiRequest(serviceClient, { ..., latency_ms: Date.now() - start, status, error_message: errorMessage });
 *   }
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Current list prices per 1k tokens. Update here when pricing changes.
const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  "gemini-2.0-flash":        { input: 0.000075, output: 0.0003 },
  "gemini-1.5-pro":          { input: 0.00125,  output: 0.005  },
  "gpt-4o-mini":             { input: 0.00015,  output: 0.0006 },
  "gpt-4o":                  { input: 0.0025,   output: 0.01   },
  "google/gemini-2.0-flash": { input: 0.000075, output: 0.0003 },
};

export function estimateCost(
  model: string,
  inputTokens: number | null,
  outputTokens: number | null
): number | null {
  if (!inputTokens || !outputTokens) return null;
  const rates = COST_PER_1K_TOKENS[model];
  if (!rates) return null;
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}

export type AiRequestStatus = "success" | "error" | "timeout" | "fallback";

export interface AiRequestLog {
  org_id: string;
  user_id?: string | null;
  function_name: string;
  model_used: string;
  provider: string;
  prompt_version?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cost_usd?: number | null;
  /** Product-level cost units (Phase 5). Defaults from function name if omitted. */
  cost_units?: number | null;
  latency_ms?: number | null;
  status: AiRequestStatus;
  error_message?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
}

const DEFAULT_COST_UNITS: Record<string, number> = {
  "ai-extract": 1,
  "ai-image-analyse": 2,
  "ai-doc-analyse": 3,
  "ai-doc-reanalyse": 3,
  "compliance-clause-rewrite": 2,
  "building-plan-process": 5,
  "knowledge-critic": 2,
  "knowledge-discovery": 1,
};

/**
 * Non-blocking fire-and-forget insert into ai_requests.
 * Never throws — observability failures must never affect the main request.
 * Requires a service role Supabase client (anon key cannot INSERT due to RLS).
 */
export function logAiRequest(
  serviceClient: SupabaseClient,
  log: AiRequestLog
): void {
  const cost_units =
    log.cost_units ??
    DEFAULT_COST_UNITS[log.function_name] ??
    1;

  serviceClient
    .from("ai_requests")
    .insert({ ...log, cost_units })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        console.error("[aiObservability] Failed to log ai_request:", error.message);
      }
    });
}
