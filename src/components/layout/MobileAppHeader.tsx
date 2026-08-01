import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { PropertySelectorStack } from "@/components/properties/PropertySelectorStack";
import { HeaderAccountMenu } from "@/components/layout/HeaderAccountMenu";
import { MobileHeaderSearchButton } from "@/components/layout/MobileHeaderSearchButton";
import { createGradientHeaderStyle } from "@/components/layout/WorkbenchGradientHeader";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useThemeColor } from "@/hooks/useThemeColor";
import { FILLA_TURQUOISE, resolveHeaderAccentColor } from "@/lib/brandColors";
import { isAllPropertiesActive } from "@/utils/propertyFilter";
import { cn } from "@/lib/utils";

function propertyIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/properties\/([^/]+)/);
  return match?.[1] ?? null;
}

/**
 * Global mobile app header for routes outside the workbench gradient header.
 * Non-property screens: Filla turquoise gradient.
 * `/properties/:id…` screens: that property’s colour (fallback turquoise).
 */
export function MobileAppHeader() {
  const { pathname } = useLocation();
  const { data: properties = [] } = usePropertiesQuery();
  const { data: tasks = [] } = useTasksQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(() => new Set());

  const routePropertyId = propertyIdFromPath(pathname);
  const allPropertyIds = useMemo(() => properties.map((p) => p.id), [properties]);

  useEffect(() => {
    if (properties.length === 0) return;
    if (routePropertyId && allPropertyIds.includes(routePropertyId)) {
      setSelectedPropertyIds(new Set([routePropertyId]));
      return;
    }
    const pid = searchParams.get("property");
    if (pid && allPropertyIds.includes(pid)) {
      setSelectedPropertyIds(new Set([pid]));
      return;
    }
    setSelectedPropertyIds((prev) => (prev.size === 0 ? new Set(allPropertyIds) : prev));
  }, [properties.length, allPropertyIds, searchParams, routePropertyId]);

  const accentColor = useMemo(() => {
    if (routePropertyId) {
      const p = properties.find((x) => x.id === routePropertyId) as
        | { icon_color_hex?: string | null }
        | undefined;
      return resolveHeaderAccentColor(p?.icon_color_hex, { propertyScoped: true });
    }
    return FILLA_TURQUOISE;
  }, [routePropertyId, properties]);

  const headerStyle = useMemo(() => createGradientHeaderStyle(accentColor), [accentColor]);
  useThemeColor(accentColor);

  const handleSelectionChange = (next: Set<string>) => {
    setSelectedPropertyIds(next);
    if (routePropertyId) return;
    const params = new URLSearchParams(searchParams);
    if (isAllPropertiesActive(next, allPropertyIds) || next.size === 0) {
      params.delete("property");
    } else if (next.size === 1) {
      params.set("property", Array.from(next)[0]);
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-12 w-full shrink-0 items-center gap-2 px-3",
        "rounded-bl-xl border-0 shadow-sm md:hidden",
      )}
      style={headerStyle}
    >
      <PropertySelectorStack
        variant="gradientHeader"
        properties={properties}
        tasks={tasks}
        selectedPropertyIds={selectedPropertyIds}
        onSelectionChange={handleSelectionChange}
        className="min-w-0 flex-1"
      />
      <MobileHeaderSearchButton variant="onGradient" accentColor={accentColor} />
      <HeaderAccountMenu variant="onGradient" accentColor={accentColor} />
    </header>
  );
}
