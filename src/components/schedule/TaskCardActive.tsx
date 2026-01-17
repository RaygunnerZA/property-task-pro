import { useMemo, useState } from "react";
import { mapTask } from "@/utils/mapTask";
import { cn } from "@/lib/utils";
import { Home, Building2, Hotel, Warehouse, Store, Castle, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { archiveTask } from "@/services/tasks/taskMutations";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// Property icon mapping
const PROPERTY_ICONS = {
  home: Home,
  building: Building2,
  hotel: Hotel,
  warehouse: Warehouse,
  store: Store,
  castle: Castle,
} as const;

function PropertyIconChip({ property }: { property: any }) {
  if (!property) return null;
  const iconName = property.icon_name || "home";
  const IconComponent = PROPERTY_ICONS[iconName as keyof typeof PROPERTY_ICONS] || Home;
  const iconColor = property.icon_color_hex || "#8EC9CE";
  return (
    <div
      className="inline-flex items-center justify-center rounded-[146px] border-0"
      style={{ backgroundColor: iconColor, width: "24px", height: "24px" }}
    >
      <IconComponent className="h-4 w-4 text-white" />
    </div>
  );
}

function PriorityDot({ priority }: { priority: string | null | undefined }) {
  const p = (priority || "").toLowerCase();
  const cls =
    p === "urgent"
      ? "bg-destructive"
      : p === "high"
        ? "bg-orange-500"
        : p === "low"
          ? "bg-muted-foreground/50"
          : "bg-primary";
  return <span className={cn("absolute left-1 top-1 h-[10px] w-[10px] rounded-full", cls)} />;
}

interface TaskCardActiveProps {
  task: any;
  property?: any;
  onClick?: () => void;
  onDone?: () => void;
  onSnooze?: () => void;
  onDetails?: () => void;
}

/**
 * Active Task Card (Expanded)
 * 
 * The first card in the list is always active by default.
 * Visually prominent and expanded.
 * 
 * Shows:
 * - Image preview (if any)
 * - 2–4 lines of text
 * - Chips: space, team, priority, etc.
 * - Quick actions (Done, Snooze, Details)
 */
export function TaskCardActive({
  task,
  property,
  onClick,
  onDone,
  onSnooze,
  onDetails,
}: TaskCardActiveProps) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isArchiving, setIsArchiving] = useState(false);

  // Memoize task mapping and image parsing
  const { t, imageUrl, themes, spaces, assignedUsers, teams } = useMemo(() => {
    const mappedTask = mapTask(task);
    
    // Get image from images array
    let images: any[] = [];
    if (task?.images) {
      if (typeof task.images === 'string') {
        try {
          images = JSON.parse(task.images);
        } catch {
          images = [];
        }
      } else if (Array.isArray(task.images)) {
        images = task.images;
      }
    }
    
    const firstImage = images.length > 0 ? images[0] : null;
    const url = firstImage?.thumbnail_url || firstImage?.file_url || task?.primary_image_url || task?.image_url || (task as any)?.image_url;
    
    // Parse themes, spaces, and teams
    let themesArray: any[] = [];
    if (task?.themes) {
      if (typeof task.themes === 'string') {
        try {
          themesArray = JSON.parse(task.themes);
        } catch {
          themesArray = [];
        }
      } else if (Array.isArray(task.themes)) {
        themesArray = task.themes;
      }
    }
    
    let spacesArray: any[] = [];
    if (task?.spaces) {
      if (typeof task.spaces === 'string') {
        try {
          spacesArray = JSON.parse(task.spaces);
        } catch {
          spacesArray = [];
        }
      } else if (Array.isArray(task.spaces)) {
        spacesArray = task.spaces;
      }
    }
    
    let teamsArray: any[] = [];
    if (task?.teams) {
      if (typeof task.teams === 'string') {
        try {
          teamsArray = JSON.parse(task.teams);
        } catch {
          teamsArray = [];
        }
      } else if (Array.isArray(task.teams)) {
        teamsArray = task.teams;
      }
    }
    
    return {
      t: mappedTask,
      imageUrl: url,
      themes: themesArray,
      spaces: spacesArray,
      teams: teamsArray,
      assignedUsers: mappedTask.assignedUsers || [],
    };
  }, [task]);

  const iconName = property?.icon_name || "home";
  const IconComponent = PROPERTY_ICONS[iconName as keyof typeof PROPERTY_ICONS] || Home;
  const iconColor = property?.icon_color_hex || "#8EC9CE";

  const priorityColors: Record<string, string> = {
    urgent: "bg-destructive/20 text-destructive border-destructive/30",
    high: "bg-orange-500/20 text-orange-600 border-orange-500/30",
    medium: "bg-primary/20 text-primary border-primary/30",
    low: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-[8px] bg-card shadow-e1 border border-border/50",
        "cursor-pointer transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-[1px]",
        "active:scale-[0.99]"
      )}
    >
      <div className="relative">
        <PriorityDot priority={t.priority} />

        <div className="flex items-stretch">
          {/* Main content */}
          <div className="flex-1 min-w-0 pr-4 pb-4 pl-[25px] pt-[13px]">
            {/* Title */}
            <h3 className="font-semibold text-foreground text-base leading-tight line-clamp-4">
              {t.title || "Untitled Task"}
            </h3>

            {/* Chips Row */}
            <div className="flex flex-wrap gap-2 items-center mt-3">
              {/* Property Icon Chip (matches main task cards) */}
              {property ? <PropertyIconChip property={property} /> : null}

              {/* Priority chip (optional) */}
              {t.priority && (
                <Badge
                  variant="outline"
                  className={cn("text-xs", priorityColors[t.priority] || priorityColors.medium)}
                >
                  {t.priority}
                </Badge>
              )}

              {spaces.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {spaces.length} space{spaces.length !== 1 ? "s" : ""}
                </Badge>
              )}

              {teams.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {teams.length} team{teams.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-border/50 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (onDone) {
                    onDone();
                  } else if (task?.id && orgId && !isArchiving) {
                    setIsArchiving(true);
                    try {
                      await archiveTask(task.id, orgId);
                      toast({
                        title: "Task archived",
                        description: "The task has been archived.",
                      });
                      queryClient.invalidateQueries({ queryKey: ["tasks"] });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to archive task.",
                        variant: "destructive",
                      });
                    } finally {
                      setIsArchiving(false);
                    }
                  }
                }}
                disabled={isArchiving}
                className="w-full sm:flex-1 text-xs"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {isArchiving ? "..." : "Done"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onSnooze?.();
                }}
                className="w-full sm:flex-1 text-xs"
              >
                <Clock className="h-3 w-3 mr-1" />
                Snooze
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onDetails) {
                    onDetails();
                  } else if (onClick) {
                    onClick();
                  }
                }}
                className="w-full sm:flex-1 text-xs"
              >
                Details
              </Button>
            </div>
          </div>

          {/* Right thumbnail (full height of card) */}
          {imageUrl ? (
            <div className="w-24 flex-shrink-0 overflow-hidden rounded-r-[8px] border-l border-border/40">
              <img
                src={imageUrl}
                alt={t.title || "Task image"}
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

