import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { FILLA_TURQUOISE, resolveHeaderAccentColor } from "@/lib/brandColors";
import { isAllPropertiesActive } from "@/utils/propertyFilter";

function propertyIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/properties\/([^/]+)/);
  return match?.[1] ?? null;
}

/**
 * Property selection + accent colour for the global / standard gradient header.
 * Mirrors MobileAppHeader URL sync (`?property=` / `/properties/:id`).
 */
export function useAppHeaderPropertyScope(accentOverride?: string) {
  const { pathname } = useLocation();
  const { data: properties = [] } = usePropertiesQuery();
  const { data: tasks = [] } = useTasksQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(
    () => new Set()
  );

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
    setSelectedPropertyIds((prev) =>
      prev.size === 0 ? new Set(allPropertyIds) : prev
    );
  }, [properties.length, allPropertyIds, searchParams, routePropertyId]);

  const accentColor = useMemo(() => {
    if (accentOverride?.trim()) return accentOverride.trim();
    if (routePropertyId) {
      const p = properties.find((x) => x.id === routePropertyId) as
        | { icon_color_hex?: string | null }
        | undefined;
      return resolveHeaderAccentColor(p?.icon_color_hex, { propertyScoped: true });
    }
    return FILLA_TURQUOISE;
  }, [accentOverride, routePropertyId, properties]);

  const handlePropertySelectionChange = (next: Set<string>) => {
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

  return {
    properties,
    tasks,
    selectedPropertyIds,
    onPropertySelectionChange: handlePropertySelectionChange,
    accentColor,
  };
}
