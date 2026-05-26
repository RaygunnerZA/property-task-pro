import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DualPaneLayoutProps {
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  thirdColumn?: ReactNode;
  /** Spans the full main content width (all workbench columns), excluding the app sidebar. */
  header?: ReactNode;
}

/**
 * Dual-Pane Command Centre Layout (single React tree; responsive CSS only).
 *
 * Narrow (< sm): stacked calendar + tasks
 * sm–layout: 265px | tasks (max 652px)
 * layout+: 265px | tasks (660px) [| optional third column]
 */
export function DualPaneLayout({ leftColumn, rightColumn, thirdColumn, header }: DualPaneLayoutProps) {
  const hasThirdColumn = !!thirdColumn;
  const hasHeader = !!header;

  const stickyColClass = hasHeader
    ? "sm:sticky sm:top-[var(--header-height)] sm:h-[calc(100vh-var(--header-height))] sm:w-[265px] sm:px-0 sm:pr-3 sm:max-lg:pl-[12px]"
    : "sm:sticky sm:top-0 sm:h-screen sm:w-[265px] sm:px-0 sm:pr-3 sm:max-lg:pl-[12px]";

  return (
    <div className="flex min-h-screen w-full min-w-0 flex-col">
      {hasHeader && <div className="h-[80px] w-full shrink-0 pt-0">{header}</div>}

      <div
        className={cn(
          "flex min-h-0 w-full min-w-0 flex-1 flex-col",
          "sm:grid sm:min-h-0 sm:grid-cols-[265px_1fr]",
          hasThirdColumn
            ? "layout:flex layout:flex-row layout:items-stretch"
            : "layout:grid layout:grid-cols-[265px_minmax(450px,_660px)]"
        )}
      >
        <div
          className={cn(
            "w-full min-w-0 max-w-full shrink-0 px-gutter-rail",
            stickyColClass,
            hasThirdColumn && "layout:w-[265px] layout:shrink-0"
          )}
        >
          {leftColumn}
        </div>

        <div
          className={cn(
            "min-h-0 min-w-0 w-full max-w-full flex-1 px-1 pb-4",
            "sm:flex sm:h-full sm:max-w-[652px] sm:flex-col sm:overflow-y-auto sm:px-1 sm:pt-0 sm:pb-4",
            hasThirdColumn
              ? "layout:w-[660px] layout:max-w-[660px] layout:shrink-0 layout:overflow-y-auto layout:px-1 layout:pt-4 layout:pb-5"
              : "layout:max-w-none layout:overflow-y-auto layout:px-1 layout:pt-4 layout:pb-5"
          )}
        >
          {rightColumn}
        </div>

        {hasThirdColumn && (
          <div className="hidden layout:flex layout:min-h-0 layout:min-w-0 layout:flex-1 layout:overflow-y-auto">
            {thirdColumn}
          </div>
        )}
      </div>
    </div>
  );
}
