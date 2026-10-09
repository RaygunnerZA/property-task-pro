import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type WorkbenchHorizontalScrollerProps = {
  children: ReactNode;
  className?: string;
  /** Gap between items in the row. */
  gapClassName?: string;
};

/**
 * Horizontal scroll strip with right-edge fade (matches Issues open-work task slider).
 */
export function WorkbenchHorizontalScroller({
  children,
  className,
  gapClassName = "gap-3",
}: WorkbenchHorizontalScrollerProps) {
  return (
    <div className={cn("relative", className)}>
      <div className="overflow-x-auto -mx-1 px-1 scrollbar-hz-teal">
        <div className={cn("flex min-w-max pb-0.5", gapClassName)}>{children}</div>
      </div>
      <div
        className="pointer-events-none absolute bottom-0 right-0 top-0 rounded-tr-lg rounded-br-lg"
        style={{
          width: "48px",
          background: "linear-gradient(to right, transparent, rgba(0, 0, 0, 0.12))",
          zIndex: 20,
        }}
        aria-hidden
      />
    </div>
  );
}
