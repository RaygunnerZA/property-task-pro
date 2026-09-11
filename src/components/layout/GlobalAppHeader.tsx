import { useMemo, useState } from "react";
import {
  WorkbenchGradientHeader,
  createGradientHeaderStyle,
} from "@/components/layout/WorkbenchGradientHeader";
import { IntakeModal } from "@/components/intake/IntakeModal";
import { useRegisterAppChromeHeader } from "@/contexts/AppChromeContext";
import { useAssistantContext } from "@/contexts/AssistantContext";
import {
  WorkbenchControlsProvider,
  useOptionalWorkbenchControls,
} from "@/contexts/WorkbenchControlsContext";
import { useAppHeaderPropertyScope } from "@/hooks/useAppHeaderPropertyScope";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { IntakeMode } from "@/types/intake";

type GlobalAppHeaderProps = {
  /** Override gradient accent (e.g. property colour on scoped pages). */
  accentColor?: string;
  /**
   * Hide gradient-header search — rare; Property / workspace keep search in the header.
   * Reports / Settings may still opt out when search lives elsewhere.
   */
  hideSearch?: boolean;
  /**
   * `activity`: secondary-screen chrome — [< Back] top-left with the property selector
   * to its right (Reports / Settings depth). Property uses `workbench`.
   */
  variant?: "workbench" | "activity";
  /** Back handler for the activity variant (defaults to history back). */
  onBack?: () => void;
  /** Override intake open — defaults to an in-header IntakeModal. */
  onOpenIntake?: (mode: IntakeMode) => void;
};

function GlobalAppHeaderChrome({
  accentColor: accentOverride,
  hideSearch = false,
  variant = "workbench",
  onBack,
  onOpenIntake: onOpenIntakeProp,
}: GlobalAppHeaderProps) {
  useRegisterAppChromeHeader();

  const scope = useAppHeaderPropertyScope(accentOverride);
  const headerStyle = useMemo(
    () => createGradientHeaderStyle(scope.accentColor),
    [scope.accentColor]
  );
  useThemeColor(scope.accentColor);

  const { openAssistant, onSendMessage } = useAssistantContext();
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("report_issue");

  const openIntake = (mode: IntakeMode) => {
    if (onOpenIntakeProp) {
      onOpenIntakeProp(mode);
      return;
    }
    setIntakeMode(mode);
    setIntakeOpen(true);
  };

  return (
    <>
      <WorkbenchGradientHeader
        headerStyle={headerStyle}
        accentColor={scope.accentColor}
        properties={scope.properties}
        tasks={scope.tasks}
        selectedPropertyIds={scope.selectedPropertyIds}
        onPropertySelectionChange={scope.onPropertySelectionChange}
        hideSearch={hideSearch}
        variant={variant}
        onBack={onBack}
        onOpenIntake={openIntake}
        onAskFilla={(query) => {
          openAssistant();
          if (query) onSendMessage(query);
        }}
      />
      {!onOpenIntakeProp ? (
        <IntakeModal
          open={intakeOpen}
          onOpenChange={setIntakeOpen}
          variant="modal"
          initialIntakeMode={intakeMode}
          defaultPropertyId={
            scope.selectedPropertyIds.size === 1
              ? Array.from(scope.selectedPropertyIds)[0]
              : undefined
          }
        />
      ) : null}
    </>
  );
}

/**
 * Full-bleed logo + gradient + search + Create Task / Add Record chrome.
 * Matches {@link WorkbenchGradientHeader} used on Home / Tasks / Calendar / Property.
 */
export function GlobalAppHeader(props: GlobalAppHeaderProps) {
  const existingControls = useOptionalWorkbenchControls();

  if (existingControls) {
    return <GlobalAppHeaderChrome {...props} />;
  }

  return (
    <WorkbenchControlsProvider defaultPropertyId="all" initialFilters={new Set()}>
      <GlobalAppHeaderChrome {...props} />
    </WorkbenchControlsProvider>
  );
}
