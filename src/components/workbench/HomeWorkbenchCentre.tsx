import { MyWorkPanel, type MyWorkPanelProps } from "@/components/workbench/MyWorkPanel";
import type { IntakeMode } from "@/types/intake";

export interface HomeWorkbenchCentreProps extends MyWorkPanelProps {
  onTabChange?: (tab: string) => void;
  onOpenIntake?: (mode: IntakeMode) => void;
}

/**
 * Attention workbench centre — Needs review, Open work, Signals.
 */
export function HomeWorkbenchCentre({
  onOpenIntake,
  onTabChange,
  ...myWorkProps
}: HomeWorkbenchCentreProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent pt-2 pb-1">
      <MyWorkPanel
        {...myWorkProps}
        onOpenIntake={onOpenIntake}
        onTabChange={onTabChange}
      />
    </div>
  );
}
