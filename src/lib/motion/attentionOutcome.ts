import type { ResolutionOutcome } from "@/lib/motion/resolutions";

/**
 * Map an Inflow / Issues action id to a resolution destination.
 * Unknown or purely local dismissals recede with no destination.
 */
export function attentionOutcomeFromAction(actionId: string): ResolutionOutcome {
  if (actionId === "signal-accept") return "task";
  if (actionId === "signal-convert") return "filed";
  if (actionId === "signal-promote-intake") return "knowledge";
  return "dismissed";
}
