import { useState, useMemo, useRef } from "react";
import { SpaceCard } from "@/components/spaces/SpaceCard";
import { AddSpaceDialog } from "@/components/spaces/AddSpaceDialog";
import { useSpaces } from "@/hooks/useSpaces";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PropertySpacesListProps {
  propertyId: string;
  tasks?: any[];
  onSpaceClick?: (spaceId: string) => void;
  selectedSpaceId?: string | null;
}

/**
 * Property Spaces List
 * Mirrors dashboard "Spaces" section exactly
 * Shows spaces for the property with task counts
 */
export function PropertySpacesList({
  propertyId,
  tasks = [],
  onSpaceClick,
  selectedSpaceId,
}: PropertySpacesListProps) {
  const { spaces, loading: spacesLoading, refresh: refreshSpaces } = useSpaces(propertyId);
  const [showAddSpace, setShowAddSpace] = useState(false);
  const spacesRef = useRef<HTMLDivElement>(null);

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

  return (
    <>
      <div className="border-b border-border p-4 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Recent Spaces</h2>
          <button
            onClick={() => setShowAddSpace(true)}
            className="p-1.5 rounded-[5px] hover:bg-primary/20 text-sidebar-muted hover:text-primary transition-all duration-200"
            aria-label="Add space"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="pt-[2px] px-4 pb-4 w-full max-w-full overflow-x-hidden">
        {spacesLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ) : spaces.length === 0 ? (
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
                {spaces.map((space) => (
                  <div 
                    key={space.id} 
                    className="w-[120px] flex-shrink-0 rounded-[5px]"
                    onClick={() => handleSpaceClick(space)}
                  >
                    <SpaceCard
                      space={{
                        ...space,
                        taskCount: spaceTaskCounts.counts[space.id] || 0,
                        urgentTaskCount: spaceTaskCounts.urgentCounts[space.id] || 0,
                      }}
                    />
                  </div>
                ))}
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
        properties={[{ id: propertyId } as any]}
      />
    </>
  );
}

