import { create } from "zustand";

/**
 * Shared "confirm and settle" completion motion (restrained-motion Experiment A).
 *
 * Task completion can be triggered from two places — the card's own "Mark done"
 * action and the task detail panel's "Mark Complete" CTA. Both drive this store
 * so the card in the list plays the same motion regardless of the trigger:
 * hold the card in a visibly completed state (confirm), then collapse it out so
 * siblings settle instead of jumping. Skipped under prefers-reduced-motion.
 */

export type TaskCompletionPhase = "confirm" | "collapse";

export const COMPLETE_CONFIRM_HOLD_MS = 450;
export const COMPLETE_COLLAPSE_MS = 200;

interface TaskCompletionMotionState {
  phases: Record<string, TaskCompletionPhase>;
  setPhase: (taskId: string, phase: TaskCompletionPhase) => void;
  clearPhase: (taskId: string) => void;
}

export const useTaskCompletionMotion = create<TaskCompletionMotionState>((set) => ({
  phases: {},
  setPhase: (taskId, phase) =>
    set((state) => ({ phases: { ...state.phases, [taskId]: phase } })),
  clearPhase: (taskId) =>
    set((state) => {
      if (!(taskId in state.phases)) return state;
      const next = { ...state.phases };
      delete next[taskId];
      return { phases: next };
    }),
}));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function prefersReducedMotionNow(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Plays confirm → collapse on the task's list card and resolves once the exit
 * finished. Callers should invalidate the tasks queries only after this
 * resolves (so the card isn't removed mid-animation), then call
 * `clearTaskCompletionMotion` once fresh data has landed.
 * Resolves immediately under prefers-reduced-motion.
 */
export async function playTaskCompletionMotion(taskId: string): Promise<void> {
  if (prefersReducedMotionNow()) return;
  const { setPhase } = useTaskCompletionMotion.getState();
  setPhase(taskId, "confirm");
  await sleep(COMPLETE_CONFIRM_HOLD_MS);
  setPhase(taskId, "collapse");
  await sleep(COMPLETE_COLLAPSE_MS);
}

export function clearTaskCompletionMotion(taskId: string): void {
  useTaskCompletionMotion.getState().clearPhase(taskId);
}
