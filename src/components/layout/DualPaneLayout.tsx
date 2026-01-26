import { ReactNode } from "react";

interface DualPaneLayoutProps {
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  thirdColumn?: ReactNode; // Optional third column for task details on desktop
  thirdColumnWidth?: number; // Width of third column in pixels (default: 500px, minimum: 250px)
}

/**
 * Dual-Pane Command Centre Layout (with conditional third column on desktop)
 * 
 * Mobile: Single column stack
 * 
 * Desktop (md+): CSS Grid with 2 columns
 *   - Left: 335px fixed (Calendar + Properties)
 *   - Right: 1fr (Task Tabs) - flexible up to max width
 * 
 * Desktop (lg+): CSS Grid with conditional columns
 *   - Without third column: [335px minmax(450px, 800px)]
 *   - With third column: [335px 799px {thirdColumnWidth}px]
 *   - Left: 335px fixed (Calendar + Properties)
 *   - Middle: Flexible width (Task Tabs)
 *   - Right: Dynamic width (Task Details/Create Task) - only shown when thirdColumn prop provided
 */
export function DualPaneLayout({ leftColumn, rightColumn, thirdColumn, thirdColumnWidth = 500 }: DualPaneLayoutProps) {
  const hasThirdColumn = !!thirdColumn;
  // Ensure minimum width of 250px
  const effectiveWidth = Math.max(250, thirdColumnWidth);

  return (
    <div className="min-h-screen">
      {/* Mobile: Single column stack */}
      <div className="flex flex-col md:hidden w-full min-w-0 max-w-full overflow-x-hidden">
        <div className="w-full min-w-0 max-w-full">{leftColumn}</div>
        <div className="w-full min-w-0 max-w-full">{rightColumn}</div>
      </div>

      {/* Desktop: Two-column layout (md+), shown when screen is md-lg */}
      <div className="hidden md:grid md:grid-cols-[335px_1fr] lg:hidden min-h-screen">
        {/* Left Column: Fixed 335px, sticky on scroll */}
        <div className="h-screen sticky top-0">
          {leftColumn}
        </div>

        {/* Right Column: Dynamic 1fr */}
        <div className="overflow-y-auto min-w-0">
          {rightColumn}
        </div>
      </div>

      {/* Desktop: Conditional three-column layout (lg+) */}
      <div 
        className="hidden lg:grid min-h-screen transition-[grid-template-columns] duration-300 ease-in-out"
        style={{
          gridTemplateColumns: hasThirdColumn 
            ? `335px 799px ${effectiveWidth}px` 
            : '335px minmax(450px, 800px)'
        }}
      >
        {/* Left Column: Fixed 335px, sticky on scroll */}
        <div className="h-screen sticky top-0">
          {leftColumn}
        </div>

        {/* Middle Column: Flexible width (Task Tabs) */}
        <div className="overflow-y-auto border-r border-border min-w-0">
          {rightColumn}
        </div>

        {/* Third Column: Dynamic width (Task Details/Create Task) - only shown when thirdColumn prop provided */}
        {hasThirdColumn && (
          <div className="overflow-y-auto">
            {thirdColumn}
          </div>
        )}
      </div>
    </div>
  );
}

