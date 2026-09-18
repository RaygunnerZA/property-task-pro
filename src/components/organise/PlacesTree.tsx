import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DroppableZone,
  areaDroppableId,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Place selection shared by the Spaces / Assets / Records drawers. */
export type PlaceFilter = ExplorerLocationFilter;

export type PlacesTreeProps = {
  areas: OnboardingArea[];
  roomsByAreaId: Record<string, SpaceLike[]>;
  unassignedRooms?: SpaceLike[];
  /** Item count per space id (documents / assets — 0 hides in browse). */
  countBySpaceId: Record<string, number>;
  /** Override area counts (default: sum of the area's room counts). */
  countByAreaId?: Record<string, number>;
  /** Property-level / unassigned bucket. Omit to hide. */
  propertyLevel?: { label: string; count: number; droppable?: boolean } | null;
  selected: PlaceFilter;
  onSelect: (next: PlaceFilter) => void;
  enabled?: boolean;
  disabledMessage?: string;
  /** filing = show all places as drop targets; browse = hide zero-count rooms. */
  mode?: "browse" | "filing";
  /** Which rows accept drops while filing. */
  dropTargets?: "spaces" | "areas" | "none";
  /** Render rooms under areas (Assets / Records). Spaces sets false. */
  showRooms?: boolean;
  browseLabel?: string;
  filingLabel?: string;
  emptyHint?: string;
  onRenameArea?: (areaId: string) => void;
  onRemoveArea?: (areaId: string) => void;
  footer?: ReactNode;
  className?: string;
};

