import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPropertyChipIcon } from "@/lib/propertyChipIcons";
import { isAllPropertiesActive } from "@/utils/propertyFilter";
import { getPropertySelectorHighlight } from "@/lib/propertySelectorHighlight";
import {
  isPropertyPinnedDefault,
  recordPropertySelection,
  setPinnedDefaultPropertyId,
} from "@/lib/propertySelectorPreferences";
import { PropertySelectorRow, type PropertySelectorRowProperty } from "@/components/properties/PropertySelectorRow";
import { PropertySelectorAllThumbnail } from "@/components/properties/PropertySelectorAllThumbnail";
import { AddPropertyDialog } from "@/components/properties/AddPropertyDialog";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TooltipProvider } from "@/components/ui/tooltip";

export type PropertySelectorStackProps = {
  properties: PropertySelectorRowProperty[];
  tasks?: Array<{
    property_id?: string | null;
    title?: string | null;
    priority?: string | null;
    status?: string | null;
    due_date?: string | null;
    due_at?: string | null;
    created_at?: string | null;
  }>;
  selectedPropertyIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  onFilterClick?: (filterId: string) => void;
  className?: string;
  /** `gradientHeader` — compact popover trigger for the workbench gradient strip.
   *  `mobileHeader` — same popover UX on plain mobile app header. */
  variant?: "default" | "gradientHeader" | "mobileHeader";
};

