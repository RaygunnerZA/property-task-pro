/**
 * Compact location strip for Records filing.
 * Areas first; selecting an area reveals its rooms as space-drop targets.
 */

import { useMemo } from "react";
import { SemanticChip } from "@/components/chips/semantic";
import {
  AREA_CHIP_NEUMO_RAISED,
  hexToRgba,
  shortAreaLabel,
  type OnboardingArea,
} from "@/components/onboarding/onboardingPropertyAreas";
import {
  DroppableZone,
  propertyLevelDroppableId,
  spaceDroppableId,
} from "@/components/onboarding/onboardingAreasDnd";
import { shortSpaceLabel } from "@/components/onboarding/onboardingSpaceGroups";
import { cn } from "@/lib/utils";
import type { SpaceLike } from "@/lib/spaces/partitionPropertySpaces";

type RecordsFilingStripProps = {
  areas: OnboardingArea[];
  viewingAreaId: string | null;
  roomsByAreaId: Record<string, SpaceLike[]>;
  unassignedRooms: SpaceLike[];
  rooms: SpaceLike[];
  spaceColorById: Record<string, string>;
  /** Counts of documents linked to each space (optional badge). */
  docCountBySpaceId?: Record<string, number>;
  filingEnabled: boolean;
  onActivateArea: (areaId: string | null) => void;
  onActivateSpace?: (spaceId: string) => void;
  className?: string;
};

export function RecordsFilingStrip({
  areas,
  viewingAreaId,
  roomsByAreaId,
  unassignedRooms,
  rooms,
  spaceColorById,
  docCountBySpaceId = {},
  filingEnabled,
  onActivateArea,
  onActivateSpace,
  className,
}: RecordsFilingStripProps) {
  const viewingArea = useMemo(
    () => areas.find((a) => a.id === viewingAreaId) ?? null,
    [areas, viewingAreaId]
  );

  const placeRooms = viewingArea
    ? roomsByAreaId[viewingArea.id] ?? []
    : areas.length === 0
      ? rooms
      : unassignedRooms;

  if (!filingEnabled) {
    return (
      <div className={cn("rounded-xl bg-card/70 px-3 py-2.5 text-xs text-muted-foreground shadow-e1", className)}>
        Select one property to organise records by space.
      </div>
    );
  }

  const hasPlaces = areas.length > 0 || rooms.length > 0;

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="mb-2 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
          File by location
        </p>
        <p className="mb-2 text-xs text-muted-foreground">
          Drop a document onto a space to file it there. Existing links stay.
        </p>
        <div className="flex flex-wrap gap-[5px]">
          <DroppableZone
            id={propertyLevelDroppableId()}
            className="inline-flex max-w-full shrink-0 align-top"
          >
            <SemanticChip
              epistemic="fact"
              label="Property level"
              color={viewingAreaId === null ? "#8EC9CE" : hexToRgba("#8EC9CE", 0.42)}
              onPress={() => onActivateArea(null)}
              className={cn("!shadow-none", AREA_CHIP_NEUMO_RAISED)}
            />
          </DroppableZone>
          {areas.map((area) => {
            const count = (roomsByAreaId[area.id] ?? []).length;
            const isActive = viewingAreaId === area.id;
            return (
              <SemanticChip
                key={area.id}
                epistemic="fact"
                label={`${shortAreaLabel(area.name).toUpperCase()}${count ? ` · ${count}` : ""}`}
                color={isActive ? area.color : hexToRgba(area.color, 0.42)}
                onPress={() => onActivateArea(isActive ? null : area.id)}
                className={cn("!shadow-none", AREA_CHIP_NEUMO_RAISED)}
              />
            );
          })}
        </div>
      </div>

      {hasPlaces && (viewingArea || areas.length === 0) ? (
        <div>
          <p className="mb-2 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
            {viewingArea
              ? `${viewingArea.name.trim().toUpperCase()} SPACES`
              : "Your spaces"}
          </p>
          <div className="flex min-h-[36px] flex-wrap gap-[5px] rounded-[8px] p-1">
            {placeRooms.length === 0 ? (
              <p className="px-1 py-1.5 text-xs text-muted-foreground">
                {viewingArea
                  ? "No rooms in this area yet. Add rooms on Spaces."
                  : "Add rooms on the Spaces screen, then file documents onto them."}
              </p>
            ) : (
              placeRooms.map((space) => {
                const name = (space.name ?? "").trim() || "Space";
                const color = spaceColorById[space.id] ?? "#8EC9CE";
                const count = docCountBySpaceId[space.id] ?? 0;
                return (
                  <DroppableZone
                    key={space.id}
                    id={spaceDroppableId(space.id)}
                    className="inline-flex max-w-full shrink-0 align-top"
                  >
                    <SemanticChip
                      epistemic="fact"
                      label={`${shortSpaceLabel(name)}${count ? ` · ${count}` : ""}`}
                      color={color}
                      onPress={() => onActivateSpace?.(space.id)}
                      className={cn("!shadow-none", AREA_CHIP_NEUMO_RAISED)}
                    />
                  </DroppableZone>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
