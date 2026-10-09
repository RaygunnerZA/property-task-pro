import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { MOTION_STAGGER, staggerDelay } from "@/lib/motion/tokens";

/** True when the user asked the OS to reduce motion. */
export function useFillaReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}

type SequenceContextValue = {
  /** Intro choreography plays the first time this id is seen in a session. */
  playIntro: boolean;
  startedAt: number;
  reduced: boolean;
};

const SequenceContext = createContext<SequenceContextValue | null>(null);

const seenSequenceIds = new Set<string>();

/** Elements mounting this long after the sequence started are new information, not intro. */
const LATE_MOUNT_MS = 150;

/**
 * Groups primitives (Unfold, AlignBlock, Settle, LiftIn) into one ordered
 * understanding sequence: stage 0 → 1 → 2 → 3, 120ms apart.
 *
 * - First view of `id` this session: stages play in order.
 * - Re-opening the same `id`: everything is already settled (no replay).
 * - Content that mounts later (e.g. the document finished reading) animates
 *   right away in compressed stage order (80ms per stage) — that motion reports
 *   a real change, and facts still land before the decision.
 * - Reduced motion: nothing animates.
 *
 * Children are interactive from the first frame; the sequence never gates input.
 */
export function MotionSequence({ id, children }: { id: string; children: ReactNode }) {
  const reduced = useFillaReducedMotion();
  const startedAt = useRef(performance.now()).current;
  const playIntro = useRef<boolean | null>(null);
  if (playIntro.current === null) {
    playIntro.current = !seenSequenceIds.has(id);
    seenSequenceIds.add(id);
  }

  const value = useMemo(
    () => ({ playIntro: Boolean(playIntro.current) && !reduced, startedAt, reduced }),
    [reduced, startedAt]
  );
  return <SequenceContext.Provider value={value}>{children}</SequenceContext.Provider>;
}

/**
 * Should this element animate on mount, and after what delay (seconds)?
 * `null` means render settled (no initial state).
 * Outside a MotionSequence, elements animate on mount with their own stagger.
 */
export function useSequenceEntrance(step: number, index = 0): number | null {
  const ctx = useContext(SequenceContext);
  const reducedOutside = useFillaReducedMotion();
  const mountedAt = useRef(performance.now()).current;

  if (!ctx) {
    return reducedOutside ? null : staggerDelay(step, index);
  }
  if (ctx.reduced) return null;

  const elapsedMs = mountedAt - ctx.startedAt;
  const lateMount = elapsedMs > LATE_MOUNT_MS;
  if (!ctx.playIntro && !lateMount) return null;
  if (lateMount) {
    return step * MOTION_STAGGER.lateStep + Math.min(index, MOTION_STAGGER.maxItems) * MOTION_STAGGER.item;
  }

  return MOTION_STAGGER.lead + staggerDelay(step, index);
}
