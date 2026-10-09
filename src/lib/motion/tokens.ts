/**
 * Filla Motion System — tokens.
 * Spec: @Docs/33_Motion_System.md. CSS mirrors live in src/index.css (--duration-*, --ease-*).
 *
 * Paper has mass but never bounces: every spring here is critically damped (bounce: 0).
 * Only transform and opacity are animated per frame.
 */

import type { Transition } from "motion/react";

/** Seconds. Matches --duration-fast / --duration-default / --duration-settle / --duration-slow. */
export const MOTION_DURATION = {
  /** Press feedback, text swaps. */
  tap: 0.12,
  /** Small state change (hover lift, chip state). */
  quick: 0.2,
  /** An object coming to rest (SETTLE, ALIGN register). */
  settle: 0.28,
  /** Revealing understanding or detail (UNFOLD, thread draw). */
  reveal: 0.32,
  /** Travel to a real destination (STACK into a ledger). */
  travel: 0.36,
} as const;

export type CubicBezier = [number, number, number, number];

export const MOTION_EASE = {
  /** Enter. */
  out: [0, 0, 0.2, 1] as CubicBezier,
  /** Exit. */
  in: [0.4, 0, 1, 1] as CubicBezier,
  /** In-place change. */
  inOut: [0.4, 0, 0.2, 1] as CubicBezier,
  /** Paper laid down: fast departure, long soft landing. Same curve as --ease-emphasized. */
  paper: [0.2, 0, 0, 1] as CubicBezier,
} as const;

export const MOTION_SPRING = {
  /** Small objects: chips, rows, lift. */
  paper: { type: "spring", visualDuration: 0.28, bounce: 0 } as Transition,
  /** Larger layers and layout (FLIP) shifts. */
  layer: { type: "spring", visualDuration: 0.36, bounce: 0 } as Transition,
} as const;

/** Pixels. Nothing travels further than `travel` unless it is moving to a real on-screen destination. */
export const MOTION_DISTANCE = {
  hair: 2,
  nudge: 4,
  rise: 6,
  travel: 16,
} as const;

export const MOTION_SCALE = {
  lift: 1.01,
  press: 0.985,
  recede: 0.98,
  /** Lowest scale anything may start from. Never scale from 0. */
  floor: 0.96,
} as const;

export const MOTION_STAGGER = {
  /** Between siblings inside one stage. */
  item: 0.04,
  /** Between stages of an understanding sequence. */
  step: 0.12,
  /**
   * Between stages when content arrives after the intro (e.g. reading finished).
   * Keeps facts ahead of the decision without making the user wait.
   */
  lateStep: 0.08,
  /** Siblings after this index share the last delay. */
  maxItems: 6,
  /** Delay before a sequence starts, so it layers onto a sheet/dialog entrance. */
  lead: 0.18,
} as const;

/** Whole intro sequences must finish within this budget (seconds). */
export const MOTION_SEQUENCE_BUDGET = 0.9;

export const transitions = {
  tap: { duration: MOTION_DURATION.tap, ease: MOTION_EASE.out } as Transition,
  quick: { duration: MOTION_DURATION.quick, ease: MOTION_EASE.out } as Transition,
  settle: { duration: MOTION_DURATION.settle, ease: MOTION_EASE.paper } as Transition,
  reveal: { duration: MOTION_DURATION.reveal, ease: MOTION_EASE.paper } as Transition,
  exit: { duration: MOTION_DURATION.tap, ease: MOTION_EASE.in } as Transition,
} as const;

/** Delay for item `index` within stage `step`, capped by MOTION_STAGGER.maxItems. */
export function staggerDelay(step: number, index = 0): number {
  const capped = Math.min(Math.max(index, 0), MOTION_STAGGER.maxItems);
  return step * MOTION_STAGGER.step + capped * MOTION_STAGGER.item;
}
