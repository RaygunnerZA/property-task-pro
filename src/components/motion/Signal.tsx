import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion/tokens";
import { useFillaReducedMotion, useSequenceEntrance } from "./MotionSequence";

export type SignalTone = "attention" | "risk";

const TONE_CLASS: Record<SignalTone, string> = {
  attention: "bg-warning-vivid",
  risk: "bg-accent",
};

/**
 * SIGNAL — something requires attention.
 * A paper tab extends once along one edge of its (relative) parent. It never
 * loops or pulses. With `persist`, the tab stays as a static mark; otherwise it
 * retracts after ~1.4s.
 *
 * Use for state changes the user did not cause (an upload became ready, a
 * document reads as unsatisfactory). Never on page load for old items.
 */
export function SignalMark({
  tone = "attention",
  edge = "left",
  persist = false,
  step,
  index = 0,
  className,
}: {
  tone?: SignalTone;
  edge?: "left" | "bottom";
  persist?: boolean;
  /** Sequence stage, when used inside a MotionSequence. */
  step?: number;
  index?: number;
  className?: string;
}) {
  const reduced = useFillaReducedMotion();
  const delay = useSequenceEntrance(step ?? 0, index);
  const animate = !reduced && delay !== null;
  const axis = edge === "left" ? "scaleY" : "scaleX";

  if (!persist && !animate) return null;

  const shape =
    edge === "left"
      ? "left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full origin-top"
      : "left-0 right-0 -bottom-1 h-0.5 rounded-full origin-left";

  const keyframes = persist ? [0, 1] : [0, 1, 1, 0];

  return (
    <motion.span
      aria-hidden
      className={cn("pointer-events-none absolute", shape, TONE_CLASS[tone], className)}
      initial={animate ? { [axis]: 0 } : false}
      animate={{ [axis]: animate ? keyframes : 1 }}
      transition={
        persist
          ? { ...transitions.settle, delay: delay ?? 0 }
          : { duration: 1.6, times: [0, 0.15, 0.85, 1], ease: "easeInOut", delay: delay ?? 0 }
      }
    />
  );
}
