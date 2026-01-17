import { ReactNode } from "react";

interface DualPaneLayoutProps {
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  thirdColumn?: ReactNode; // Optional third column for task details on desktop
}

/**
 * Dual-Pane Command Centre Layout (with conditional third column on desktop)
 * 
 * Mobile: Single column stack
 * 
 * Desktop (md+): CSS Grid with 2 columns
 *   - Left: 320px fixed (Calendar + Properties)
 *   - Right: 590px fixed (Task Tabs)
 * 
 * Desktop (lg+): CSS Grid with conditional columns
 *   - Without third column: [320px 590px]
 *   - With third column: [320px 590px 360px]
 *   - Left: 320px fixed (Calendar + Properties)
 *   - Middle: 590px fixed (Task Tabs)
 *   - Right: 360px fixed (Task Details) - only shown when thirdColumn prop provided
 */
export function DualPaneLayout({ leftColumn, rightColumn, thirdColumn }: DualPaneLayoutProps) {
  const hasThirdColumn = !!thirdColumn;

  return (
    <div className="min-h-screen">
      {/* Mobile: Single column stack */}
      <div className="flex flex-col md:hidden w-full min-w-0 max-w-full overflow-x-hidden">
        <div className="w-full min-w-0 max-w-full">{leftColumn}</div>
        <div className="w-full min-w-0 max-w-full">{rightColumn}</div>
      </div>

      {/* Desktop: Two-column layout (md+), shown when screen is md-lg */}
      <div className="hidden md:grid md:grid-cols-[320px_590px] lg:hidden min-h-screen overflow-x-auto">
        {/* Left Column: Fixed 320px, sticky on scroll */}
        <div className="border-r border-border h-screen sticky top-0">
          {leftColumn}
        </div>

        {/* Right Column: Fixed 590px */}
        <div className="overflow-y-auto min-w-0">
          {rightColumn}
        </div>
      </div>

      {/* Desktop: Conditional three-column layout (lg+) */}
      <div 
        className={`hidden lg:grid min-h-screen overflow-x-auto transition-[grid-template-columns] duration-300 ease-in-out ${
          hasThirdColumn 
            ? 'lg:grid-cols-[320px_590px_360px]' 
            : 'lg:grid-cols-[320px_590px]'
        }`}
      >
        {/* Left Column: Fixed 320px, sticky on scroll */}
        <div className="border-r border-border h-screen sticky top-0">
          {leftColumn}
        </div>

        {/* Middle Column: Fixed 590px (Task Tabs) */}
        <div className="overflow-y-auto border-r border-border min-w-0">
          {rightColumn}
        </div>

        {/* Third Column: Fixed 360px (Task Details) - only shown when thirdColumn prop provided */}
        {hasThirdColumn && (
          <div className="overflow-y-auto">
            {thirdColumn}
          </div>
        )}
      </div>
    </div>
  );
}

