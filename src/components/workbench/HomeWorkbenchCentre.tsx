import { InflowPanel } from "@/components/workbench/InflowPanel";
import type { MyWorkPanelProps } from "@/components/workbench/MyWorkPanel";
import type { IntakeMode } from "@/types/intake";

export interface HomeWorkbenchCentreProps extends MyWorkPanelProps {
  onOpenIntake?: (mode: IntakeMode) => void;
}

/**
 * Home centre column — standalone Inflow (no Tasks · Calendar · Records strip).
 */
export function HomeWorkbenchCentre({
  onOpenIntake,
  ...props
}: HomeWorkbenchCentreProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-transparent pb-1">
      <div className="box-border max-h-full min-h-0 min-w-0 w-full max-w-[700px] overflow-x-clip overflow-y-auto px-2 pb-4 max-pane:px-2">
        <InflowPanel {...props} onOpenIntake={onOpenIntake} />
      </div>
    </div>
  );
}
