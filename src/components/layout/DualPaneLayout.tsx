import { ReactNode } from "react";

interface DualPaneLayoutProps {
  leftColumn: ReactNode;
  rightColumn: ReactNode;
}

/**
 * Dual-Pane Command Centre Layout
 * 
 * Desktop (md+): CSS Grid with 2 columns
 *   - Left: 350px fixed (Calendar + Properties)
 *   - Right: 1fr (Task Tabs)
 * 
 * Mobile: Single column stack
 */
export function DualPaneLayout({ leftColumn, rightColumn }: DualPaneLayoutProps) {
  return (
    <div className="min-h-screen">
      {/* Mobile: Single column stack */}
      <div className="flex flex-col md:hidden">
        {leftColumn}
        {rightColumn}
      </div>

      {/* Desktop: Dual-pane grid */}
      <div className="hidden md:grid md:grid-cols-[350px_1fr] min-h-screen">
        {/* Left Column: Fixed 350px, sticky on scroll */}
        <div className="border-r border-border h-screen sticky top-0">
          {leftColumn}
        </div>

        {/* Right Column: Dynamic 1fr */}
        <div className="overflow-y-auto">
          {rightColumn}
        </div>
      </div>
    </div>
  );
}

