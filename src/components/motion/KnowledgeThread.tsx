import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { MOTION_DISTANCE, MOTION_DURATION, MOTION_SPRING, transitions } from "@/lib/motion/tokens";
import { MotionSequence, useSequenceEntrance } from "./MotionSequence";
import { SheetStack } from "./SheetStack";
import type { KnowledgeNode, KnowledgeNodeKind } from "@/lib/motion/knowledgeNode";

function NodeMarker({ kind }: { kind: KnowledgeNodeKind }) {
  if (kind === "source") {
    return <span className="block h-3 w-2.5 rounded-[2px] bg-card ring-1 ring-muted-foreground/45" />;
  }
  if (kind === "recognised") {
    return <span className="block h-2 w-2 rotate-45 rounded-[1px] border-[1.5px] border-primary-deep" />;
  }
  if (kind === "existing") {
    return <SheetStack />;
  }
  return <span className="block h-2.5 w-2.5 rounded-[3px] bg-primary-deep" />;
}

const PENDING_THREAD =
  "bg-[repeating-linear-gradient(to_bottom,hsl(var(--primary-deep)/0.7)_0_3px,transparent_3px_6px)]";

function ThreadRow({
  node,
  position,
  isLast,
  nextPending,
}: {
  node: KnowledgeNode;
  position: number;
  isLast: boolean;
  nextPending: boolean;
}) {
  const delay = useSequenceEntrance(position);
  const animate = delay !== null;
  const d = delay ?? 0;

  return (
    <li className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2.5 pb-3 last:pb-0">
      <div className="relative flex justify-center pt-[3px]">
        <motion.span
          className="relative z-[1] flex h-3 w-4 items-center justify-center"
          initial={animate ? { opacity: 0, scale: 0.6 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...transitions.settle, delay: d }}
        >
          <NodeMarker kind={node.kind} />
        </motion.span>
        {!isLast ? (
          <motion.span
            aria-hidden
            className={cn(
              "absolute left-1/2 top-[18px] -bottom-[3px] w-[1.5px] -translate-x-1/2 origin-top rounded-full",
              nextPending ? PENDING_THREAD : "bg-primary-deep/55"
            )}
            initial={animate ? { scaleY: 0 } : false}
            animate={{ scaleY: 1 }}
            transition={{ ...transitions.reveal, delay: d + MOTION_DURATION.tap }}
          />
        ) : null}
      </div>

      <motion.div
        className="min-w-0"
        initial={animate ? { opacity: 0, x: -MOTION_DISTANCE.rise } : false}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...MOTION_SPRING.paper, delay: d, opacity: { ...transitions.quick, delay: d } }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xs uppercase text-muted-foreground">{node.label}</span>
          {node.pending ? (
            <span className="rounded-sharp bg-muted px-1.5 font-mono text-2xs uppercase text-muted-foreground">
              On save
            </span>
          ) : null}
        </div>
        <p className="text-xs font-medium leading-snug text-foreground">{node.title}</p>
        {node.detail ? (
          <p className="text-caption leading-snug text-muted-foreground">{node.detail}</p>
        ) : null}
      </motion.div>
    </li>
  );
}

/**
 * KNOWLEDGE CONNECTION — fragmented information becoming structured, reusable knowledge.
 * source → recognised → existing property knowledge → what it makes useful.
 * Each node ALIGNs onto a thread that draws down from the previous one; existing
 * knowledge wears the STACK glyph. Connections that need confirmation are dashed
 * and labelled "On save" — motion never shows a link as made before it is.
 */
export function KnowledgeThread({
  sequenceId,
  nodes,
  className,
  "aria-label": ariaLabel = "How Filla connected this",
}: {
  /** Stable id (e.g. document + asset). The thread draws once per id per session. */
  sequenceId: string;
  nodes: KnowledgeNode[];
  className?: string;
  "aria-label"?: string;
}) {
  if (nodes.length === 0) return null;
  return (
    <MotionSequence id={`knowledge:${sequenceId}`}>
      <ol className={cn("min-w-0", className)} aria-label={ariaLabel}>
        {nodes.map((node, index) => (
          <ThreadRow
            key={node.id}
            node={node}
            position={index}
            isLast={index === nodes.length - 1}
            nextPending={Boolean(nodes[index + 1]?.pending)}
          />
        ))}
      </ol>
    </MotionSequence>
  );
}
