import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DroppableZone,
  propertyLevelDroppableId,
  spaceDroppableId,
} from "@/components/onboarding/onboardingAreasDnd";
import {
  hexToRgba,
  shortAreaLabel,
  type OnboardingArea,
} from "@/components/onboarding/onboardingPropertyAreas";
import { shortSpaceLabel } from "@/components/onboarding/onboardingSpaceGroups";
import type { SpaceLike } from "@/lib/spaces/partitionPropertySpaces";
import type { ExplorerLocationFilter } from "@/lib/records/explorerFilters";

type RecordsLocationTreeProps = {
  areas: OnboardingArea[];
  roomsByAreaId: Record<string, SpaceLike[]>;
  unassignedRooms: SpaceLike[];
  docCountBySpaceId: Record<string, number>;
  propertyLevelCount: number;
  locationFilter: ExplorerLocationFilter;
  onSelectLocation: (next: ExplorerLocationFilter) => void;
  filingEnabled: boolean;
  /** filing = show all spaces for drops; browse = hide zero-count rooms unless expanded. */
  mode?: "browse" | "filing";
  className?: string;
};

function isLocationActive(
  filter: ExplorerLocationFilter,
  candidate: ExplorerLocationFilter
): boolean {
  if (filter.kind !== candidate.kind) return false;
  if (filter.kind === "all" || filter.kind === "property-level") return true;
  if (filter.kind === "space" && candidate.kind === "space") {
    return filter.spaceId === candidate.spaceId;
  }
  if (filter.kind === "area" && candidate.kind === "area") {
    return filter.areaId === candidate.areaId;
  }
  return false;
}

