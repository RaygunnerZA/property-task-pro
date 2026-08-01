import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { SpaceCard } from "@/components/spaces/SpaceCard";
import { AddSpaceDialog } from "@/components/spaces/AddSpaceDialog";
import { useSpaces } from "@/hooks/useSpaces";
import { useSpacesWithTypes } from "@/hooks/useSpacesWithTypes";
import { useProperty } from "@/hooks/property/useProperty";
import { getSpaceGroupById } from "@/components/onboarding/onboardingSpaceGroups";
import { getSpaceDisplayIllustration } from "@/lib/spaceTypeIllustrations";
import { toSentenceCaseSpaceName } from "@/lib/spaceNameUtils";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SpacesListView = "cards" | "list";

interface PropertySpacesListProps {
  propertyId: string;
  tasks?: any[];
  onSpaceClick?: (spaceId: string) => void;
  selectedSpaceId?: string | null;
  /** When set, filter spaces by this group and use group color for cards */
  groupSlug?: string;
  /** Group color for mini cards (from getSpaceGroupById) */
  groupColor?: string;
  /** When true, omit section title (e.g. when used inside a concertina) */
  headless?: boolean;
  /** Initial layout: horizontal mini-cards or vertical list. */
  defaultView?: SpacesListView;
}

const MAX_RECENT_CARDS = 8;

/**
 * Recent Spaces (default) or Spaces in Group
 * When groupSlug is set: shows spaces filtered by group with group color on cards.
 * Otherwise: shows recently modified/created spaces (max 8).
 */
