import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { MOTION_DISTANCE, transitions } from "@/lib/motion/tokens";
import { useSequenceEntrance } from "./MotionSequence";

/** Side insets are negative so paper shadows are not cut off while revealing. */
export const UNFOLD_CLIP_CLOSED = "inset(-8px -8px 100% -8px)";
export const UNFOLD_CLIP_OPEN = "inset(-8px -8px 0% -8px)";

type UnfoldProps = Omit<HTMLMotionProps<"div">, "initial" | "animate" | "transition" | "children"> & {
  children?: ReactNode;
  /** Sequence stage (0 input · 1 facts · 2 interpretation · 3 decision). */
  step?: number;
  /** Position within the stage, for the 40ms stagger. */
  index?: number;
  as?: "div" | "li" | "section" | "span";
};

/**
 * UNFOLD — understanding or detail is being revealed.
 * The block takes its full layout space immediately (one layout pass) and is
 * revealed visually: a top-down clip with a 4px rise. No height animation.
 */
export function Unfold({ step = 1, index = 0, as = "div", children, style, ...rest }: UnfoldProps) {
  const delay = useSequenceEntrance(step, index);
  const Component = motion[as] as typeof motion.div;

  if (delay === null) {
    return (
      <Component style={style} {...rest}>
        {children}
      </Component>
    );
  }

  return (
    <Component
      initial={{ opacity: 0, y: MOTION_DISTANCE.nudge, clipPath: UNFOLD_CLIP_CLOSED }}
      animate={{
        opacity: 1,
        y: 0,
        clipPath: UNFOLD_CLIP_OPEN,
        transitionEnd: { clipPath: "none" },
      }}
      transition={{ ...transitions.reveal, delay }}
      style={style}
      {...rest}
    >
      {children}
    </Component>
  );
}
