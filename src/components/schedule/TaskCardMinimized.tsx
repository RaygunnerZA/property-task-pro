import { useMemo } from "react";
import { mapTask } from "@/utils/mapTask";
import { cn } from "@/lib/utils";
import { Home, Building2, Hotel, Warehouse, Store, Castle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Property icon mapping
const PROPERTY_ICONS = {
  home: Home,
  building: Building2,
  hotel: Hotel,
  warehouse: Warehouse,
  store: Store,
  castle: Castle,
} as const;

interface TaskCardMinimizedProps {
  task: any;
  property?: any;
  onClick?: () => void;
}

/**
 * Minimized Task Card (Compact)
 * 
 * Lightweight card format:
 * - No image
 * - 1–2 lines only
 * - Small chips
 * - Compact height
 * - Enough to recognize task without overwhelming the timeline
 */
export function TaskCardMinimized({
  task,
  property,
  onClick,
}: TaskCardMinimizedProps) {
  // Memoize task mapping
  const { t, themes, spaces, teams } = useMemo(() => {
    const mappedTask = mapTask(task);
    
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
      themes: themesArray,
      spaces: spacesArray,
      teams: teamsArray,
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
        "hover:shadow-md hover:-translate-y-[0.5px]",
        "active:scale-[0.99]"
      )}
    >
      <div className="p-3 space-y-2">
        {/* Title - 1-2 lines only */}
        <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2">
          {t.title || "Untitled Task"}
        </h3>

        {/* Small Chips Row */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {/* Property Chip - Small */}
          {property && (
            <div
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium"
              style={{
                backgroundColor: `${iconColor}20`,
                color: iconColor,
                border: `1px solid ${iconColor}40`,
              }}
            >
              <IconComponent className="h-2.5 w-2.5" />
              <span className="truncate max-w-[60px]">
                {property.nickname || property.address || "Property"}
              </span>
            </div>
          )}

          {/* Priority Chip - Small */}
          {t.priority && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0.5",
                priorityColors[t.priority] || priorityColors.medium
              )}
            >
              {t.priority}
            </Badge>
          )}

          {/* Space/Team indicators - Very compact */}
          {spaces.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {spaces.length}S
            </span>
          )}
          {teams.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {teams.length}T
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