export function PropertySpacesList({
  propertyId,
  tasks = [],
  onSpaceClick,
  selectedSpaceId,
  groupSlug,
  groupColor,
  headless = false,
  defaultView = "list",
}: PropertySpacesListProps) {
  const navigate = useNavigate();
  const { spaces: spacesAll, loading: loadingAll, refresh: refreshAll } = useSpaces(propertyId);
  const { spaces: spacesFiltered, loading: loadingFiltered, refresh: refreshFiltered } =
    useSpacesWithTypes(propertyId, groupSlug);
  const { property } = useProperty(propertyId);

  const spaces = groupSlug ? spacesFiltered : spacesAll;
  const spacesLoading = groupSlug ? loadingFiltered : loadingAll;
  const refreshSpaces = groupSlug ? refreshFiltered : refreshAll;

  const [showAddSpace, setShowAddSpace] = useState(false);
  const [view, setView] = useState<SpacesListView>(defaultView);
  const spacesRef = useRef<HTMLDivElement>(null);

  const group = groupSlug ? getSpaceGroupById(groupSlug) : undefined;
  const sectionTitle = group ? group.label : "Recent Spaces";

  const spaceTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const urgentCounts: Record<string, number> = {};

    tasks.forEach((task) => {
      if (task.spaces) {
        try {
          const taskSpaces =
            typeof task.spaces === "string" ? JSON.parse(task.spaces) : task.spaces;
          if (Array.isArray(taskSpaces)) {
            taskSpaces.forEach((space: any) => {
              if (space?.id && task.status !== "completed" && task.status !== "archived") {
                counts[space.id] = (counts[space.id] || 0) + 1;
                if (task.priority === "urgent" || task.priority === "high") {
                  urgentCounts[space.id] = (urgentCounts[space.id] || 0) + 1;
                }
              }
            });
          }
        } catch {
          // Skip invalid JSON
        }
      }
    });
    return { counts, urgentCounts };
  }, [tasks]);

  const handleSpaceSelect = (spaceId: string) => {
    onSpaceClick?.(spaceId);
  };

  const handleSpaceOpen = (space: { id: string; property_id?: string | null }) => {
    handleSpaceSelect(space.id);
    if (space.property_id && space.id) {
      navigate(`/properties/${space.property_id}/spaces/${space.id}`);
    } else if (propertyId && space.id) {
      navigate(`/properties/${propertyId}/spaces/${space.id}`);
    }
  };

  const displaySpaces = useMemo(() => {
    const sorted = [...spaces].sort((a, b) => {
      const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
      const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
      return bDate - aDate;
    });
    return groupSlug ? sorted : sorted.slice(0, MAX_RECENT_CARDS);
  }, [spaces, groupSlug]);

  const viewToggle = (
    <div className="flex items-center gap-0.5 rounded-card bg-background/70 p-0.5 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.06)]">
      <button
        type="button"
        onClick={() => setView("cards")}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-[6px] transition-colors",
          view === "cards"
            ? "bg-card text-foreground shadow-e1"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Card view"
        aria-pressed={view === "cards"}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setView("list")}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-[6px] transition-colors",
          view === "list"
            ? "bg-card text-foreground shadow-e1"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="List view"
        aria-pressed={view === "list"}
      >
        <List className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <>
      {!headless && (
        <div className="border-b border-border/40 px-2 pb-3 pt-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">{sectionTitle}</h2>
            <div className="flex items-center gap-1">
              {viewToggle}
              <button
                type="button"
                onClick={() => setShowAddSpace(true)}
                className="rounded-sharp p-1.5 text-sidebar-muted transition-all duration-200 hover:bg-primary/20 hover:text-primary"
                aria-label="Add space"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      <div className={cn("w-full max-w-full overflow-x-hidden px-2 pb-3", headless ? "pt-2" : "pt-[2px]")}>
        {headless && (
          <div className="flex items-center justify-between gap-2 pb-2">
            {viewToggle}
            <button
              type="button"
              onClick={() => setShowAddSpace(true)}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              aria-label="Add space"
            >
              <Plus className="h-3.5 w-3.5" />
              Add space
            </button>
          </div>
        )}
        {spacesLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : displaySpaces.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-muted-foreground">No spaces yet</p>
          </div>
        ) : view === "list" ? (
          <ul className="flex flex-col gap-1.5">
            {displaySpaces.map((space) => {
              const spaceWithTypes = space as {
                space_types?: { default_icon?: string | null; name?: string | null } | null;
                thumbnail_url?: string | null;
              };
              const thumb = getSpaceDisplayIllustration({
                name: space.name,
                thumbnail_url: spaceWithTypes.thumbnail_url,
                spaceTypeName: spaceWithTypes.space_types?.name,
              });
              const taskCount = spaceTaskCounts.counts[space.id] || 0;
              const isSelected = selectedSpaceId === space.id;
              return (
                <li key={space.id}>
                  <button
                    type="button"
                    onClick={() => handleSpaceOpen(space)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-card px-2 py-1.5 text-left transition-shadow",
                      "bg-card/70 shadow-e1 hover:shadow-md",
                      isSelected && "ring-1 ring-primary/60"
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-muted/40">
                      <img src={thumb} alt="" className="h-9 w-9 object-contain" loading="lazy" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {toSentenceCaseSpaceName(space.name)}
                      </span>
                      {taskCount > 0 ? (
                        <span className="text-caption text-muted-foreground">
                          {taskCount} open task{taskCount === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span className="text-caption text-muted-foreground/70">No open tasks</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div ref={spacesRef} className="relative h-[145px] w-full max-w-full overflow-hidden">
            <div
              className="scrollbar-hz-teal -ml-4 h-[145px] min-w-0 overflow-x-auto pl-4 pr-4"
              style={{ width: "calc(100% + 15px)" }}
            >
              <div
                className="flex h-[145px] items-start justify-start gap-2.5 py-[5px]"
                style={{ width: "max-content" }}
              >
                {displaySpaces.map((space) => {
                  const spaceWithTypes = space as {
                    space_types?: { default_icon?: string | null; name?: string | null } | null;
                  };
                  const effectiveIcon =
                    space.icon_name ?? spaceWithTypes?.space_types?.default_icon ?? null;
                  return (
                    <div
                      key={space.id}
                      className="h-[140px] w-[120px] flex-shrink-0 rounded-sharp text-center"
                      onClick={() => handleSpaceSelect(space.id)}
                    >
                      <SpaceCard
                        space={{
                          ...space,
                          name: toSentenceCaseSpaceName(space.name),
                          icon_name: effectiveIcon,
                          spaceTypeName: spaceWithTypes?.space_types?.name ?? null,
                          taskCount: spaceTaskCounts.counts[space.id] || 0,
                          urgentTaskCount: spaceTaskCounts.urgentCounts[space.id] || 0,
                        }}
                        groupColor={groupColor}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div
              className="pointer-events-none absolute bottom-0 right-0 top-0 z-20"
              style={{
                width: "10px",
                height: "147px",
                background: "linear-gradient(to right, transparent, rgba(0, 0, 0, 0.1))",
              }}
              aria-hidden
            />
          </div>
        )}
      </div>

      <AddSpaceDialog
        open={showAddSpace}
        onOpenChange={(open) => {
          setShowAddSpace(open);
          if (!open) {
            refreshSpaces();
          }
        }}
        properties={property ? [property] : []}
        propertyId={propertyId}
      />
    </>
  );
}
