import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DualPaneLayoutProps {
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  thirdColumn?: ReactNode;
  /** Spans the full main content width (all workbench columns), excluding the app sidebar. */
  header?: ReactNode;
  /**
   * Home mobile: hide centre below md and defer dual-column grid until md
   * so the left rail is full-width on phones without an empty grid track.
   */
  collapseCentreBelowMd?: boolean;
}

/**
 * Dual-Pane Command Centre Layout (single React tree; responsive CSS only).
 *
 * Narrow (< sm): stacked calendar + tasks
 * sm–layout: 330px side rail | tasks (max 700px)
 * layout+: 330px | tasks (700px) [| optional third column — max 330px]
 */
export function DualPaneLayout({
  leftColumn,
  rightColumn,
  thirdColumn,
  header,
  collapseCentreBelowMd = false,
}: DualPaneLayoutProps) {
  const hasThirdColumn = !!thirdColumn;
  const hasHeader = !!header;

  const dualGridFromMd = collapseCentreBelowMd;

  const stickyColClass = cn(
    hasHeader
      ? "sm:sticky sm:top-[var(--header-height)] sm:self-start sm:h-auto sm:px-0 sm:pl-[12px] sm:pr-[12px]"
      : "sm:sticky sm:top-0 sm:self-start sm:h-auto sm:px-0 sm:pl-[12px] sm:pr-[12px]",
    dualGridFromMd ? "md:w-workbench-side-rail" : "sm:w-workbench-side-rail"
  );

  const centreShellClass = cn(
    "min-h-0 min-w-0 w-full max-w-full flex-1 px-1 pb-4",
    dualGridFromMd
      ? "md:flex md:h-full md:max-w-[700px] md:flex-col md:overflow-y-auto md:px-1 md:pb-4"
      : "sm:flex sm:h-full sm:max-w-[700px] sm:flex-col sm:overflow-y-auto sm:px-1 sm:pb-4",
    hasThirdColumn
      ? "layout:min-w-0 layout:overflow-y-auto layout:px-1 layout:pb-5"
      : "layout:max-w-none layout:overflow-y-auto layout:px-1 layout:pb-5",
    collapseCentreBelowMd && "max-md:hidden"
  );

  return (
    <div className="flex min-h-screen w-full min-w-0 flex-col">
      {hasHeader && (
        <div className="w-full shrink-0 max-lg:min-h-[var(--header-height,70px)]">{header}</div>
      )}

      <div
        className={cn(
          "flex min-h-0 w-full min-w-0 flex-1 flex-col pt-[14px]",
          dualGridFromMd
            ? [
                "md:grid md:min-h-0 md:grid-cols-workbench-dual",
                hasThirdColumn
                  ? "layout:grid layout:grid-cols-workbench-triple"
                  : "layout:grid layout:grid-cols-workbench-center-max",
              ]
            : [
                "sm:grid sm:min-h-0 sm:grid-cols-workbench-dual",
                hasThirdColumn
                  ? "layout:grid layout:grid-cols-workbench-triple"
                  : "layout:grid layout:grid-cols-workbench-center-max",
              ]
        )}
      >
        <div
          className={cn(
            "flex w-full min-w-0 max-w-full shrink-0 flex-col gap-3 px-gutter-rail",
            stickyColClass
          )}
        >
          {leftColumn}
        </div>

        <div className={centreShellClass}>{rightColumn}</div>

        {hasThirdColumn && (
          <div className="hidden layout:block layout:min-h-0 layout:min-w-0 layout:w-full layout:max-w-workbench-side-rail layout:overflow-x-hidden layout:overflow-y-auto">
            {thirdColumn}
          </div>
        )}
      </div>
    </div>
  );
}
