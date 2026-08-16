/**
 * Phase 5 — AI allowance gate for edge functions.
 * When exhausted: callers must fall back to manual / rule-based paths.
 * Never use this to block core task completion or file uploads.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AiOpsGate = {
  allowed: boolean;
  reason?: string;
  message?: string;
  cost_units: number;
  ai_ops_used?: number;
  ai_ops_allowance?: number;
};

const COST_UNITS: Record<string, number> = {
  "ai-extract": 1,
  "ai-image-analyse": 2,
  "ai-doc-analyse": 3,
  "ai-doc-reanalyse": 3,
  "compliance-clause-rewrite": 2,
  "knowledge-critic": 2,
  "building-plan-process": 5,
  // Escalation is a user-initiated second pass on a frontier model. It is metered
  // separately from the normal run because it is a different, dearer product.
  // Never trigger it automatically: per-item escalation is an unbounded multiplier.
  "building-plan-process:escalation": 15,
  "ai-doc-analyse:escalation": 9,
};

/** Metering key for a run. Escalation is its own line, not a discount on the first. */
export function aiOpsMeteringKey(functionName: string, escalation = false): string {
  return escalation ? `${functionName}:escalation` : functionName;
}

export function aiOpsCostUnits(functionName: string): number {
  return COST_UNITS[functionName] ?? 1;
}

export async function assertAiOpsAllowed(
  serviceClient: SupabaseClient,
  orgId: string,
  functionName: string,
  costUnits?: number
): Promise<AiOpsGate> {
  const units = costUnits ?? aiOpsCostUnits(functionName);
  try {
    const { data, error } = await serviceClient.rpc("assert_ai_ops_allowed", {
      p_org_id: orgId,
      p_function_name: functionName,
      p_cost_units: units,
    });
    if (error) {
      console.warn("[aiEntitlements] assert failed open:", error.message);
      return { allowed: true, cost_units: units };
    }
    const payload = (data ?? {}) as Record<string, unknown>;
    return {
      allowed: payload.allowed !== false,
      reason: typeof payload.reason === "string" ? payload.reason : undefined,
      message: typeof payload.message === "string" ? payload.message : undefined,
      cost_units:
        typeof payload.cost_units === "number" ? payload.cost_units : units,
      ai_ops_used:
        typeof payload.ai_ops_used === "number" ? payload.ai_ops_used : undefined,
      ai_ops_allowance:
        typeof payload.ai_ops_allowance === "number"
          ? payload.ai_ops_allowance
          : undefined,
    };
  } catch (err) {
    console.warn("[aiEntitlements] assert exception — fail open", err);
    return { allowed: true, cost_units: units };
  }
}

export function aiAllowanceExhaustedResponse(
  gate: AiOpsGate,
  corsHeaders: Record<string, string>,
  extra: Record<string, unknown> = {}
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "ai_allowance_exhausted",
      message:
        gate.message ||
        "AI allowance reached. Manual workflows continue.",
      ai_ops_used: gate.ai_ops_used,
      ai_ops_allowance: gate.ai_ops_allowance,
      cost_units: gate.cost_units,
      ...extra,
    }),
    {
      status: 200, // do not break fire-and-forget clients
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
