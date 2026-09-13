import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface WorkspaceScopeStripProps {
  children: ReactNode;
  /** Horizontal max width on the inner container (must match page content shell). */
  containerMaxWidthClass?: string;
  className?: string;
}

/**
 * Full-width band under the property gradient header. At `layout` (1280px) the inner
 * grid matches DualPane / workbench-triple so Back + property scope sit in column 1 only.
 */
export function WorkspaceScopeStrip({
  children,
  containerMaxWidthClass = "max-w-[1480px]",
  className,
}: WorkspaceScopeStripProps) {
  return (
    <div
      className={cn(
        "w-full border-b border-border/20 bg-background/80 shadow-sm backdrop-blur-sm",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto min-w-0 px-gutter-page py-2",
          containerMaxWidthClass,
          "grid w-full max-w-full min-w-0 grid-cols-1 gap-6 items-center",
          "layout:grid-cols-workbench-triple layout:gap-x-gutter-rail"
        )}
      >
        <div className="min-w-0 flex justify-start">{children}</div>
      </div>
    </div>
  );
}
