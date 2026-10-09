import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";
import { MOTION_DISTANCE, MOTION_SCALE, MOTION_SPRING, transitions } from "@/lib/motion/tokens";
import { useFillaReducedMotion, useSequenceEntrance } from "./MotionSequence";

type LiftProps = Omit<HTMLMotionProps<"div">, "initial" | "animate" | "transition" | "children"> & {
  children?: ReactNode;
  /** Raised while true; returns to rest when false. */
  active?: boolean;
  /** Optional sequence stage for its entrance. Omit to appear still. */
  step?: number;
  index?: number;
  radiusClassName?: string;
};

/**
 * LIFT — an object becomes active or relevant (the thing Filla needs from you now).
 * Rises 2px, grows 1%, and gains depth through a separate shadow layer whose
 * opacity animates (box-shadow itself is never interpolated).
 */
export function Lift({
  active = true,
  step,
  index = 0,
  radiusClassName = "rounded-xl",
  className,
  children,
  ...rest
}: LiftProps) {
  const reduced = useFillaReducedMotion();
  const entranceDelay = useSequenceEntrance(step ?? 0, index);
  const enters = step !== undefined && entranceDelay !== null;
  const lifted = active && !reduced;

  return (
    <motion.div
      className={cn("relative isolate", className)}
      initial={enters ? { opacity: 0, y: MOTION_DISTANCE.nudge } : false}
      animate={{
        opacity: 1,
        y: lifted ? -MOTION_DISTANCE.hair : 0,
        scale: lifted ? MOTION_SCALE.lift : 1,
      }}
      transition={{
        ...MOTION_SPRING.paper,
        delay: enters ? entranceDelay ?? 0 : 0,
        opacity: { ...transitions.quick, delay: enters ? entranceDelay ?? 0 : 0 },
      }}
      {...rest}
    >
      <motion.span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 shadow-lift",
          radiusClassName
        )}
        initial={false}
        animate={{ opacity: lifted ? 1 : 0 }}
        transition={transitions.quick}
      />
      {children}
    </motion.div>
  );
}
