import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { ExpandableSpaceChip } from "@/components/chips/semantic";
import {
  AREA_CHIP_BASE_CLASS,
  AREA_CHIP_NEUMO_RAISED,
  ONBOARDING_PROPERTY_AREAS,
  hexToRgba,
  shortAreaLabel,
  type OnboardingArea,
} from "./onboardingPropertyAreas";
import {
  SPACE_GROUP_ADD_INPUT_CLASS,
  SPACE_GROUP_ADD_INPUT_SHADOW,
} from "./spaceGroupCardInputStyles";
import { DroppableZone, areaDroppableId } from "./onboardingAreasDnd";
import { ChipCloud } from "./ChipCloud";

const DASHED_LINE_STYLE = {
  height: "1px",
  backgroundImage:
    "repeating-linear-gradient(to right, hsl(var(--border)) 0px, hsl(var(--border)) 4px, transparent 4px, transparent 7px)",
  backgroundSize: "7px 1px",
  backgroundRepeat: "repeat-x" as const,
};

type OnboardingPropertyAreasCardProps = {
  areas: OnboardingArea[];
  activeAreaId: string | null;
  spaceCounts?: Record<string, number>;
  onSelectArea: (name: string, color: string) => void;
  onActivateArea: (areaId: string) => void;
  onRemoveArea?: (areaId: string) => void;
  onRenameArea?: (areaId: string) => void;
  className?: string;
};

/**
 * First carousel card: pick high-level property areas (floors / zones).
 * Selected chips use ExpandableSpaceChip (area variant); active = full colour.
 * Reorder areas via the YOUR AREAS row below the carousel.
 */
export function OnboardingPropertyAreasCard({
  areas,
  activeAreaId,
  spaceCounts = {},
  onSelectArea,
  onActivateArea,
  onRemoveArea,
  onRenameArea,
  className,
}: OnboardingPropertyAreasCardProps) {
  const [customName, setCustomName] = useState("");

  const selectedByKey = useMemo(() => {
    const map = new Map<string, OnboardingArea>();
    for (const a of areas) map.set(a.name.toLowerCase().trim(), a);
    return map;
  }, [areas]);

  const chipNames = useMemo(() => {
    // Keep suggestion order — selecting an area must not jump it to the front.
    const suggestionLabels = ONBOARDING_PROPERTY_AREAS.map((a) => a.label);
    const customSelected = areas
      .filter(
        (a) =>
          !ONBOARDING_PROPERTY_AREAS.some(
            (s) => s.label.toLowerCase() === a.name.toLowerCase().trim()
          )
      )
      .map((a) => a.name);
    return [...suggestionLabels, ...customSelected];
  }, [areas]);

  const handleAddCustom = useCallback(() => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    if (selectedByKey.has(trimmed.toLowerCase())) return;
    const suggestion = ONBOARDING_PROPERTY_AREAS.find(
      (a) => a.label.toLowerCase() === trimmed.toLowerCase()
    );
    onSelectArea(trimmed, suggestion?.color ?? "");
    setCustomName("");
  }, [customName, onSelectArea, selectedByKey]);

  return (
    <div className={cn("relative w-[230px] h-[295px] flex-shrink-0", className)}>
      <div className="relative flex h-full flex-col gap-0 overflow-hidden rounded-card bg-card pb-[3px] shadow-e1">
        <div className="flex min-h-0 flex-1 flex-col gap-0 px-3 pb-2 pt-3">
          <div className="shrink-0 space-y-2">
            <h3 className="text-lg font-semibold leading-tight text-foreground">Property Areas</h3>
            <div className="-ml-1 -mr-1 pt-1" style={DASHED_LINE_STYLE} />
            <p className="text-xs leading-[18px] text-muted-foreground">
              Floors and zones. Pick an area, then add spaces into it.
            </p>
          </div>

          <div
            className={cn(
              "mt-[6px] min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y",
              "[scrollbar-width:thin] [scrollbar-color:hsl(185_40%_68%_/_0.45)_transparent]"
            )}
          >
            <ChipCloud>
            {chipNames.map((name) => {
              const key = name.toLowerCase().trim();
              const selected = selectedByKey.get(key);
              if (selected) {
                const isActive = selected.id === activeAreaId;
                const count = spaceCounts[selected.id] ?? 0;
                return (
                  <DroppableZone key={selected.id} id={areaDroppableId(selected.id)} className="inline-flex max-w-full shrink-0 align-top">
                    <ExpandableSpaceChip
                      variant="area"
                      label={`${shortAreaLabel(name).toUpperCase()}${count ? ` · ${count}` : ""}`}
                      color={
                        isActive ? selected.color : hexToRgba(selected.color, 0.42)
                      }
                      subSpaces={[]}
                      onRemove={() => onRemoveArea?.(selected.id)}
                      onAddSubSpace={() => undefined}
                      onRename={onRenameArea ? () => onRenameArea(selected.id) : undefined}
                      onView={() => onActivateArea(selected.id)}
                      onPress={() => onActivateArea(selected.id)}
                      className={cn("!shadow-none", AREA_CHIP_NEUMO_RAISED)}
                    />
                  </DroppableZone>
                );
              }
              const suggestion = ONBOARDING_PROPERTY_AREAS.find(
                (a) => a.label.toLowerCase() === key
              );
              return (
                <button
                  key={name}
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectArea(name, suggestion?.color ?? "");
                  }}
                  className={cn(
                    AREA_CHIP_BASE_CLASS,
                    "bg-background text-muted-foreground",
                    AREA_CHIP_NEUMO_RAISED,
                    "hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                  )}
                >
                  <span className="truncate max-w-[120px]">
                    {shortAreaLabel(name).toUpperCase()}
                  </span>
                </button>
              );
            })}
            </ChipCloud>
          </div>

          <div className="mt-auto flex w-full shrink-0 items-center gap-1.5 pt-1">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCustom();
                }
              }}
              placeholder="Add area"
              className={cn(SPACE_GROUP_ADD_INPUT_CLASS, "h-[34px]")}
              style={SPACE_GROUP_ADD_INPUT_SHADOW}
            />
            <button
              type="button"
              onClick={handleAddCustom}
              disabled={!customName.trim()}
              className={cn(
                "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[8px] text-white transition-all",
                "disabled:opacity-50",
                AREA_CHIP_NEUMO_RAISED
              )}
              style={{ backgroundColor: "hsl(var(--primary-deep))" }}
              aria-label="Add area"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