export function PropertySelectorStack({
  properties,
  tasks = [],
  selectedPropertyIds,
  onSelectionChange,
  onFilterClick,
  className,
  variant = "default",
}: PropertySelectorStackProps) {
  const { orgId } = useActiveOrg();
  const [expanded, setExpanded] = useState(variant === "default");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [pinnedRevision, setPinnedRevision] = useState(0);

  const allPropertyIds = useMemo(() => properties.map((p) => p.id), [properties]);
  const isAllActive = useMemo(
    () => isAllPropertiesActive(selectedPropertyIds, allPropertyIds),
    [selectedPropertyIds, allPropertyIds]
  );

  const singleSelectedId = useMemo(() => {
    if (isAllActive || selectedPropertyIds.size !== 1) return null;
    return Array.from(selectedPropertyIds)[0];
  }, [isAllActive, selectedPropertyIds]);

  const focusedProperty = useMemo(() => {
    if (!singleSelectedId) return null;
    return properties.find((p) => p.id === singleSelectedId) ?? null;
  }, [properties, singleSelectedId]);

  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    properties.forEach((p) => {
      counts[p.id] = p.open_tasks_count ?? 0;
    });
    return counts;
  }, [properties]);

  const urgentTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((task) => {
      if (
        task.property_id &&
        (task.priority === "urgent" || task.priority === "high") &&
        task.status !== "completed" &&
        task.status !== "archived"
      ) {
        counts[task.property_id] = (counts[task.property_id] || 0) + 1;
      }
    });
    return counts;
  }, [tasks]);

  const isGradientHeader = variant === "gradientHeader";
  const isMobileHeader = variant === "mobileHeader";
  const isCompactPopover = isGradientHeader || isMobileHeader;

  const collapsedHeaderLabel = useMemo(() => {
    if (isAllActive) return "All Properties";
    if (focusedProperty) {
      return focusedProperty.nickname || focusedProperty.address || "Property";
    }
    if (selectedPropertyIds.size > 1) {
      return `${selectedPropertyIds.size} properties`;
    }
    return "Select Property";
  }, [focusedProperty, isAllActive, selectedPropertyIds.size]);

  const showAllThumbnailInHeader = isCompactPopover ? isAllActive : !expanded && isAllActive;
  const collapsedPropertyIcon = useMemo(() => {
    if (!focusedProperty) return null;
    const Icon = getPropertyChipIcon(focusedProperty.icon_name || "home");
    const color = focusedProperty.icon_color_hex || "#8EC9CE";
    return { Icon, color };
  }, [focusedProperty]);

  useEffect(() => {
    if (variant === "default" && singleSelectedId) {
      setExpanded(false);
    }
  }, [singleSelectedId, variant]);

  const handleTogglePinned = useCallback(
    (propertyId: string) => {
      if (!orgId) return;
      const currentlyPinned = isPropertyPinnedDefault(orgId, propertyId);
      setPinnedDefaultPropertyId(orgId, currentlyPinned ? null : propertyId);
      setPinnedRevision((n) => n + 1);
    },
    [orgId]
  );

  if (properties.length <= 1) return null;

  const closeMenu = () => {
    setExpanded(false);
    setPopoverOpen(false);
  };

  const handleSelectProperty = (propertyId: string) => {
    if (orgId) {
      recordPropertySelection(orgId, propertyId);
    }
    onSelectionChange(new Set([propertyId]));
    onFilterClick?.(`filter-property-${propertyId}`);
    closeMenu();
  };

  const handleSelectAll = () => {
    onSelectionChange(new Set(allPropertyIds));
    onFilterClick?.("show-tasks");
    closeMenu();
  };

  const toggleExpanded = () => setExpanded((v) => !v);
  const CollapsedHeaderIcon = collapsedPropertyIcon?.Icon;

  const triggerLabelContent =
    expanded && !isCompactPopover ? (
      <span
        className={cn(
          "truncate text-sm font-semibold",
          isGradientHeader ? "text-white" : "text-foreground"
        )}
      >
        Select Property
      </span>
    ) : showAllThumbnailInHeader ? (
      <>
        <PropertySelectorAllThumbnail properties={properties} size="header" />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm font-semibold",
            isGradientHeader ? "text-white" : "text-foreground"
          )}
        >
          All Properties
        </span>
      </>
    ) : (
      <>
        {CollapsedHeaderIcon && collapsedPropertyIcon ? (
          <CollapsedHeaderIcon
            className="h-4 w-4 shrink-0"
            style={{ color: isGradientHeader ? "white" : collapsedPropertyIcon.color }}
            aria-hidden
          />
        ) : null}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm font-semibold",
            isGradientHeader ? "text-white" : "text-foreground"
          )}
        >
          {collapsedHeaderLabel}
        </span>
      </>
    );

  const propertyListPanel = (
    <>
      <div className="max-h-[min(420px,55vh)] overflow-y-auto overscroll-contain">
        <button
          type="button"
          onClick={handleSelectAll}
          className={cn(
            "flex w-full items-stretch gap-2.5 border-b border-border/40 px-2 py-2.5 text-left transition-colors hover:bg-muted/45",
            isAllActive && "bg-primary/[0.06]"
          )}
        >
          <PropertySelectorAllThumbnail properties={properties} size="row" />
          <span className="flex min-w-0 flex-1 items-center text-sm font-semibold text-foreground">
            All Properties
          </span>
        </button>

        {properties.map((property) => (
          <PropertySelectorRow
            key={property.id}
            property={property}
            taskCount={taskCounts[property.id] ?? 0}
            urgentCount={urgentTaskCounts[property.id] ?? 0}
            highlight={getPropertySelectorHighlight(property.id, tasks, property)}
            isSelected={!isAllActive && selectedPropertyIds.has(property.id)}
            isDefaultPinned={
              orgId ? pinnedRevision >= 0 && isPropertyPinnedDefault(orgId, property.id) : false
            }
            onToggleDefault={() => handleTogglePinned(property.id)}
            onSelect={() => handleSelectProperty(property.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowAddProperty(true)}
        className="flex w-full min-h-[36px] items-center justify-center gap-1.5 border-t border-border/40 px-2 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Add Property
      </button>
    </>
  );

  if (isCompactPopover) {
    return (
      <TooltipProvider delayDuration={200}>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex min-h-[32px] min-w-0 max-w-full items-center gap-1.5 rounded-lg px-1 py-1 text-left transition-colors",
                isGradientHeader
                  ? "hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  : "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              )}
              aria-expanded={popoverOpen}
              aria-label="Select property"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">{triggerLabelContent}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-200",
                  isGradientHeader ? "text-white/90" : "text-muted-foreground",
                  popoverOpen && "rotate-180"
                )}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-[min(92vw,380px)] overflow-hidden rounded-[12px] p-0 shadow-e1"
          >
            {propertyListPanel}
          </PopoverContent>
        </Popover>
        <AddPropertyDialog open={showAddProperty} onOpenChange={setShowAddProperty} />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("w-full min-w-0 max-w-full", className)}>
        <div className="overflow-hidden rounded-[12px] bg-card/60 shadow-e1">
          <div
            className={cn(
              "flex min-h-[44px] items-center gap-0.5 px-1",
              expanded && "border-b border-border/30",
              showAllThumbnailInHeader && "min-h-[48px]"
            )}
          >
            <button
              type="button"
              onClick={toggleExpanded}
              className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/30"
              aria-expanded={expanded}
            >
              {triggerLabelContent}
            </button>

            <button
              type="button"
              onClick={toggleExpanded}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
              aria-label={expanded ? "Collapse property list" : "Expand property list"}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  expanded && "rotate-180"
                )}
              />
            </button>
          </div>

          {expanded ? propertyListPanel : null}
        </div>

        <AddPropertyDialog open={showAddProperty} onOpenChange={setShowAddProperty} />
      </div>
    </TooltipProvider>
  );
}
