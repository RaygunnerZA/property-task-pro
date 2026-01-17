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

function PropertyIconChip({ property }: { property: any }) {
  if (!property) return null;
  const iconName = property.icon_name || "home";
  const IconComponent = PROPERTY_ICONS[iconName as keyof typeof PROPERTY_ICONS] || Home;
  const iconColor = property.icon_color_hex || "#8EC9CE";
  return (
    <div
      className="inline-flex items-center justify-center rounded-[146px] border-0"
      style={{ backgroundColor: iconColor, width: "20px", height: "20px" }}
    >
      <IconComponent className="h-3 w-3 text-white" />
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
  const { t, themes, spaces, teams, imageUrl } = useMemo(() => {
    const mappedTask = mapTask(task);
    
    // Image (same logic as other cards)
    let images: any[] = [];
    if (task?.images) {
      if (typeof task.images === "string") {
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
    const url =
      firstImage?.thumbnail_url ||
      firstImage?.file_url ||
      task?.primary_image_url ||
      task?.image_url ||
      (task as any)?.image_url;

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
      imageUrl: url,
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
      <div className="relative flex items-stretch">
        <PriorityDot priority={t.priority} />

        <div className="flex-1 min-w-0 p-3 space-y-2">
          {/* Title - 1-2 lines only (single title) */}
          <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2">
            {t.title || "Untitled Task"}
          </h3>

          {/* Small Chips Row */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {property ? <PropertyIconChip property={property} /> : null}

            {/* Priority chip - keep optional */}
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

            {spaces.length > 0 && (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {spaces.length}S
              </span>
            )}
            {teams.length > 0 && (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {teams.length}T
              </span>
            )}
          </div>
        </div>

        {/* Right thumbnail (full height) */}
        {imageUrl ? (
          <div className="w-14 flex-shrink-0 overflow-hidden rounded-r-[8px] border-l border-border/40 bg-muted/30">
            <img
              src={imageUrl}
              alt={t.title || "Task image"}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

