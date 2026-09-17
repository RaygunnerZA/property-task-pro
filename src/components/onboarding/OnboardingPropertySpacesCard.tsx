import { cn } from "@/lib/utils";
import { SemanticChip } from "@/components/chips/semantic";
import {
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Eye } from "lucide-react";
import {
  AREA_CHIP_NEUMO_RAISED,
  hexToRgba,
  shortAreaLabel,
  type OnboardingArea,
} from "./onboardingPropertyAreas";
import { shortSpaceLabel } from "./onboardingSpaceGroups";
import { DroppableZone, spaceDroppableId } from "./onboardingAreasDnd";
import { ChipCloud } from "./ChipCloud";
import type { SpaceLike } from "@/lib/spaces/partitionPropertySpaces";

const DASHED_LINE_STYLE = {
  height: "1px",
  backgroundImage:
    "repeating-linear-gradient(to right, hsl(var(--border)) 0px, hsl(var(--border)) 4px, transparent 4px, transparent 7px)",
  backgroundSize: "7px 1px",
  backgroundRepeat: "repeat-x" as const,
};

const viewItemClassName = cn(
  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5",
  "font-mono text-2xs uppercase tracking-wide",
  "min-h-0 focus:bg-accent"
);

type OnboardingPropertySpacesCardProps = {
  areas: OnboardingArea[];
  rooms: SpaceLike[];
  activeSpaceId: string | null;
  viewingAreaId: string | null;
  assetCounts?: Record<string, number>;
  spaceColorById: Record<string, string>;
  onActivateSpace: (spaceId: string) => void;
  onViewSpace: (spaceId: string) => void;
  className?: string;
};

/**
 * First Assets carousel card: existing rooms (and areas when no rooms).
 * Drop assets onto a space; click to view that space's assets in the strip.
 */
export function OnboardingPropertySpacesCard({
  areas,
  rooms,
  activeSpaceId,
  viewingAreaId,
  assetCounts = {},
  spaceColorById,
  onActivateSpace,
  onViewSpace,
  className,
}: OnboardingPropertySpacesCardProps) {
  const places: Array<{ id: string; name: string; isArea: boolean }> =
    rooms.length > 0
      ? rooms.map((r) => ({
          id: r.id,
          name: (r.name ?? "").trim() || "Space",
          isArea: false,
        }))
      : areas.map((a) => ({ id: a.id, name: a.name, isArea: true }));

  return (
    <div className={cn("relative w-[230px] h-[295px] flex-shrink-0", className)}>
      <div className="relative flex h-full flex-col gap-0 overflow-hidden rounded-card bg-card pb-[3px] shadow-e1">
        <div className="flex min-h-0 flex-1 flex-col gap-0 px-3 pb-2 pt-3">
          <div className="shrink-0 space-y-2">
            <h3 className="text-lg font-semibold leading-tight text-foreground">Spaces</h3>
            <div className="-ml-1 -mr-1 pt-1" style={DASHED_LINE_STYLE} />
            <p className="text-xs leading-[18px] text-muted-foreground">
              Rooms and places. Drop assets onto a space, or pick one to see what is in it.
            </p>
          </div>

          <div
            className={cn(
              "mt-[6px] min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y",
              "[scrollbar-width:thin] [scrollbar-color:hsl(185_40%_68%_/_0.45)_transparent]"
            )}
          >
            {places.length === 0 ? (
              <p className="py-1 text-2xs font-mono uppercase tracking-wider text-muted-foreground/50">
                Add rooms on Spaces first
              </p>
            ) : (
              <ChipCloud>
              {places.map((place) => {
                const isActive = place.id === activeSpaceId;
                const color = spaceColorById[place.id] ?? "#8EC9CE";
                const parentId = rooms.find((r) => r.id === place.id)?.parent_space_id ?? null;
                const inViewingArea =
                  !viewingAreaId || place.isArea || parentId === viewingAreaId;
                const count = assetCounts[place.id] ?? 0;
                const label = place.isArea
                  ? `${shortAreaLabel(place.name).toUpperCase()}${count ? ` · ${count}` : ""}`
                  : `${shortSpaceLabel(place.name)}${count ? ` · ${count}` : ""}`;
                return (
                  <DroppableZone
                    key={place.id}
                    id={spaceDroppableId(place.id)}
                    className="inline-flex max-w-full shrink-0 align-top"
                  >
                    <SemanticChip
                      epistemic="fact"
                      label={label}
                      color={
                        isActive
                          ? color
                          : hexToRgba(color, inViewingArea ? 0.42 : 0.22)
                      }
                      onPress={() => onActivateSpace(place.id)}
                      dropdown
                      dropdownContent={
                        <DropdownMenuItem
                          onSelect={() => onViewSpace(place.id)}
                          className={viewItemClassName}
                        >
                          <Eye className="h-3 w-3 shrink-0" aria-hidden />
                          View
                        </DropdownMenuItem>
                      }
                      className={cn("!shadow-none", AREA_CHIP_NEUMO_RAISED)}
                    />
                  </DroppableZone>
                );
              })}
              </ChipCloud>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
