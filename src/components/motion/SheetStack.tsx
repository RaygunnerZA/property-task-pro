import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { MOTION_DISTANCE, transitions } from "@/lib/motion/tokens";
import { useFillaReducedMotion } from "./MotionSequence";

/**
 * STACK glyph — three offset sheets: retained knowledge / accumulated history.
 * Each change of `arrivals` lays a new top sheet down onto the pile.
 */
export function SheetStack({
  arrivals = 0,
  className,
}: {
  arrivals?: number;
  className?: string;
}) {
  const reduced = useFillaReducedMotion();
  return (
    <span aria-hidden className={cn("relative inline-block h-[10px] w-[13px] shrink-0", className)}>
      <span className="absolute left-[3px] top-0 h-[7px] w-[10px] rounded-[2px] bg-muted-foreground/25" />
      <span className="absolute left-[1.5px] top-[1.5px] h-[7px] w-[10px] rounded-[2px] bg-muted-foreground/40" />
      <motion.span
        key={arrivals}
        className="absolute left-0 top-[3px] h-[7px] w-[10px] rounded-[2px] bg-card ring-1 ring-muted-foreground/55"
        initial={arrivals > 0 && !reduced ? { y: -MOTION_DISTANCE.nudge, opacity: 0.4 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={transitions.settle}
      />
    </span>
  );
}
