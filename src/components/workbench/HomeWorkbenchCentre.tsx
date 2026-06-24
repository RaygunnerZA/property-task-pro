import { CentreWorkbench, type CentreWorkbenchProps } from "@/components/workbench/CentreWorkbench";
import type { IntakeMode } from "@/types/intake";

export interface HomeWorkbenchCentreProps extends Omit<CentreWorkbenchProps, "activeTab" | "onCentreTabChange"> {
  activeTab?: CentreWorkbenchProps["activeTab"];
  onCentreTabChange?: CentreWorkbenchProps["onCentreTabChange"];
  /** @deprecated Use onCentreTabChange */
  onTabChange?: (tab: string) => void;
  onOpenIntake?: (mode: IntakeMode) => void;
}

/**
 * Home centre column — Inflow · Tasks · Calendar work surface.
 */
export function HomeWorkbenchCentre({
  activeTab = "inflow",
  onCentreTabChange,
  onTabChange,
  ...props
}: HomeWorkbenchCentreProps) {
  const handleCentreTabChange = onCentreTabChange ?? ((tab) => onTabChange?.(tab));

  return (
    <CentreWorkbench
      {...props}
      activeTab={activeTab}
      onCentreTabChange={handleCentreTabChange}
    />
  );
}
