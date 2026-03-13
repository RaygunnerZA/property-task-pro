/**
 * PropertyScreenLayout - Framework V2 layout wrapper
 * Left: 265px | Middle: max 660px | Right: 1fr (≥1380px only)
 * Uses DualPaneLayout for consistent breakpoints.
 */
import { ReactNode } from "react";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { PageHeader } from "@/components/design-system/PageHeader";

interface PropertyScreenLayoutProps {
  /** Left column content (265px) - e.g. property identity, nav */
  leftColumn: ReactNode;
  /** Middle column content (max 660px) - main content */
  middleColumn: ReactNode;
  /** Right column content (1fr, only ≥1380px) - quick actions */
  rightColumn?: ReactNode;
  /** Optional header spanning left + middle on md, left + middle only on lg */
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
          <div className="w-full max-w-[660px] min-w-0">
            {middleColumn}
          </div>
        }
        thirdColumn={rightColumn}
      />
    </div>
  );
}
