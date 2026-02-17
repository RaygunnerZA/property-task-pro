/**
 * Horizontal strip of mini space cards for a space group.
 * Used at top of second column on Space Group screens.
 */
import { useMemo } from "react";
import { SpaceCard } from "@/components/spaces/SpaceCard";
import { useSpacesWithTypes } from "@/hooks/useSpacesWithTypes";
import { Skeleton } from "@/components/ui/skeleton";

interface SpaceGroupMiniCardsStripProps {
  propertyId: string;
  groupSlug: string;
  groupColor: string;
  tasks?: any[];
  onSpaceClick?: (spaceId: string) => void;
  selectedSpaceId?: string | null;
}

export function SpaceGroupMiniCardsStrip({
  propertyId,
  groupSlug,
  groupColor,
  tasks = [],
  onSpaceClick,
  selectedSpaceId,
}: SpaceGroupMiniCardsStripProps) {
  const { spaces, loading } = useSpacesWithTypes(propertyId, groupSlug);

  const spaceTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const urgentCounts: Record<string, number> = {};
    tasks.forEach((task) => {
      if (task.spaces) {
        try {
          const taskSpaces = typeof task.spaces === "string" ? JSON.parse(task.spaces) : task.spaces;
          if (Array.isArray(taskSpaces)) {
            taskSpaces.forEach((space: { id?: string }) => {
              if (space?.id && task.status !== "completed" && task.status !== "archived") {
                counts[space.id] = (counts[space.id] || 0) + 1;
                if (task.priority === "urgent" || task.priority === "high") {
                  urgentCounts[space.id] = (urgentCounts[space.id] || 0) + 1;
                }
              }
            });
          }
        } catch {
          // skip
        }
      }
    });
    return { counts, urgentCounts };
  }, [tasks]);

  const displaySpaces = useMemo(() => {
    return [...spaces].sort((a, b) => {
      const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
      const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
      return bDate - aDate;
    });
  }, [spaces]);

  if (loading) {
    return (
      <div className="mb-4 flex gap-2.5 overflow-hidden">
        <Skeleton className="h-[155px] w-[120px] flex-shrink-0 rounded-[8px]" />
        <Skeleton className="h-[155px] w-[120px] flex-shrink-0 rounded-[8px]" />
        <Skeleton className="h-[155px] w-[120px] flex-shrink-0 rounded-[8px]" />
      </div>
    );
  }

  if (displaySpaces.length === 0) {
    return (
      <div className="mb-4 py-6 text-center">
        <p className="text-xs text-muted-foreground">No spaces in this group yet</p>
      </div>
    );
  }

  return (
    <div className="mb-4 flex-shrink-0 w-full min-w-0">
      <div className="overflow-x-auto -mx-[15px] px-[15px] pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        <div className="flex gap-2.5 h-[165px]" style={{ width: "max-content" }}>
          {displaySpaces.map((space) => {
            const spaceWithTypes = space as { space_types?: { default_icon?: string | null } | null };
            const effectiveIcon = space.icon_name ?? spaceWithTypes?.space_types?.default_icon ?? null;
            return (
              <div
                key={space.id}
                className="w-[120px] flex-shrink-0 rounded-[5px]"
                onClick={() => onSpaceClick?.(space.id)}
              >
                <SpaceCard
                  space={{
                    ...space,
                    icon_name: effectiveIcon,
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
    </div>
  );
}
