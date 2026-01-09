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
      {/* Image Preview */}
      {imageUrl && (
        <div className="w-full h-32 overflow-hidden rounded-t-[8px]">
          <img
            src={imageUrl}
            alt={t.title || "Task image"}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Title - 2-4 lines */}
        <div>
          <h3 className="font-semibold text-foreground text-base leading-tight line-clamp-4">
            {t.title || "Untitled Task"}
          </h3>
          {t.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {t.description}
            </p>
          )}
        </div>

        {/* Chips Row */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Property Chip */}
          {property && (
            <div
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[5px] text-xs font-medium"
              style={{
                backgroundColor: `${iconColor}20`,
                color: iconColor,
                border: `1px solid ${iconColor}40`,
              }}
            >
              <IconComponent className="h-3 w-3" />
              <span>{property.nickname || property.address || "Property"}</span>
            </div>
          )}

          {/* Priority Chip */}
          {t.priority && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                priorityColors[t.priority] || priorityColors.medium
              )}
            >
              {t.priority}
            </Badge>
          )}

          {/* Space Chips */}
          {spaces.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {spaces.length} space{spaces.length !== 1 ? 's' : ''}
            </Badge>
          )}

          {/* Team Chips */}
          {teams.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {teams.length} team{teams.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
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
            className="flex-1 text-xs"
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
            className="flex-1 text-xs"
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
            className="flex-1 text-xs"
          >
            Details
          </Button>
        </div>
      </div>
    </div>
  );
}

