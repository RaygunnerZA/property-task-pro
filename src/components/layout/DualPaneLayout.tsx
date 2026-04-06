import { ReactNode } from "react";

interface DualPaneLayoutProps {
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  thirdColumn?: ReactNode; // Optional third column for task details on desktop
  /** Spans the full main content width (all workbench columns), excluding the app sidebar. */
  header?: ReactNode;
}

/**
 * Dual-Pane Command Centre Layout (with conditional third column on desktop)
 *
 * Mobile: Single column stack
 *
 * Desktop (md+): CSS Grid with 2 columns
 *   - Left: 265px fixed (Calendar + Properties)
 *   - Right: 1fr (Task Tabs) - flexible up to max 652px
 *
 * Desktop (layout / 1380px+): Flex layout with conditional third column
 *   - Without third column: [265px minmax(450px, 660px)]
 *   - With third column: [265px 660px 1fr]
 *
 * When `header` is provided, it spans the full width above the grid; scope/filter rows
 * that belong in the 265px column should be passed inside `leftColumn` instead.
 */
export function DualPaneLayout({ leftColumn, rightColumn, thirdColumn, header }: DualPaneLayoutProps) {
  const hasThirdColumn = !!thirdColumn;
  const hasHeader = !!header;

  const stickyColClass = hasHeader
    ? "h-[calc(100vh-var(--header-height))] sticky top-[var(--header-height)] w-[265px] px-0"
    : "h-screen sticky top-0 w-[265px] px-0";

  return (
    <div className="min-h-screen w-full min-w-0">
      {/* Mobile: Single column stack */}
      <div className="flex flex-col md:hidden w-full min-w-0 max-w-full overflow-x-hidden">
        {header && <div className="w-full">{header}</div>}
        <div className="w-full min-w-0 max-w-full">{leftColumn}</div>
        <div className="w-full min-w-0 max-w-full">{rightColumn}</div>
      </div>

      {/* Desktop: Two-column layout (md+), shown until third-column breakpoint */}
      <div className="hidden md:grid md:grid-cols-[265px_1fr] layout:hidden min-h-screen">
        {/* Header spans both columns on md screens */}
        {header && (
          <div className="col-span-2">
            {header}
          </div>
        )}
        
        {/* Left Column: Fixed 265px, sticky below header */}
        <div className={stickyColClass}>
          {leftColumn}
        </div>

        {/* Right Column: Dynamic 1fr, max 652px */}
        <div className="overflow-y-auto min-w-0 max-w-[652px] pt-3">
          {rightColumn}
        </div>
      </div>

      {/* Desktop: Conditional three-column layout (layout / 1380px+) */}
      <div className="hidden layout:flex layout:flex-col w-full min-w-0 min-h-screen">
        {header && <div className="w-full shrink-0">{header}</div>}

        <div className="flex flex-1 min-h-0 min-w-0 w-full">
          <div
            className={
              hasThirdColumn
                ? "flex w-[925px] shrink-0 flex-col min-h-0 min-w-0"
                : "flex min-h-0 min-w-0 flex-1 flex-col"
            }
          >
            <div
              className={`grid min-h-0 flex-1 ${
                hasThirdColumn
                  ? "grid-cols-[265px_660px]"
                  : "grid-cols-[265px_minmax(450px,_660px)]"
              }`}
            >
              <div className={stickyColClass}>{leftColumn}</div>
              <div className="min-h-0 overflow-y-auto min-w-0 px-gutter-pane pt-3">
                {rightColumn}
              </div>
            </div>
          </div>

          {hasThirdColumn && (
            <div className="min-h-0 flex-1 min-w-0 overflow-y-auto">{thirdColumn}</div>
          )}
        </div>
      </div>
    </div>
  );
}

