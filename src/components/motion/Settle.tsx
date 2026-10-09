import { useRef, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";
import { MOTION_DISTANCE, MOTION_DURATION, MOTION_EASE, transitions } from "@/lib/motion/tokens";
import { useFillaReducedMotion, useSequenceEntrance } from "./MotionSequence";

type SettleProps = Omit<HTMLMotionProps<"div">, "initial" | "animate" | "transition" | "children"> & {
  children?: ReactNode;
  step?: number;
  index?: number;
  /** Radius class for the depth layer so its shadow matches the child's corners. */
  radiusClassName?: string;
};

/**
 * SETTLE — Filla has reached a decision or state.
 * The layer is laid down onto the page: it arrives a touch raised (1.5% larger,
 * deeper shadow) and comes to rest. No overshoot, no check-mark pop.
 * A settled state is a proposal at rest — it never implies the action already ran.
 */
export function Settle({
  step = 3,
  index = 0,
  radiusClassName = "rounded-lg",
  className,
  children,
  ...rest
}: SettleProps) {
  const delay = useSequenceEntrance(step, index);

  if (delay === null) {
    return (
      <motion.div className={className} {...rest}>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn("relative isolate", className)}
      initial={{ opacity: 0, y: -MOTION_DISTANCE.hair, scale: 1.015 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        ...transitions.settle,
        delay,
        opacity: { duration: MOTION_DURATION.tap, ease: MOTION_EASE.out, delay },
      }}
      {...rest}
    >
      <motion.span
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 -z-10 shadow-e3", radiusClassName)}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ ...transitions.settle, delay: delay + MOTION_DURATION.tap / 2 }}
      />
      {children}
    </motion.div>
  );
}

/**
 * SETTLE for a changing value (e.g. "Not confirmed" → "EICR" when reading completes).
 * The first value renders still; each later value settles in from 4px below.
 */
export function SettleValue({
  value,
  children,
  className,
}: {
  value: string;
  children?: ReactNode;
  className?: string;
}) {
  const reduced = useFillaReducedMotion();
  const firstValue = useRef(value);
  const animate = !reduced && value !== firstValue.current;

  return (
    <motion.span
      key={value}
      className={cn("inline-block", className)}
      initial={animate ? { opacity: 0, y: MOTION_DISTANCE.nudge } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.settle}
    >
      {children ?? value}
    </motion.span>
  );
}
