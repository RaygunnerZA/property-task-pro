import { useState, useMemo, useRef } from "react";
import { SpaceCard } from "@/components/spaces/SpaceCard";
import { AddSpaceDialog } from "@/components/spaces/AddSpaceDialog";
import { useSpaces } from "@/hooks/useSpaces";
import { useSpacesWithTypes } from "@/hooks/useSpacesWithTypes";
import { useProperty } from "@/hooks/property/useProperty";
import { getSpaceGroupById } from "@/components/onboarding/onboardingSpaceGroups";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PropertySpacesListProps {
  propertyId: string;
  tasks?: any[];
  onSpaceClick?: (spaceId: string) => void;
  selectedSpaceId?: string | null;
  /** When set, filter spaces by this group and use group color for cards */
  groupSlug?: string;
  /** Group color for mini cards (from getSpaceGroupById) */
  groupColor?: string;
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
}: PropertySpacesListProps) {
  const { spaces: spacesAll, loading: loadingAll, refresh: refreshAll } = useSpaces(propertyId);
  const { spaces: spacesFiltered, loading: loadingFiltered, refresh: refreshFiltered } = useSpacesWithTypes(propertyId, groupSlug);
  const { property } = useProperty(propertyId);

  const spaces = groupSlug ? spacesFiltered : spacesAll;
  const spacesLoading = groupSlug ? loadingFiltered : loadingAll;
  const refreshSpaces = groupSlug ? refreshFiltered : refreshAll;

  const [showAddSpace, setShowAddSpace] = useState(false);
  const spacesRef = useRef<HTMLDivElement>(null);

  const group = groupSlug ? getSpaceGroupById(groupSlug) : undefined;
  const sectionTitle = group ? group.label : "Recent Spaces";

  // Calculate task counts per space
  const spaceTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const urgentCounts: Record<string, number> = {};
    
    tasks.forEach((task) => {
      if (task.spaces) {
        try {
          const taskSpaces = typeof task.spaces === 'string' ? JSON.parse(task.spaces) : task.spaces;
          if (Array.isArray(taskSpaces)) {
            taskSpaces.forEach((space: any) => {
              if (space?.id && task.status !== 'completed' && task.status !== 'archived') {
                counts[space.id] = (counts[space.id] || 0) + 1;
                if (task.priority === 'urgent' || task.priority === 'high') {
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

  const handleSpaceClick = (space: any) => {
    if (onSpaceClick) {
      onSpaceClick(space.id);
    }
  };

  // Sort by most recently modified/created. When filtering by group: show all; otherwise limit to 8
  const displaySpaces = useMemo(() => {
    const sorted = [...spaces].sort((a, b) => {
      const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
      const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
      return bDate - aDate;
    });
    return groupSlug ? sorted : sorted.slice(0, MAX_RECENT_CARDS);
  }, [spaces, groupSlug]);

  return (
    <>
      <div className="border-b border-border pt-4 px-2 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{sectionTitle}</h2>
          <button
            onClick={() => setShowAddSpace(true)}
            className="p-1.5 rounded-[5px] hover:bg-primary/20 text-sidebar-muted hover:text-primary transition-all duration-200"
            aria-label="Add space"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="pt-[2px] px-2 pb-4 w-full max-w-full overflow-x-hidden">
        {spacesLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ) : displaySpaces.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-muted-foreground">No spaces yet</p>
          </div>
        ) : (
          <div 
            ref={spacesRef}
            className="relative w-full max-w-full overflow-hidden"
          >
            <div className="overflow-x-auto -ml-4 pl-4 pr-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent min-w-0" style={{ width: 'calc(100% + 15px)' }}>
              <div className="flex gap-2.5 h-[165px]" style={{ width: 'max-content' }}>
                {displaySpaces.map((space) => {
                  const spaceWithTypes = space as { space_types?: { default_icon?: string | null } | null };
                  const effectiveIcon = space.icon_name ?? spaceWithTypes?.space_types?.default_icon ?? null;
                  return (
                    <div 
                      key={space.id} 
                      className="w-[120px] flex-shrink-0 rounded-[5px]"
                      onClick={() => {
                        // #region agent log
                        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6b0bc6'},body:JSON.stringify({sessionId:'6b0bc6',location:'PropertySpacesList.tsx:wrapper',message:'Wrapper div clicked',data:{spaceId:space.id},timestamp:Date.now()})}).catch(()=>{});
                        // #endregion
                        handleSpaceClick(space);
                      }}
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
            {/* Gradient overlay - right side fade, aligned to right edge of mask */}
            <div 
              className="absolute top-0 right-0 bottom-0 pointer-events-none"
              style={{
                width: '10px',
                height: '155px',
                background: 'linear-gradient(to right, transparent, rgba(0, 0, 0, 0.1))',
                zIndex: 20
              }}
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

