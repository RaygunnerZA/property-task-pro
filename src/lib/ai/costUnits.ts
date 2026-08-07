/**
 * Product-level AI cost units — @Docs/28 Phase 5.
 * Feature code must not bill by USD; use these units vs ai_ops_allowance.
 */

export const AI_OPS_COST_UNITS: Record<string, number> = {
  "ai-extract": 1,
  "ai-image-analyse": 2,
  "ai-doc-analyse": 3,
  "ai-doc-reanalyse": 3,
  "compliance-clause-rewrite": 2,
  "building-plan-process": 5,
};

/** One AI pack unit purchased via Stripe. */
export const AI_OPS_PACK_UNITS = 100;

export function aiOpsCostUnits(functionName: string): number {
  return AI_OPS_COST_UNITS[functionName] ?? 1;
}

export function aiQuotaWarning(used: number, allowance: number): string | null {
  if (allowance <= 0) return null;
  const ratio = used / allowance;
  if (ratio >= 1) {
    return "AI allowance reached for this period. Manual workflows continue — add an AI pack to resume automated analysis.";
  }
  if (ratio >= 0.85) {
    return "AI allowance is nearly used. Manual alternatives remain available.";
  }
  return null;
}
