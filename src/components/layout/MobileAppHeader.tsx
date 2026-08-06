import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PropertySelectorStack } from "@/components/properties/PropertySelectorStack";
import { HeaderAccountMenu } from "@/components/layout/HeaderAccountMenu";
import { MobileHeaderSearchButton } from "@/components/layout/MobileHeaderSearchButton";
import { createGradientHeaderStyle } from "@/components/layout/WorkbenchGradientHeader";
import { useAppHeaderPropertyScope } from "@/hooks/useAppHeaderPropertyScope";
import { useThemeColor } from "@/hooks/useThemeColor";
import fillaDarkLogo from "@/assets/filla-dark.png";
import { cn } from "@/lib/utils";

/**
 * Fallback mobile app header for routes that do not render GlobalAppHeader /
 * WorkbenchGradientHeader. Logo + gradient + search match the workbench chrome.
 */
export function MobileAppHeader() {
  const scope = useAppHeaderPropertyScope();
  const headerStyle = useMemo(
    () => createGradientHeaderStyle(scope.accentColor),
    [scope.accentColor]
  );
  useThemeColor(scope.accentColor);

  const showPropertySelector = scope.properties.length > 1;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-12 w-full shrink-0 items-center gap-2 px-3",
        "rounded-bl-xl border-0 shadow-sm md:hidden",
      )}
      style={headerStyle}
    >
      <Link
        to="/"
        className="flex shrink-0 items-center outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        aria-label="Go to home"
      >
        <img src={fillaDarkLogo} alt="Filla" className="ml-0.5 h-[28px] w-auto" />
      </Link>
      {showPropertySelector ? (
        <PropertySelectorStack
          variant="gradientHeader"
          properties={scope.properties}
          tasks={scope.tasks}
          selectedPropertyIds={scope.selectedPropertyIds}
          onSelectionChange={scope.onPropertySelectionChange}
          className="min-w-0 flex-1"
        />
      ) : (
        <div className="min-w-0 flex-1" />
      )}
      <MobileHeaderSearchButton variant="onGradient" accentColor={scope.accentColor} />
      <HeaderAccountMenu variant="onGradient" accentColor={scope.accentColor} />
    </header>
  );
}