function isPlaceActive(filter: PlaceFilter, candidate: PlaceFilter): boolean {
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

/**
 * Drawer — places tree shared by Spaces, Assets, and Records
 * (shelf–bench–drawer grammar, @Docs/04_UI_System.md). Browse mode filters
 * the bench; filing mode exposes drop targets on the single
 * `onboardingAreasDnd` kit.
 */
export function PlacesTree({
  areas,
  roomsByAreaId,
  unassignedRooms = [],
  countBySpaceId,
  countByAreaId,
  propertyLevel = null,
  selected,
  onSelect,
  enabled = true,
  disabledMessage = "Select one property to organise by place.",
  mode = "browse",
  dropTargets = "spaces",
  showRooms = true,
  browseLabel = "Browse by location",
  filingLabel = "File to location",
  emptyHint = "Add areas and rooms on Spaces to organise by location.",
  onRenameArea,
  onRemoveArea,
  footer,
  className,
}: PlacesTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (areas[0]) initial.add(areas[0].id);
    return initial;
  });
  const [showEmptySpaces, setShowEmptySpaces] = useState(false);

  const areaCounts = useMemo(() => {
    if (countByAreaId) return countByAreaId;
    const map: Record<string, number> = {};
    for (const area of areas) {
      const rooms = roomsByAreaId[area.id] ?? [];
      map[area.id] = rooms.reduce(
        (sum, room) => sum + (countBySpaceId[room.id] ?? 0),
        0
      );
    }
    return map;
  }, [areas, roomsByAreaId, countBySpaceId, countByAreaId]);

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
    return rooms.filter((room) => (countBySpaceId[room.id] ?? 0) > 0);
  };

  const emptyRoomCount = (rooms: SpaceLike[]) =>
    rooms.filter((room) => (countBySpaceId[room.id] ?? 0) === 0).length;

  const rowClass = (active: boolean) =>
    cn(
      "flex w-full items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-left text-xs transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      active
        ? "bg-primary/15 font-medium text-foreground shadow-[inset_0_0_0_1.5px_rgba(142,201,206,0.75)]"
        : "text-foreground/90 hover:bg-card/90"
    );

  const areaMenu = (areaId: string) =>
    onRenameArea || onRemoveArea ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Area options"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[140px]">
          {onRenameArea ? (
            <DropdownMenuItem onSelect={() => onRenameArea(areaId)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Rename area
            </DropdownMenuItem>
          ) : null}
          {onRemoveArea ? (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onRemoveArea(areaId)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Remove area
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  const renderAreaRow = (area: OnboardingArea) => {
    const rooms = roomsByAreaId[area.id] ?? [];
    const areaFilter: PlaceFilter = {
      kind: "area",
      areaId: area.id,
      spaceIds: rooms.map((r) => r.id),
    };
    const active = isPlaceActive(selected, areaFilter);
    const row = (
      <button
        type="button"
        className={cn(rowClass(active), "flex-1")}
        style={
          active
            ? undefined
            : { borderLeft: `3px solid ${hexToRgba(area.color, 0.55)}` }
        }
        onClick={() => {
          setExpanded((prev) => new Set(prev).add(area.id));
          onSelect(active ? { kind: "all" } : areaFilter);
        }}
      >
        <span className="min-w-0 flex-1 truncate">{shortAreaLabel(area.name)}</span>
        <span className="font-mono text-2xs tabular-nums text-muted-foreground">
          {areaCounts[area.id] ?? 0}
        </span>
      </button>
    );
    if (dropTargets === "areas") {
      return (
        <DroppableZone id={areaDroppableId(area.id)} className="min-w-0 flex-1 rounded-[8px]">
          {row}
        </DroppableZone>
      );
    }
    return row;
  };

  const renderRoomRow = (room: SpaceLike) => {
    const name = (room.name ?? "").trim() || "Space";
    const spaceFilter: PlaceFilter = { kind: "space", spaceId: room.id };
    const active = isPlaceActive(selected, spaceFilter);
    const row = (
      <button
        type="button"
        className={rowClass(active)}
        onClick={() => onSelect(active ? { kind: "all" } : spaceFilter)}
      >
        <span className="min-w-0 flex-1 truncate">{shortSpaceLabel(name)}</span>
        <span className="font-mono text-2xs tabular-nums text-muted-foreground">
          {countBySpaceId[room.id] ?? 0}
        </span>
      </button>
    );
    if (dropTargets === "spaces") {
      return (
        <DroppableZone id={spaceDroppableId(room.id)} className="rounded-[8px]">
          {row}
        </DroppableZone>
      );
    }
    return row;
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
          {mode === "filing" ? filingLabel : browseLabel}
        </p>
        {mode === "browse" && enabled && showRooms ? (
          <button
            type="button"
            className="font-mono text-2xs uppercase tracking-wide text-primary hover:underline"
            onClick={() => setShowEmptySpaces((v) => !v)}
          >
            {showEmptySpaces ? "Hide empty" : "Show empty spaces"}
          </button>
        ) : null}
      </div>
      {!enabled ? (
        <p className="rounded-xl bg-card/70 px-3 py-2.5 text-xs text-muted-foreground shadow-e1">
          {disabledMessage}
        </p>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {propertyLevel ? (
            <div>
              <p className="mb-1 px-1 font-mono text-2xs uppercase tracking-wide text-muted-foreground/80">
                Property
              </p>
              {(() => {
                const row = (
                  <button
                    type="button"
                    className={rowClass(
                      isPlaceActive(selected, { kind: "property-level" })
                    )}
                    onClick={() =>
                      onSelect(
                        selected.kind === "property-level"
                          ? { kind: "all" }
                          : { kind: "property-level" }
                      )
                    }
                  >
                    <span className="min-w-0 flex-1 truncate">{propertyLevel.label}</span>
                    <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                      {propertyLevel.count}
                    </span>
                  </button>
                );
                return propertyLevel.droppable ? (
                  <DroppableZone id={propertyLevelDroppableId()} className="rounded-[8px]">
                    {row}
                  </DroppableZone>
                ) : (
                  row
                );
              })()}
            </div>
          ) : null}

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
                return (
                  <li key={area.id}>
                    <div className="flex items-center gap-0.5">
                      {showRooms ? (
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
                      ) : null}
                      {renderAreaRow(area)}
                      {areaMenu(area.id)}
                    </div>
                    {showRooms && isOpen ? (
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
                          shown.map((room) => <li key={room.id}>{renderRoomRow(room)}</li>)
                        )}
                      </ul>
                    ) : null}
                  </li>
                );
              })}

              {showRooms && unassignedRooms.length > 0 ? (
                <li className="pt-1">
                  <p className="mb-1 px-2 font-mono text-2xs uppercase text-muted-foreground/80">
                    Other spaces
                  </p>
                  <ul className="space-y-0.5">
                    {visibleRooms(unassignedRooms).map((room) => (
                      <li key={room.id}>{renderRoomRow(room)}</li>
                    ))}
                  </ul>
                </li>
              ) : null}

              {areas.length === 0 && unassignedRooms.length === 0 ? (
                <li className="px-2 py-2 text-xs text-muted-foreground">{emptyHint}</li>
              ) : null}
            </ul>
          </div>
        </div>
      )}
      {footer ? <div className="mt-3 shrink-0">{footer}</div> : null}
    </div>
  );
}
