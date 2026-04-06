import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronLeft, Plus } from "lucide-react";
import { getPropertyChipIcon } from "@/lib/propertyChipIcons";
import { isAllPropertiesActive, togglePropertyFilter } from "@/utils/propertyFilter";
import { cn } from "@/lib/utils";
import { AddPropertyDialog } from "@/components/properties/AddPropertyDialog";
import { PanelSectionTitle } from "@/components/ui/panel-section-title";
import { Button } from "@/components/ui/button";

export type PropertyScopeChip = {
  id: string;
  nickname?: string | null;
  address?: string | null;
  icon_name?: string | null;
  icon_color_hex?: string | null;
};

type PrimaryProps = {
  variant: "primary";
  properties: PropertyScopeChip[];
  selectedPropertyIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  onFilterClick?: (filterId: string) => void;
  /** Full-width band under the gradient (secondary pages) vs narrow strip in the 265px workbench column. */
  placement?: "fullWidth" | "leftColumn";
};

type SecondaryProps = {
  variant: "secondary";
  properties: PropertyScopeChip[];
  currentPropertyId: string;
  hrefForProperty: (propertyId: string) => string;
  /** When the user picks “all properties”. */
  hrefForAll: string;
  /** Property workbench hub — property icon (and chip when collapsed) navigate here. */
  propertyHubHref: string;
  /** “Back” row — may differ from hub (e.g. space group → organise). */
  backHref: string;
};

export type PropertyScopeFilterBarProps = PrimaryProps | SecondaryProps;

const LONG_PRESS_MS = 1000;

export function PropertyScopeFilterBar(props: PropertyScopeFilterBarProps) {
  if (props.variant === "primary") {
    return <PropertyScopeFilterBarPrimary {...props} />;
  }
  return <PropertyScopeFilterBarSecondary {...props} />;
}