export function RecordsLocationTree({
  areas,
  roomsByAreaId,
  unassignedRooms,
  docCountBySpaceId,
  propertyLevelCount,
  locationFilter,
  onSelectLocation,
  filingEnabled,
  mode = "browse",
  className,
}: RecordsLocationTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (areas[0]) initial.add(areas[0].id);
    return initial;
  });
  const [showEmptySpaces, setShowEmptySpaces] = useState(false);

  const areaCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const area of areas) {
      const rooms = roomsByAreaId[area.id] ?? [];
      map[area.id] = rooms.reduce(
        (sum, room) => sum + (docCountBySpaceId[room.id] ?? 0),
        0
      );
    }
    return map;
  }, [areas, roomsByAreaId, docCountBySpaceId]);

  const toggleArea = (areaId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  };

  const visibleRooms = (rooms: SpaceLike[]) => {
    if (mode === "filing" || showEmptySpaces) return rooms;
    return rooms.filter((room) => (docCountBySpaceId[room.id] ?? 0) > 0);
  };

  const emptyRoomCount = (rooms: SpaceLike[]) =>
    rooms.filter((room) => (docCountBySpaceId[room.id] ?? 0) === 0).length;

  const rowClass = (active: boolean) =>
    cn(
      "flex w-full items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-left text-xs transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      active
        ? "bg-primary/15 font-medium text-foreground shadow-[inset_0_0_0_1.5px_rgba(142,201,206,0.75)]"
        : "text-foreground/90 hover:bg-card/90"
    );

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
          {mode === "filing" ? "File to location" : "Browse by location"}
        </p>
        {mode === "browse" && filingEnabled ? (
          <button
            type="button"
            className="font-mono text-2xs uppercase tracking-wide text-primary hover:underline"
            onClick={() => setShowEmptySpaces((v) => !v)}
          >
            {showEmptySpaces ? "Hide empty" : "Show empty spaces"}
          </button>
        ) : null}
      </div>
      {!filingEnabled ? (
        <p className="rounded-xl bg-card/70 px-3 py-2.5 text-xs text-muted-foreground shadow-e1">
          Select one property to organise records by space.
        </p>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <div>
            <p className="mb-1 px-1 font-mono text-2xs uppercase tracking-wide text-muted-foreground/80">
              Property
            </p>
            <DroppableZone id={propertyLevelDroppableId()} className="rounded-[8px]">
              <button
                type="button"
                className={rowClass(
                  isLocationActive(locationFilter, { kind: "property-level" })
                )}
                onClick={() =>
                  onSelectLocation(
                    locationFilter.kind === "property-level"
                      ? { kind: "all" }
                      : { kind: "property-level" }
                  )
                }
              >
                <span className="min-w-0 flex-1 truncate">Property level</span>
                <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                  {propertyLevelCount}
                </span>
              </button>
            </DroppableZone>
          </div>

          <div>
            <p className="mb-1 px-1 font-mono text-2xs uppercase tracking-wide text-muted-foreground/80">
              Areas
            </p>
            <ul className="space-y-0.5">
              {areas.map((area) => {
                const rooms = roomsByAreaId[area.id] ?? [];
                const shown = visibleRooms(rooms);
                const hiddenEmpty = emptyRoomCount(rooms);
                const isOpen = expanded.has(area.id);
                const areaFilter: ExplorerLocationFilter = {
                  kind: "area",
                  areaId: area.id,
                  spaceIds: rooms.map((r) => r.id),
                };
                return (
                  <li key={area.id}>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Collapse" : "Expand"} ${area.name}`}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-card"
                        onClick={() => toggleArea(area.id)}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        className={cn(
                          rowClass(isLocationActive(locationFilter, areaFilter)),
                          "flex-1"
                        )}
                        style={
                          isLocationActive(locationFilter, areaFilter)
                            ? undefined
                            : { borderLeft: `3px solid ${hexToRgba(area.color, 0.55)}` }
                        }
                        onClick={() => {
                          setExpanded((prev) => new Set(prev).add(area.id));
                          onSelectLocation(
                            isLocationActive(locationFilter, areaFilter)
                              ? { kind: "all" }
                              : areaFilter
                          );
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {shortAreaLabel(area.name)}
                        </span>
                        <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                          {areaCounts[area.id] ?? 0}
                        </span>
                      </button>
                    </div>
                    {isOpen ? (
                      <ul className="ml-7 mt-0.5 space-y-0.5 border-l border-dashed border-border/50 pl-2">
                        {shown.length === 0 ? (
                          <li className="px-2 py-1 text-2xs text-muted-foreground">
                            {rooms.length === 0
                              ? "No rooms yet"
                              : hiddenEmpty > 0
                                ? `${hiddenEmpty} empty — show empty spaces`
                                : "No rooms yet"}
                          </li>
                        ) : (
                          shown.map((room) => {
                            const name = (room.name ?? "").trim() || "Space";
                            const spaceFilter: ExplorerLocationFilter = {
                              kind: "space",
                              spaceId: room.id,
                            };
                            return (
                              <li key={room.id}>
                                <DroppableZone
                                  id={spaceDroppableId(room.id)}
                                  className="rounded-[8px]"
                                >
                                  <button
                                    type="button"
                                    className={rowClass(
                                      isLocationActive(locationFilter, spaceFilter)
                                    )}
                                    onClick={() =>
                                      onSelectLocation(
                                        isLocationActive(locationFilter, spaceFilter)
                                          ? { kind: "all" }
                                          : spaceFilter
                                      )
                                    }
                                  >
                                    <span className="min-w-0 flex-1 truncate">
                                      {shortSpaceLabel(name)}
                                    </span>
                                    <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                                      {docCountBySpaceId[room.id] ?? 0}
                                    </span>
                                  </button>
                                </DroppableZone>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    ) : null}
                  </li>
                );
              })}

              {unassignedRooms.length > 0 ? (
                <li className="pt-1">
                  <p className="mb-1 px-2 font-mono text-2xs uppercase text-muted-foreground/80">
                    Other spaces
                  </p>
                  <ul className="space-y-0.5">
                    {visibleRooms(unassignedRooms).map((room) => {
                      const name = (room.name ?? "").trim() || "Space";
                      const spaceFilter: ExplorerLocationFilter = {
                        kind: "space",
                        spaceId: room.id,
                      };
                      return (
                        <li key={room.id}>
                          <DroppableZone
                            id={spaceDroppableId(room.id)}
                            className="rounded-[8px]"
                          >
                            <button
                              type="button"
                              className={rowClass(
                                isLocationActive(locationFilter, spaceFilter)
                              )}
                              onClick={() =>
                                onSelectLocation(
                                  isLocationActive(locationFilter, spaceFilter)
                                    ? { kind: "all" }
                                    : spaceFilter
                                )
                              }
                            >
                              <span className="min-w-0 flex-1 truncate">
                                {shortSpaceLabel(name)}
                              </span>
                              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                                {docCountBySpaceId[room.id] ?? 0}
                              </span>
                            </button>
                          </DroppableZone>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ) : null}

              {areas.length === 0 && unassignedRooms.length === 0 ? (
                <li className="px-2 py-2 text-xs text-muted-foreground">
                  Add areas and rooms on Spaces to file documents by location.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
