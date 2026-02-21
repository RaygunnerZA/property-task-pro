import { ReactNode } from "react";

interface DualPaneLayoutProps {
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  thirdColumn?: ReactNode; // Optional third column for task details on desktop
  header?: ReactNode; // Optional header that spans first two columns only (not third)
}

/**
 * Dual-Pane Command Centre Layout (with conditional third column on desktop)
 * 
 * Mobile: Single column stack
 * 
 * Desktop (md+): CSS Grid with 2 columns
 *   - Left: 245px fixed (Calendar + Properties)
 *   - Right: 1fr (Task Tabs) - flexible up to max 650px
 * 
 * Desktop (min-[1380px]+): Flex layout with conditional third column
 *   - Without third column: [245px minmax(450px, 650px)]
 *   - With third column: [245px 650px 1fr]
 *   - Left: 245px fixed (Calendar + Properties)
 *   - Middle: 650px fixed (Task Tabs)
 *   - Right: 1fr flexible (Task Details) - fills remaining space, extends to top
 * 
 * When header prop is provided on min-[1380px]+ screens:
 *   - Header spans only the first two columns
 *   - Third column always extends to the top of the screen (not blocked by header)
 */
export function DualPaneLayout({ leftColumn, rightColumn, thirdColumn, header }: DualPaneLayoutProps) {
  const hasThirdColumn = !!thirdColumn;
  const hasHeader = !!header;

  const stickyColClass = hasHeader
    ? "h-[calc(100vh-100px)] sticky top-[100px] w-[245px]"
    : "h-screen sticky top-0 w-[245px]";

  return (
    <div className="min-h-screen">
      {/* Mobile: Single column stack */}
      <div className="flex flex-col md:hidden w-full min-w-0 max-w-full overflow-x-hidden">
        {header && <div className="w-full">{header}</div>}
        <div className="w-full min-w-0 max-w-full">{leftColumn}</div>
        <div className="w-full min-w-0 max-w-full">{rightColumn}</div>
      </div>

      {/* Desktop: Two-column layout (md+), shown until third-column breakpoint */}
      <div className="hidden md:grid md:grid-cols-[245px_1fr] min-[1380px]:hidden min-h-screen">
        {/* Header spans both columns on md screens */}
        {header && (
          <div className="col-span-2">
            {header}
          </div>
        )}
        
        {/* Left Column: Fixed 245px, sticky below header */}
        <div className={stickyColClass}>
          {leftColumn}
        </div>

        {/* Right Column: Dynamic 1fr, max 650px */}
        <div className="overflow-y-auto min-w-0 max-w-[650px]">
          {rightColumn}
        </div>
      </div>

      {/* Desktop: Conditional three-column layout (min-[1380px]+) */}
      <div className="hidden min-[1380px]:flex min-h-screen">
        {/* Left side: Header + first two columns */}
        <div className={`flex flex-col ${hasThirdColumn ? 'w-[895px]' : 'flex-1'}`}>
          {/* Header spans first two columns only */}
          {header && header}
          
          {/* Two-column grid for left and middle columns */}
          <div className={`grid flex-1 ${
            hasThirdColumn 
              ? 'grid-cols-[245px_650px]' 
              : 'grid-cols-[245px_minmax(450px,_650px)]'
          }`}>
            {/* Left Column: Fixed 245px, sticky below header */}
            <div className={stickyColClass}>
              {leftColumn}
            </div>

            {/* Middle Column */}
            <div className="overflow-y-auto min-w-0">
              {rightColumn}
            </div>
          </div>
        </div>

        {/* Third Column: Flexible width, top-padded to clear header */}
        {hasThirdColumn && (
          <div className={`overflow-y-auto flex-1 ${hasHeader ? 'pt-[100px]' : ''}`}>
            {thirdColumn}
          </div>
        )}
      </div>
    </div>
  );
}

