import { useRef } from "react";
import type { RefObject } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Premium-style ease: fast start, long smooth settle (similar to iOS / system motion curves). */
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

type IssuesScrollColumnProps<T extends { id: string }> = {
  title: string;
  /** One line under the title — defines what this column is (signals, not tasks). */
  subtitle?: string;
  items: T[];
  emptyTitle: string;
  emptyDescription: string;
  renderCard: (item: T) => React.ReactNode;
  className?: string;
};

/**
 * Vertical scroll panel for Issues feed columns (Recent / Needs Review).
 * Cards ease in smoothly when they enter the column viewport—no scroll-linked distortion.
 */
export function IssuesScrollColumn<T extends { id: string }>({
  title,
  subtitle,
  items,
  emptyTitle,
  emptyDescription,
  renderCard,
  className,
}: IssuesScrollColumnProps<T>) {
  const scrollRootRef = useRef<HTMLDivElement>(null);

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col space-y-2", className)}>
      <div className="shrink-0 space-y-0.5 px-1">
        <p className="text-sm font-semibold tracking-wide text-[rgb(42,41,62)]">{title}</p>
        {subtitle ? <p className="text-[11px] leading-snug text-muted-foreground">{subtitle}</p> : null}
      </div>
      {items.length === 0 ? (
        <div className="space-y-1.5 rounded-xl bg-muted/25 px-3 py-2.5 shadow-sm">
          <p className="text-xs font-medium text-foreground/90">{emptyTitle}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{emptyDescription}</p>
        </div>
      ) : (
        <div
          ref={scrollRootRef}
          className={cn(
            "min-h-0 max-h-[min(52vh,400px)] space-y-2 overflow-y-auto overscroll-y-contain p-0.5",
            "[scrollbar-width:thin]",
            "[&::-webkit-scrollbar]:w-1.5",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&::-webkit-scrollbar-thumb]:bg-border/45",
            "[&::-webkit-scrollbar-track]:bg-transparent"
          )}
        >
          {items.map((item) => (
            <ScrollRevealRow key={item.id} scrollRootRef={scrollRootRef}>
              {renderCard(item)}
            </ScrollRevealRow>
          ))}
        </div>
      )}
    </div>
  );
}

function ScrollRevealRow({
  scrollRootRef,
  children,
}: {
  scrollRootRef: RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const isInView = useInView(rowRef, {
    root: scrollRootRef,
    once: true,
    amount: "some",
    margin: "0px 0px -12% 0px",
  });

  return (
    <motion.div
      ref={rowRef}
      className="min-w-0"
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={
        reduceMotion
          ? { opacity: 1, y: 0 }
          : isInView
            ? { opacity: 1, y: 0 }
            : { opacity: 0, y: 14 }
      }
      transition={
        reduceMotion
          ? { duration: 0.01 }
          : {
              duration: 0.52,
              ease: EASE_OUT,
              opacity: { duration: 0.44, ease: EASE_OUT },
              y: { duration: 0.55, ease: EASE_OUT },
            }
      }
    >
      {children}
    </motion.div>
  );
}
