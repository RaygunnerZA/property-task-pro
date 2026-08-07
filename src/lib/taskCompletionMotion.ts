import { create } from "zustand";

/**
 * Shared completion confirm motion (restrained-motion Experiment A).
 *
 * Task completion can be triggered from the card's "Mark done" action or the
 * detail panel's "Mark Complete" CTA. Both drive this store so the list card
 * plays a short confirm flash. Completed work stays on screen (no collapse).
 * Skipped under prefers-reduced-motion.
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
 * Plays a short confirm flash on the task's list card (no collapse/exit).
 * Completed work stays visible in All under Done — collapsing felt like the
 * task vanished. Skipped under prefers-reduced-motion.
 */
export async function playTaskCompletionMotion(taskId: string): Promise<void> {
  if (prefersReducedMotionNow()) return;
  const { setPhase } = useTaskCompletionMotion.getState();
  setPhase(taskId, "confirm");
  await sleep(COMPLETE_CONFIRM_HOLD_MS);
  // Do not enter collapse — keep the card on screen.
}

export function clearTaskCompletionMotion(taskId: string): void {
  useTaskCompletionMotion.getState().clearPhase(taskId);
}
