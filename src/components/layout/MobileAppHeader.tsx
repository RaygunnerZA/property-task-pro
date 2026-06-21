import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PropertySelectorStack } from "@/components/properties/PropertySelectorStack";
import { HeaderAccountMenu } from "@/components/layout/HeaderAccountMenu";
import { MobileHeaderSearchButton } from "@/components/layout/MobileHeaderSearchButton";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { isAllPropertiesActive } from "@/utils/propertyFilter";

/**
 * Global mobile app header for routes outside the workbench gradient header.
 * Property selector (left) · search + profile avatar (right).
 */
export function MobileAppHeader() {
  const { data: properties = [] } = usePropertiesQuery();
  const { data: tasks = [] } = useTasksQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(() => new Set());

  const allPropertyIds = useMemo(() => properties.map((p) => p.id), [properties]);

  useEffect(() => {
    if (properties.length === 0) return;
    const pid = searchParams.get("property");
    if (pid && allPropertyIds.includes(pid)) {
      setSelectedPropertyIds(new Set([pid]));
      return;
    }
    setSelectedPropertyIds((prev) => (prev.size === 0 ? new Set(allPropertyIds) : prev));
  }, [properties.length, allPropertyIds, searchParams]);

  const handleSelectionChange = (next: Set<string>) => {
    setSelectedPropertyIds(next);
    const params = new URLSearchParams(searchParams);
    if (isAllPropertiesActive(next, allPropertyIds) || next.size === 0) {
      params.delete("property");
    } else if (next.size === 1) {
      params.set("property", Array.from(next)[0]);
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 flex h-12 w-full shrink-0 items-center gap-2 border-b border-border/20 bg-background/90 px-3 shadow-sm backdrop-blur-sm lg:hidden">
      <PropertySelectorStack
        variant="mobileHeader"
        properties={properties}
        tasks={tasks}
        selectedPropertyIds={selectedPropertyIds}
        onSelectionChange={handleSelectionChange}
        className="min-w-0 flex-1"
      />
      <MobileHeaderSearchButton />
      <HeaderAccountMenu />
    </header>
  );
}
