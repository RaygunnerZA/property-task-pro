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
};

/**
 * Full-bleed logo + gradient + search chrome for StandardPage routes.
 * Matches {@link WorkbenchGradientHeader} used on Home / Tasks / Calendar.
 */
export function GlobalAppHeader({ accentColor: accentOverride }: GlobalAppHeaderProps) {
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
        onAskFilla={(query) => {
          openAssistant();
          if (query) onSendMessage(query);
        }}
      />
    </WorkbenchControlsProvider>
  );
}
