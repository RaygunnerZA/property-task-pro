import { useMemo } from "react";
import {
  WorkbenchGradientHeader,
  createGradientHeaderStyle,
} from "@/components/layout/WorkbenchGradientHeader";
import { useRegisterAppChromeHeader } from "@/contexts/AppChromeContext";
import { useAssistantContext } from "@/contexts/AssistantContext";
import { WorkbenchControlsProvider } from "@/contexts/WorkbenchControlsContext";
import { useAppHeaderPropertyScope } from "@/hooks/useAppHeaderPropertyScope";
import { useThemeColor } from "@/hooks/useThemeColor";

type GlobalAppHeaderProps = {
  /** Override gradient accent (e.g. property colour on scoped pages). */
  accentColor?: string;
  /**
   * Hide gradient-header search — use centre-column {@link WorkbenchCentreSearch}
   * on activity-area screens (Reports, Assets, …). Keep search on Home.
   */
  hideSearch?: boolean;
  /**
   * `activity`: secondary-screen chrome — no logo / no header search,
   * [< Back] top-left with the property selector to its right.
   */
  variant?: "workbench" | "activity";
  /** Back handler for the activity variant (defaults to history back). */
  onBack?: () => void;
};

/**
 * Full-bleed logo + gradient + search chrome for StandardPage routes.
 * Matches {@link WorkbenchGradientHeader} used on Home / Tasks / Calendar.
 */
export function GlobalAppHeader({
  accentColor: accentOverride,
  hideSearch = false,
  variant = "workbench",
  onBack,
}: GlobalAppHeaderProps) {
  useRegisterAppChromeHeader();

  const scope = useAppHeaderPropertyScope(accentOverride);
  const headerStyle = useMemo(
    () => createGradientHeaderStyle(scope.accentColor),
    [scope.accentColor]
  );
  useThemeColor(scope.accentColor);

  const { openAssistant, onSendMessage } = useAssistantContext();

  return (
    <WorkbenchControlsProvider defaultPropertyId="all" initialFilters={new Set()}>
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
        onAskFilla={(query) => {
          openAssistant();
          if (query) onSendMessage(query);
        }}
      />
    </WorkbenchControlsProvider>
  );
}