function PropertyScopeFilterBarPrimary({
  properties,
  selectedPropertyIds,
  onSelectionChange,
  onFilterClick,
  placement = "fullWidth",
}: PrimaryProps) {
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const ALL_PROPERTY_IDS = useMemo(() => properties.map((p) => p.id), [properties]);
  const isAllActive = useMemo(
    () => isAllPropertiesActive(selectedPropertyIds, ALL_PROPERTY_IDS),
    [selectedPropertyIds, ALL_PROPERTY_IDS]
  );
  const isPropertiesHeadingExpanded = properties.length < 2 || isAllActive;

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePropertyPointerDown = (propertyId: string) => {
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setIsMultiSelectMode(true);
      onSelectionChange(new Set([propertyId]));
      onFilterClick?.(`filter-property-${propertyId}`);
    }, LONG_PRESS_MS);
  };

  const handlePropertyClick = (propertyId: string) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    if (isMultiSelectMode) {
      const next = togglePropertyFilter(propertyId, selectedPropertyIds, ALL_PROPERTY_IDS);
      onSelectionChange(next);
      onFilterClick?.(`filter-property-${propertyId}`);
    } else {
      if (selectedPropertyIds.size === 1 && selectedPropertyIds.has(propertyId)) {
        onSelectionChange(new Set(ALL_PROPERTY_IDS));
        onFilterClick?.("show-tasks");
      } else {
        onSelectionChange(new Set([propertyId]));
        onFilterClick?.(`filter-property-${propertyId}`);
      }
    }
  };

  if (properties.length <= 1) return null;

  const isLeftColumn = placement === "leftColumn";

  return (
    <div
      className={cn(
        "w-full max-w-full",
        isLeftColumn
          ? "bg-transparent px-1 py-1.5"
          : "bg-background/80 px-2 py-2 shadow-sm backdrop-blur-sm"
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-0.5",
          isLeftColumn ? "w-full max-w-full" : "max-w-[1480px] mx-auto"
        )}
      >
        <div
          className={cn(
            "overflow-hidden transition-[max-height,opacity,margin-bottom] duration-300 ease-in-out",
            isPropertiesHeadingExpanded
              ? "max-h-[52px] opacity-100 mb-1"
              : "max-h-0 opacity-0 mb-0 pointer-events-none"
          )}
        >
          <div className="flex items-center justify-between px-1">
            <PanelSectionTitle as="h2" className="mb-0">
              {properties.length > 1 && isAllActive ? "All Properties" : "Properties"}
            </PanelSectionTitle>
            <button
              type="button"
              onClick={() => setShowAddProperty(true)}
              className="flex items-center justify-center rounded-[5px] transition-all duration-200 hover:bg-muted/30"
              style={{ width: "20px", height: "35px" }}
              aria-label="Add property"
            >
              <Plus className="h-4 w-[18px] text-muted-foreground" style={{ width: "18px", height: "16px" }} />
            </button>
          </div>
        </div>

        {isMultiSelectMode && (
          <div className="flex items-center justify-between px-1 animate-in fade-in slide-in-from-top-1 duration-150">
            <span className="text-[10px] text-muted-foreground leading-none">Select multiple properties</span>
            {selectedPropertyIds.size >= 2 && (
              <button
                type="button"
                onClick={() => setIsMultiSelectMode(false)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/20 hover:bg-primary/30 transition-colors duration-150"
              >
                <Check className="h-2.5 w-2.5 text-primary" />
                <span className="text-[9px] text-primary font-semibold">Done</span>
              </button>
            )}
          </div>
        )}

        <div
          className="w-full min-w-0 overflow-x-auto overflow-y-hidden no-scrollbar"
          style={{ paddingLeft: "4px", paddingRight: "4px", paddingTop: "3px", paddingBottom: "3px" }}
        >
          <div className="flex h-[32px] w-full min-w-max items-center gap-1 pr-0 mx-0">
            <button
              type="button"
              onClick={() => {
                onSelectionChange(new Set(ALL_PROPERTY_IDS));
                setIsMultiSelectMode(false);
                onFilterClick?.("show-tasks");
              }}
              className="flex items-center justify-center rounded-[10px] p-0 transition-all duration-300 hover:scale-110 active:scale-95 text-[10px] font-mono font-semibold tracking-wide shrink-0"
              style={{
                width: "28px",
                height: "28px",
                backgroundColor: isAllActive ? "#8EC9CE" : "transparent",
                boxShadow: isAllActive
                  ? "2px 2px 5px 0px rgba(0, 0, 0, 0.06), -1px -1px 3px 0px rgba(255, 255, 255, 0.95), inset 1px 1px 2px 0px rgba(255, 255, 255, 1), inset 0px -1px 2px 0px rgba(0, 0, 0, 0.04), 0 0 0 3px rgba(255, 255, 255, 0.75), 0 0 16px 5px rgba(255, 255, 255, 0.55)"
                  : "none",
              }}
              aria-label="Show all properties"
            >
              <span className={isAllActive ? "text-white drop-shadow-sm" : "text-muted-foreground"}>ALL</span>
            </button>

            {properties.map((property) => {
              const iconName = property.icon_name || "home";
              const IconComponent = getPropertyChipIcon(iconName);
              const iconColor = property.icon_color_hex || "#8EC9CE";
              const isPropertyChipActive = isAllActive || selectedPropertyIds.has(property.id);

              return (
                <button
                  key={property.id}
                  type="button"
                  onClick={() => handlePropertyClick(property.id)}
                  onPointerDown={() => handlePropertyPointerDown(property.id)}
                  onPointerUp={cancelLongPress}
                  onPointerLeave={cancelLongPress}
                  className={cn(
                    "flex items-center justify-center rounded-[10px] p-0 transition-all duration-300 hover:scale-110 active:scale-95 shrink-0",
                    isAllActive && "opacity-70 hover:opacity-100"
                  )}
                  style={{
                    width: "28px",
                    height: "28px",
                    backgroundColor: isPropertyChipActive ? iconColor : "transparent",
                    boxShadow: isPropertyChipActive
                      ? isMultiSelectMode
                        ? "2px 2px 4px 0px rgba(0, 0, 0, 0.1), -1px -1px 2px 0px rgba(255, 255, 255, 0.3), inset 1px 1px 1px 0px rgba(255, 255, 255, 1), inset 0px -1px 3px 0px rgba(0, 0, 0, 0.05), 0 0 0 3px white"
                        : "2px 2px 4px 0px rgba(0, 0, 0, 0.1), -1px -1px 2px 0px rgba(255, 255, 255, 0.3), inset 1px 1px 1px 0px rgba(255, 255, 255, 1), inset 0px -1px 3px 0px rgba(0, 0, 0, 0.05)"
                      : "none",
                  }}
                  aria-label={`Filter by ${property.nickname || property.address || property.id}`}
                >
                  <IconComponent
                    className={cn(
                      "h-[18px] w-[16px]",
                      isPropertyChipActive ? "text-white" : "text-muted-foreground"
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <AddPropertyDialog open={showAddProperty} onOpenChange={setShowAddProperty} />
    </div>
  );
}

function PropertyScopeFilterBarSecondary({
  properties,
  currentPropertyId,
  hrefForProperty,
  hrefForAll,
  propertyHubHref,
  backHref,
}: SecondaryProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [draftSelection, setDraftSelection] = useState<Set<string>>(() => new Set([currentPropertyId]));
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const chipPressStartRef = useRef(0);
  const suppressChipClickRef = useRef(false);

  const ALL_IDS = useMemo(() => properties.map((p) => p.id), [properties]);

  useEffect(() => {
    setDraftSelection(new Set([currentPropertyId]));
  }, [currentPropertyId]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onDocClick = (e: MouseEvent) => {
      const el = containerRef.current;
      if (el && !el.contains(e.target as Node)) {
        setExpanded(false);
        setDraftSelection(new Set([currentPropertyId]));
      }
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, [expanded, currentPropertyId]);

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const activeProperty = properties.find((p) => p.id === currentPropertyId);
  const activeIconName = activeProperty?.icon_name || "home";
  const ActiveIcon = getPropertyChipIcon(activeIconName);
  const activeColor = activeProperty?.icon_color_hex?.trim() || "#8EC9CE";

  const applyNavigation = useCallback(
    (next: Set<string>) => {
      if (properties.length === 0) return;
      if (isAllPropertiesActive(next, ALL_IDS)) {
        navigate(hrefForAll);
        return;
      }
      if (next.size === 1) {
        const only = Array.from(next)[0];
        navigate(hrefForProperty(only));
        return;
      }
      const first = Array.from(next)[0];
      navigate(hrefForProperty(first));
    },
    [ALL_IDS, hrefForAll, hrefForProperty, navigate, properties.length]
  );

  const handleApply = () => {
    applyNavigation(draftSelection);
    setExpanded(false);
  };

  const onActivePointerDown = () => {
    if (properties.length <= 1) return;
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setDraftSelection(new Set([currentPropertyId]));
      setExpanded(true);
    }, LONG_PRESS_MS);
  };

  const toggleDraft = (id: string) => {
    setDraftSelection((prev) => togglePropertyFilter(id, prev, ALL_IDS));
  };

  if (properties.length <= 1) {
    return (
      <div className="flex w-full min-w-0 items-center justify-start gap-0.5">
        <Link
          to={propertyHubHref}
          className="flex items-center justify-center rounded-[10px] shrink-0 outline-none ring-offset-2 ring-offset-background transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-primary/35"
          style={{
            width: 28,
            height: 28,
            backgroundColor: activeColor,
            boxShadow:
              "2px 2px 4px 0px rgba(0, 0, 0, 0.1), -1px -1px 2px 0px rgba(255, 255, 255, 0.3), inset 1px 1px 1px 0px rgba(255, 255, 255, 1)",
          }}
          aria-label="Open property hub"
        >
          <ActiveIcon className="h-[18px] w-[16px] text-white" />
        </Link>
        <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-px text-foreground" asChild>
          <Link to={backHref}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex w-full min-w-0 items-center justify-start gap-0.5">
      <div
        className={cn(
          "relative flex items-center gap-1.5 overflow-hidden rounded-xl transition-[max-width] duration-300 ease-out",
          expanded ? "max-w-[min(92vw,520px)] shadow-md px-1.5 py-1 bg-card/95" : "max-w-[28px] shadow-none px-0 py-0 bg-transparent"
        )}
      >
        <div
          className={cn(
            "flex flex-row items-center gap-0 transition-transform duration-300 ease-out",
            expanded ? "translate-x-0" : "translate-x-[calc(100%-28px)]"
          )}
        >
          <button
            type="button"
            onClick={() => {
              setDraftSelection(new Set(ALL_IDS));
            }}
            className={cn(
              "flex items-center justify-center rounded-[10px] shrink-0 text-[10px] font-mono font-semibold tracking-wide transition-opacity duration-200",
              expanded ? "opacity-100 w-[28px] h-[28px]" : "opacity-0 w-0 h-0 overflow-hidden pointer-events-none"
            )}
            style={{
              backgroundColor: isAllPropertiesActive(draftSelection, ALL_IDS) ? "#8EC9CE" : "transparent",
            }}
            aria-label="Select all properties"
          >
            <span
              className={
                isAllPropertiesActive(draftSelection, ALL_IDS) ? "text-white drop-shadow-sm" : "text-muted-foreground"
              }
            >
              ALL
            </span>
          </button>

          {properties.map((property) => {
            const isCurrent = property.id === currentPropertyId;
            const inDraft = draftSelection.has(property.id);
            const Icon = getPropertyChipIcon(property.icon_name || "home");
            const col = property.icon_color_hex || "#8EC9CE";
            const dimmed = expanded && !isCurrent && !inDraft;

            if (!expanded && !isCurrent) return null;

            return (
              <button
                key={property.id}
                type="button"
                onPointerDown={(e) => {
                  if (expanded) return;
                  if (isCurrent) {
                    chipPressStartRef.current = e.timeStamp;
                    onActivePointerDown();
                  }
                }}
                onPointerUp={(e) => {
                  cancelLongPress();
                  if (expanded || !isCurrent) return;
                  if (longPressTriggeredRef.current) {
                    longPressTriggeredRef.current = false;
                    return;
                  }
                  const elapsed = e.timeStamp - chipPressStartRef.current;
                  if (elapsed >= 0 && elapsed < LONG_PRESS_MS - 50) {
                    suppressChipClickRef.current = true;
                    navigate(propertyHubHref);
                  }
                }}
                onPointerLeave={cancelLongPress}
                onClick={(ev) => {
                  if (suppressChipClickRef.current) {
                    suppressChipClickRef.current = false;
                    ev.preventDefault();
                    ev.stopPropagation();
                    return;
                  }
                  if (longPressTriggeredRef.current) {
                    longPressTriggeredRef.current = false;
                    return;
                  }
                  if (!expanded && isCurrent) {
                    return;
                  }
                  if (!expanded) return;
                  toggleDraft(property.id);
                }}
                onKeyDown={(e) => {
                  if (!expanded && isCurrent && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    navigate(propertyHubHref);
                  }
                }}
                className={cn(
                  "flex items-center justify-center rounded-[10px] shrink-0 w-[28px] h-[28px] transition-all duration-200",
                  dimmed && "opacity-45",
                  !expanded && isCurrent && "ring-2 ring-amber-300/90 ring-offset-2 ring-offset-background"
                )}
                style={{
                  backgroundColor: inDraft || (!expanded && isCurrent) ? col : "transparent",
                  boxShadow:
                    inDraft || (!expanded && isCurrent)
                      ? "2px 2px 4px 0px rgba(0, 0, 0, 0.1), inset 1px 1px 1px 0px rgba(255, 255, 255, 0.35)"
                      : "none",
                }}
                aria-label={property.nickname || property.address || property.id}
                aria-pressed={inDraft}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[16px]",
                    inDraft || (!expanded && isCurrent) ? "text-white" : "text-muted-foreground"
                  )}
                />
              </button>
            );
          })}

          {expanded && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 px-2.5 text-[11px] font-semibold ml-1 shrink-0 shadow-sm"
              onClick={handleApply}
            >
              Apply
            </Button>
          )}
        </div>
      </div>

      {!expanded && (
        <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-px text-foreground" asChild>
          <Link to={backHref}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      )}
    </div>
  );
}
