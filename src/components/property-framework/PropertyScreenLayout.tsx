/**
 * PropertyScreenLayout - Framework V2 layout wrapper
 * Left: ~330px | Middle: max 700px | Right: max 330px (≥1480px only)
 * Uses DualPaneLayout for consistent breakpoints.
 */
import { ReactNode } from "react";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { PageHeader } from "@/components/design-system/PageHeader";

interface PropertyScreenLayoutProps {
  /** Left column content (~330px side rail) - e.g. property identity, nav */
  leftColumn: ReactNode;
  /** Middle column content (max 700px) - main content */
  middleColumn: ReactNode;
  /** Right column content (max 330px, only ≥1480px) - quick actions */
  rightColumn?: ReactNode;
  /** Optional header spanning the full workbench width (above left, middle, and right columns). */
  header?: ReactNode;
}

export function PropertyScreenLayout({
  leftColumn,
  middleColumn,
  rightColumn,
  header,
}: PropertyScreenLayoutProps) {
  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-hidden">
      <DualPaneLayout
        header={header}
        leftColumn={leftColumn}
        rightColumn={
          <div className="w-full max-w-[700px] min-w-0">
            {middleColumn}
          </div>
        }
        thirdColumn={rightColumn}
      />
    </div>
  );
}
