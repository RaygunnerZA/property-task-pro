import { useRef, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";
import { MOTION_DISTANCE, MOTION_SPRING, MOTION_STAGGER, transitions } from "@/lib/motion/tokens";
import { useFillaReducedMotion, useSequenceEntrance } from "./MotionSequence";

type AlignBlockProps = Omit<HTMLMotionProps<"div">, "initial" | "animate" | "transition" | "children"> & {
  children?: ReactNode;
  step?: number;
  index?: number;
  /** Thread colour class. Teal = connected to existing knowledge. */
  threadClassName?: string;
};

/**
 * ALIGN — information has been connected.
 * A hairline thread draws down the left edge, then the content registers
 * against it (6px slide into place). The thread stays as a quiet mark that this
 * text is Filla's interpretation, linked to the facts above.
 */
export function AlignBlock({
  step = 2,
  index = 0,
  threadClassName = "bg-primary/60",
  className,
  children,
  ...rest
}: AlignBlockProps) {
  const delay = useSequenceEntrance(step, index);
  const animate = delay !== null;

  return (
    <motion.div className={cn("relative pl-3", className)} {...rest}>
      <motion.span
        aria-hidden
        className={cn("absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-full origin-top", threadClassName)}
        initial={animate ? { scaleY: 0 } : false}
        animate={{ scaleY: 1 }}
        transition={{ ...transitions.reveal, delay: delay ?? 0 }}
      />
      <motion.div
        initial={animate ? { opacity: 0, x: -MOTION_DISTANCE.rise } : false}
        animate={{ opacity: 1, x: 0 }}
        transition={{
          ...MOTION_SPRING.paper,
          delay: (delay ?? 0) + MOTION_STAGGER.item,
          opacity: { ...transitions.quick, delay: (delay ?? 0) + MOTION_STAGGER.item },
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Mounted this long after its container: new information rather than initial render. */
const LATE_MOUNT_MS = 150;

/**
 * ALIGN for an element that becomes connected after its surface is on screen
 * (e.g. a fact chip extracted from what the user typed registers into its row).
 *
 * Animates when `connected` turns true, or when it mounts more than 150ms after
 * `since` (its container's mount time). Anything present at first render is still.
 */
export function AlignItem({
  connected = true,
  since,
  as = "div",
  children,
  className,
}: {
  connected?: boolean;
  since?: number;
  as?: "div" | "span";
  children: ReactNode;
  className?: string;
}) {
  const reduced = useFillaReducedMotion();
  const mountedAt = useRef(performance.now()).current;
  const connectedAtMount = useRef(connected).current;
  const lateMount = since !== undefined && mountedAt - since > LATE_MOUNT_MS;
  const animate = !reduced && connected && (lateMount || !connectedAtMount);
  const Component = motion[as] as typeof motion.div;

  return (
    <Component
      key={connected ? "connected" : "open"}
      className={className}
      initial={animate ? { opacity: 0, x: -MOTION_DISTANCE.rise } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...MOTION_SPRING.paper, opacity: transitions.quick }}
    >
      {children}
    </Component>
  );
}
