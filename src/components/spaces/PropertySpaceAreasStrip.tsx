/**
 * Areas + room chips strip for the Spaces organisation screen.
 * Mirrors onboarding “Your areas” / “{AREA} SPACES” with persisted UUIDs.
 */

import { useMemo } from "react";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ExpandableSpaceChip } from "@/components/chips/semantic";
import {
  AREA_CHIP_NEUMO_RAISED,
  areaSpacesRowLabel,
  hexToRgba,
  shortAreaLabel,
  type OnboardingArea,
} from "@/components/onboarding/onboardingPropertyAreas";
import {
  SortableItem,
  DroppableZone,
  areaSortableId,
  spaceIdSortableId,
  spacesListDroppableId,
  unassignedSortableId,
  areaDroppableId,
} from "@/components/onboarding/onboardingAreasDnd";
import { ChipCloud } from "@/components/onboarding/ChipCloud";
import { shortSpaceLabel } from "@/components/onboarding/onboardingSpaceGroups";
import { cn } from "@/lib/utils";
import type { SpaceLike } from "@/lib/spaces/partitionPropertySpaces";

type PropertySpaceAreasStripProps = {
  areas: OnboardingArea[];
  activeAreaId: string | null;
  viewingAreaId: string | null;
  roomsByAreaId: Record<string, SpaceLike[]>;
  unassigned: SpaceLike[];
  onActivateArea: (areaId: string) => void;
  onRemoveArea: (areaId: string) => void;
  onRenameArea: (areaId: string) => void;
  onRemoveSpace: (spaceId: string, name: string) => void;
  onRenameSpace: (spaceId: string, name: string) => void;
  onViewSpace: (spaceId: string) => void;
};

export function PropertySpaceAreasStrip({
  areas,
  activeAreaId,
  viewingAreaId,
  roomsByAreaId,
  unassigned,
  onActivateArea,
  onRemoveArea,
  onRenameArea,
  onRemoveSpace,
  onRenameSpace,
  onViewSpace,
}: PropertySpaceAreasStripProps) {
  if (areas.length === 0 && unassigned.length === 0) return null;

  const viewingArea = areas.find((a) => a.id === viewingAreaId) ?? null;
  const viewingRooms = viewingArea ? roomsByAreaId[viewingArea.id] ?? [] : [];

  const sortedUnassigned = useMemo(
    () =>
      [...unassigned].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", undefined, {
          sensitivity: "base",
          numeric: true,
        })
      ),
    [unassigned]
  );

  return (
    <div className="space-y-3">
      {areas.length > 0 ? (
        <div>
          <p className="mb-2 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
            Your areas
          </p>
          <SortableContext
            items={areas.map((a) => areaSortableId(a.id))}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex flex-wrap gap-[5px]">
              {areas.map((area) => {
                const count = (roomsByAreaId[area.id] ?? []).length;
                const isActive = activeAreaId === area.id;
                return (
                  <SortableItem
                    key={area.id}
                    id={areaSortableId(area.id)}
                    data={{ kind: "area", areaId: area.id }}
                  >
                    <DroppableZone
                      id={areaDroppableId(area.id)}
                      className="inline-flex max-w-full shrink-0 align-top"
                    >
                      <ExpandableSpaceChip
                        variant="area"
                        label={`${shortAreaLabel(area.name).toUpperCase()} · ${count}`}
                        color={isActive ? area.color : hexToRgba(area.color, 0.42)}
                        subSpaces={[]}
                        onRemove={() => onRemoveArea(area.id)}
                        onAddSubSpace={() => undefined}
                        onRename={() => onRenameArea(area.id)}
                        onView={() => onActivateArea(area.id)}
                        onPress={() => onActivateArea(area.id)}
                        className={cn("!shadow-none", AREA_CHIP_NEUMO_RAISED)}
                      />
                    </DroppableZone>
                  </SortableItem>
                );
              })}
            </div>
          </SortableContext>
        </div>
      ) : null}

      {viewingArea ? (
        <div>
          <p className="mb-2 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
            {areaSpacesRowLabel(viewingArea.name)}
          </p>
          <DroppableZone id={spacesListDroppableId()}>
            <SortableContext
              items={viewingRooms.map((s) => spaceIdSortableId(viewingArea.id, s.id))}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex min-h-[36px] flex-wrap gap-[5px] rounded-[8px] p-1">
                {viewingRooms.length === 0 ? (
                  <p className="px-1 py-1.5 text-xs text-muted-foreground">
                    Drop spaces here, or pick them from the cards above.
                  </p>
                ) : (
                  viewingRooms.map((space) => {
                    const name = (space.name ?? "").trim() || "Space";
                    return (
                      <SortableItem
                        key={space.id}
                        id={spaceIdSortableId(viewingArea.id, space.id)}
                        data={{
                          kind: "space",
                          spaceName: name,
                          areaId: viewingArea.id,
                          spaceId: space.id,
                        }}
                      >
                        <ExpandableSpaceChip
                          label={shortSpaceLabel(name)}
                          color={viewingArea.color}
                          subSpaces={[]}
                          onRemove={() => onRemoveSpace(space.id, name)}
                          onAddSubSpace={() => undefined}
                          onRename={() => onRenameSpace(space.id, name)}
                          onView={() => onViewSpace(space.id)}
                          onPress={() => onViewSpace(space.id)}
                          className={cn("!shadow-none", AREA_CHIP_NEUMO_RAISED)}
                        />
                      </SortableItem>
                    );
                  })
                )}
              </div>
            </SortableContext>
          </DroppableZone>
        </div>
      ) : null}

      {sortedUnassigned.length > 0 ? (
        <div>
          <p className="mb-2 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
            Unassigned spaces
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            Drag onto an area chip to nest under that area.
          </p>
          <SortableContext
            items={sortedUnassigned.map((s) => unassignedSortableId(s.id))}
            strategy={horizontalListSortingStrategy}
          >
            <ChipCloud
              maxRows={4}
              className="[scrollbar-width:thin] [scrollbar-color:hsl(185_40%_68%_/_0.45)_transparent]"
            >
              {sortedUnassigned.map((space) => {
                const name = (space.name ?? "").trim() || "Space";
                return (
                  <SortableItem
                    key={space.id}
                    id={unassignedSortableId(space.id)}
                    data={{
                      kind: "unassigned",
                      spaceName: name,
                      spaceId: space.id,
                    }}
                  >
                    <ExpandableSpaceChip
                      label={shortSpaceLabel(name)}
                      subSpaces={[]}
                      onRemove={() => onRemoveSpace(space.id, name)}
                      onAddSubSpace={() => undefined}
                      onRename={() => onRenameSpace(space.id, name)}
                      onView={() => onViewSpace(space.id)}
                      onPress={() => onViewSpace(space.id)}
                      className={cn("!shadow-none", AREA_CHIP_NEUMO_RAISED)}
                    />
                  </SortableItem>
                );
              })}
            </ChipCloud>
          </SortableContext>
        </div>
      ) : null}
    </div>
  );
}
