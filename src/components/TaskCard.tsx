import { mapTask } from "../utils/mapTask";
import { cn } from "@/lib/utils";
import { Calendar, Clock, MapPin, MoreHorizontal } from "lucide-react";
import { getPropertyChipIcon } from "@/lib/propertyChipIcons";
import { Badge } from "@/components/ui/badge";
import { updateTaskFields } from "@/services/tasks/taskMutations";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useCallback, memo } from "react";
import { formatTaskDate } from "@/utils/formatTaskDate";
import { OverlappingAvatars } from "@/components/tasks/UserAvatar";
import { getTaskSpaceIllustration } from "@/lib/taskIllustration";
import {
  formatTaskDueRelative,
  getTaskDueUrgency,
  taskDueUrgencyLabel,
} from "@/lib/taskDueUrgency";
import { TaskCardMediaZone } from "@/components/tasks/TaskCardMediaZone";
import {
  issuesSignalOverflowButtonClassName,
  issuesSignalReviewButtonClassName,
  issuesSignalSecondaryButtonClassName,
} from "@/components/dashboard/issues/IssuesSignalListParts";

/** Issues workbench “Open work” — same meta treatment as Recent signals (JetBrains Mono 10 / 600, caps). */
const WORKBENCH_TASK_META_CLASS =
  "text-[10px] font-mono font-semibold uppercase tracking-wide text-muted-foreground leading-snug line-clamp-1";

// Property Icon Chip Component - shows property icon on property color background
// 24x24px icon bounding box
function PropertyIconChip({ property }: { property: any }) {
  if (!property) return null;
  
  const iconName = property.icon_name || "home";
  const IconComponent = getPropertyChipIcon(iconName);
  const iconColor = property.icon_color_hex || "#8EC9CE";
  
  return (
    <div
      className="inline-flex items-center justify-center rounded-[8px] border-0 flex-shrink-0"
      style={{
        backgroundColor: iconColor,
        width: '24px',
        height: '24px',
        minWidth: '24px',
        minHeight: '24px',
      }}
    >
      <IconComponent className="h-4 w-4 text-white" />
    </div>
  );
}

// Multiple Property Icon Chips - shows overlapping icons for multiple properties
function PropertyIconChips({ properties }: { properties: any[] }) {
  if (!properties || properties.length === 0) return null;
  
  // For single property, just show one chip
  if (properties.length === 1) {
    return <PropertyIconChip property={properties[0]} />;
  }
  
  // For multiple properties, show overlapping chips (30% overlap)
  return (
    <div className="inline-flex items-center" style={{ gap: '-6px' }}>
      {properties.map((property, index) => {
        const iconName = property?.icon_name || "home";
        const IconComponent = getPropertyChipIcon(iconName);
        const iconColor = property?.icon_color_hex || "#8EC9CE";
        const zIndex = properties.length - index; // Later properties have higher z-index
        
        return (
          <div
            key={property?.id || index}
            className="inline-flex items-center justify-center rounded-[146px] border-0 relative"
            style={{
              backgroundColor: iconColor,
              width: '24px',
              height: '24px',
              marginLeft: index > 0 ? '-7.2px' : '0', // 30% overlap (7.2px out of 24px)
              zIndex,
            }}
          >
            <IconComponent className="h-4 w-4 text-white" />
          </div>
        );
      })}
    </div>
  );
}

function TaskCardComponent({
  task, 
  property, 
  onClick,
  isSelected = false,
  layout = 'horizontal',
  metaDensity = 'default',
}: { 
  task: any; 
  property?: any; 
  onClick?: () => void;
  isSelected?: boolean;
  layout?: 'horizontal' | 'vertical';
  /** "compact" = fewer badges (Issues Open work). */
  metaDensity?: 'default' | 'compact';
}) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCompleting, setIsCompleting] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  
  // Memoize task mapping and image parsing to prevent re-renders
  // Only recalculate when task data actually changes, not when object reference changes
  const { t, imageUrl, themes, spaces, assignedUsers, teams } = useMemo(() => {
    const mappedTask = mapTask(task);
    
    // Get image from new images array (from tasks_view)
    // Handle both JSON string and array formats
    let images: any[] = [];
    if (task?.images) {
      if (typeof task.images === 'string') {
        try {
          images = JSON.parse(task.images);
        } catch (e) {
          images = [];
        }
      } else if (Array.isArray(task.images)) {
        images = task.images;
      }
    }
    
    const firstImage = images.find((attachment: any) => {
      const fileType = String(attachment?.file_type || "").toLowerCase();
      const fileName = String(attachment?.file_name || "").toLowerCase();
      return fileType.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif|bmp|svg)$/.test(fileName);
    }) || (images.length > 0 ? images[0] : null);
    const uploadedUrl =
      firstImage?.thumbnail_url ||
      firstImage?.file_url ||
      task?.primary_image_url ||
      task?.image_url ||
      (task as any)?.image_url;

    // Parse themes, spaces, and teams (handle both string and array formats)
    let themesArray: any[] = [];
    if (task?.themes) {
      if (typeof task.themes === 'string') {
        try {
          themesArray = JSON.parse(task.themes);
        } catch (e) {
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
        } catch (e) {
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
        } catch (e) {
          teamsArray = [];
        }
      } else if (Array.isArray(task.teams)) {
        teamsArray = task.teams;
      }
    }
    
    // Get assigned user ID (check both field names)
    const assignedUserId = task?.assigned_user_id;
    
    // Get assigned users (check both field names for user ID)
    const assignedUsersArray: any[] = [];
    if (assignedUserId) {
      assignedUsersArray.push({
        id: assignedUserId,
        name: task?.assigned_user_name || task?.assignee_name || task?.assigned_user_display_name || task?.assignee_display_name || undefined,
        imageUrl: task?.assigned_user_image_url || task?.assignee_image_url || task?.assigned_user_avatar_url || task?.assignee_avatar_url || undefined,
        propertyColor: property?.icon_color_hex || "#8EC9CE",
      });
    }

    const url =
      uploadedUrl ||
      getTaskSpaceIllustration(spacesArray, task?.title ?? mappedTask.title);
    
    return { 
      t: mappedTask, 
      imageUrl: url,
      themes: themesArray,
      spaces: spacesArray,
      teams: teamsArray,
      assignedUsers: assignedUsersArray,
    };
  }, [
    task?.id,
    task?.title,
    task?.status,
    task?.due_date,
    task?.priority,
    task?.images,
    task?.primary_image_url,
    task?.image_url,
    task?.themes,
    task?.spaces,
    task?.teams,
    task?.spaces,
    task?.assigned_user_id,
    task?.assigned_user_name,
    task?.assignee_name,
    task?.assigned_user_display_name,
    task?.assignee_display_name,
    task?.assigned_user_image_url,
    task?.assignee_image_url,
    task?.assigned_user_avatar_url,
    task?.assignee_avatar_url,
    property?.icon_color_hex,
  ]);
  
  // Memoize handleDone to prevent recreation on every render
  const handleDone = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!task?.id || isCompleting) return;

    setIsCompleting(true);
    try {
      await updateTaskFields(task.id, { status: 'completed' });
      toast({
        title: "Task completed",
        description: "The task has been marked as complete.",
      });
      // Invalidate queries to refresh the task list and briefing radial
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-briefing"] });
      queryClient.invalidateQueries({ queryKey: ["task", orgId, task.id] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  }, [task?.id, isCompleting, toast, queryClient, orgId]);
  
  // Don't show Done button if task is already archived or completed
  const showDoneButton = task?.status !== 'archived' && task?.status !== 'completed';

  // Get priority color for indicator circle
  // No priority is treated as normal, and normal/low priorities don't show a dot
  const getPriorityColor = (priority?: string | null) => {
    if (!priority) return 'bg-transparent'; // No priority = normal, don't show
    const normalizedPriority = priority?.toLowerCase();
    if (normalizedPriority === 'low') return 'bg-transparent'; // Don't show for low
    if (normalizedPriority === 'normal' || normalizedPriority === 'medium') return 'bg-transparent'; // Don't show for normal/medium
    if (normalizedPriority === 'high') return 'bg-[#FFB84D]'; // Lighter yellow-orange
    if (normalizedPriority === 'urgent') return 'bg-red-500'; // Red
    return 'bg-transparent'; // Default: transparent
  };

  const priorityColor = getPriorityColor(task?.priority);
  const isUrgentPriority = task?.priority?.toLowerCase() === "urgent";
  const metaCompact = metaDensity === "compact";
  const showPriorityDot =
    !metaCompact || task?.priority === "high" || task?.priority === "urgent";
  const dueUrgency = getTaskDueUrgency(task);
  const dueRelativeLabel = formatTaskDueRelative(task?.due_date ?? t.due_at);
  const propertyLabel =
    property?.nickname || property?.address || property?.name || null;
  const spaceLabel = spaces[0]?.name ?? null;
  const locationLine = [propertyLabel, spaceLabel].filter(Boolean).join(" • ");

  const dueUrgencyChip =
    dueUrgency != null ? (
      <span
        className={cn(
          "absolute top-1 right-2 z-10 -mx-0.5 flex h-[22px] items-center justify-center rounded-[5px] px-2",
          "font-mono text-[11px] font-medium uppercase tracking-normal leading-none shadow-sm",
          dueUrgency === "overdue"
            ? "bg-destructive/90 text-white"
            : "bg-amber-500/90 text-white"
        )}
      >
        {taskDueUrgencyLabel(dueUrgency)}
      </span>
    ) : null;

  // Horizontal layout (image on right)
  if (layout === 'horizontal') {
    return (
      <div 
        className={cn(
          "task-card-horizontal",
          "rounded-[12px] bg-[rgba(255,255,255,0.6)]",
          "shadow-e1",
          "cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all duration-150",
          "overflow-hidden flex flex-row min-h-[80px] relative group",
          isSelected && "bg-white shadow-[0_8px_30px_rgba(0,0,0,0.15),0_4px_12px_rgba(0,0,0,0.1)]"
        )}
        onClick={onClick}
      >
        {/* Priority Indicator Circle - Top Left Corner */}
        {showPriorityDot ? (
        <div 
          className={cn(
            "absolute top-[4px] left-[4px] w-[10px] h-[10px] rounded-full",
            priorityColor
          )}
        />
        ) : null}
        {/* Content */}
        <div className="flex-1 px-[14px] py-4 flex flex-col justify-center">
          {/* Theme/Category */}
          {!metaCompact && themes.length > 0 && (
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              {themes[0].name}
            </div>
          )}
          
          {/* Task Title */}
          <div className="flex justify-start items-center gap-2 min-h-[44px]">
            <h3 className="text-[16px] font-medium text-foreground line-clamp-2 leading-tight">
              {t.title}
            </h3>
          </div>

          {/* Property Icon + Space + Date/Time + Teams + Avatars */}
          <div className="mt-[7px] flex gap-2 flex-wrap items-center">
            {property && (
              <PropertyIconChips properties={[property]} />
            )}
            {metaCompact ? (
              <>
                {(spaces[0]?.name || t.due_at) && (
                  <span className={cn(WORKBENCH_TASK_META_CLASS, "min-w-0 flex-1")}>
                    {spaces[0]?.name ? `${spaces[0].name}` : ""}
                    {spaces[0]?.name && t.due_at ? " · " : ""}
                    {t.due_at ? formatTaskDate(t.due_at) : ""}
                  </span>
                )}
                {assignedUsers.length > 0 && (
                  <OverlappingAvatars
                    users={assignedUsers}
                    size={24}
                    overlap={20}
                    className="ml-auto shrink-0"
                  />
                )}
              </>
            ) : (
              <>
                {spaces.length > 0 && (
                  <Badge variant="neutral" size="sm" className="text-[10px] px-[5px] font-mono uppercase h-[24px]">
                    {spaces[0].name}
                  </Badge>
                )}
                {t.due_at && (
                  <Badge variant="neutral" size="sm" className="text-[10px] px-[5px] flex items-center gap-1 font-mono h-[24px]">
                    <Clock className="h-3 w-3" />
                    {formatTaskDate(t.due_at)}
                  </Badge>
                )}
                {teams.length > 0 && teams.map((team: any) => (
                  <Badge key={team.id} variant="neutral" size="sm" className="text-[10px] px-[5px] font-mono uppercase h-[24px]">
                    {team.name}
                  </Badge>
                ))}
                {assignedUsers.length > 0 && (
                  <OverlappingAvatars 
                    users={assignedUsers}
                    size={24}
                    overlap={20}
                    className="ml-auto"
                  />
                )}
              </>
            )}
          </div>
        </div>

        <TaskCardMediaZone imageUrl={imageUrl} alt={t.title} variant="horizontal">
          {dueUrgencyChip}
          {showDoneButton && !metaCompact ? (
            <div
              className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer z-10"
              onClick={(e) => {
                e.stopPropagation();
                handleDone(e);
              }}
            >
              <Badge className="text-[10px] px-2 h-[24px] bg-success text-success-foreground border-0">
                DONE
              </Badge>
            </div>
          ) : null}
        </TaskCardMediaZone>
      </div>
    );
  }

  // Vertical layout (image on top)
  return (
    <div 
      className={cn(
        "task-card-vertical h-[290px] w-full min-w-0",
        "rounded-[12px] bg-card/60",
        "shadow-e1",
        "cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all duration-150",
        "overflow-hidden flex flex-col relative group",
        isSelected && "bg-white/60 shadow-[0_8px_30px_rgba(0,0,0,0.15),0_4px_12px_rgba(0,0,0,0.1)]"
      )}
      onClick={onClick}
    >
      <TaskCardMediaZone imageUrl={imageUrl} alt={t.title} variant="vertical">
        {dueUrgencyChip}
        {showPriorityDot ? (
          <div
            className={cn(
              "absolute top-[4px] left-[4px] w-[24px] h-[24px] rounded-[8px] z-10 flex items-center justify-center",
              priorityColor
            )}
            style={{
              boxShadow:
                "1px 2px 1px 0px rgba(255, 255, 255, 0.3), -1px -1px 1px 0px rgba(0, 0, 0, 0.2)",
            }}
          >
            {isUrgentPriority ? (
              <span className="text-white text-[13px] font-bold leading-none">!</span>
            ) : null}
          </div>
        ) : null}
        {!metaCompact && themes.length > 0 ? (
          <div className="absolute bottom-2 left-2 z-10">
            <Badge variant="neutral" size="sm" className="text-[10px] px-[5px] font-mono uppercase h-[24px]">
              {themes[0].name}
            </Badge>
          </div>
        ) : null}
      </TaskCardMediaZone>

      {/* Content */}
      <div className="flex flex-1 flex-col px-[12px] pt-[12px] pb-[12px] min-h-0">
        <h3 className="pb-[5px] text-[16px] font-medium text-foreground line-clamp-2 leading-tight">
          {t.title}
        </h3>

        {locationLine ? (
          <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{locationLine}</span>
          </p>
        ) : null}

        {dueRelativeLabel ? (
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{dueRelativeLabel}</span>
          </p>
        ) : null}

        <div className="mt-auto flex items-center gap-2 pt-3">
          <button
            type="button"
            className={issuesSignalReviewButtonClassName}
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            Take Action
          </button>
          <button
            type="button"
            className={issuesSignalSecondaryButtonClassName}
            onClick={(e) => {
              e.stopPropagation();
              toast({
                title: "Snooze",
                description: "Snooze will be available soon.",
              });
            }}
          >
            Snooze
          </button>
          <div className="relative ml-auto shrink-0">
            <button
              type="button"
              aria-label="More actions"
              aria-expanded={overflowOpen}
              aria-haspopup="menu"
              className={issuesSignalOverflowButtonClassName}
              onClick={(e) => {
                e.stopPropagation();
                setOverflowOpen((open) => !open);
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {overflowOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-1 min-w-[8rem] rounded-[8px] border border-border/60 bg-card py-1 shadow-md"
              >
                {showDoneButton ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-muted/40 disabled:opacity-50"
                    disabled={isCompleting}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOverflowOpen(false);
                      handleDone(e);
                    }}
                  >
                    {isCompleting ? "Completing…" : "Mark done"}
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-muted/40"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOverflowOpen(false);
                    onClick?.();
                  }}
                >
                  Details
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// Memoize TaskCard with custom comparison to prevent unnecessary re-renders
// Returns true if props are equal (skip re-render), false if different (re-render)
const TaskCard = memo(TaskCardComponent, (prevProps, nextProps) => {
  // Quick reference equality check first
  if (prevProps === nextProps) return true;
  
  // If task ID changed, definitely re-render
  if (prevProps.task?.id !== nextProps.task?.id) return false;
  
  // If selection state changed, re-render
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  
  // If layout changed, re-render
  if (prevProps.layout !== nextProps.layout) return false;

  if (prevProps.metaDensity !== nextProps.metaDensity) return false;
  
  // If property changed, re-render
  if (prevProps.property?.id !== nextProps.property?.id) return false;
  
  // Compare all task data that affects rendering
  const prevTask = prevProps.task;
  const nextTask = nextProps.task;
  
  const fieldsChanged = prevTask?.status !== nextTask?.status ||
    prevTask?.title !== nextTask?.title ||
    prevTask?.due_date !== nextTask?.due_date ||
    prevTask?.priority !== nextTask?.priority ||
    prevTask?.assigned_user_id !== nextTask?.assigned_user_id ||
    JSON.stringify(prevTask?.teams) !== JSON.stringify(nextTask?.teams) ||
    JSON.stringify(prevTask?.themes) !== JSON.stringify(nextTask?.themes);

  if (fieldsChanged) {
    return false; // Task fields changed, re-render
  }
  
  // Compare images array (by first image URL)
  const selectImageUrl = (task: any) => {
    const rawImages = task?.images;
    const parsedImages = typeof rawImages === "string" ? (() => {
      try {
        return JSON.parse(rawImages);
      } catch {
        return [];
      }
    })() : rawImages;
    const images = Array.isArray(parsedImages) ? parsedImages : [];
    const preferred = images.find((attachment: any) => {
      const fileType = String(attachment?.file_type || "").toLowerCase();
      const fileName = String(attachment?.file_name || "").toLowerCase();
      return fileType.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif|bmp|svg)$/.test(fileName);
    }) || images[0];
    return preferred?.thumbnail_url || preferred?.file_url || task?.primary_image_url || null;
  };
  const parseSpaces = (task: any) => {
    const raw = task?.spaces;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return Array.isArray(raw) ? raw : [];
  };
  const prevImageUrl =
    selectImageUrl(prevTask) ||
    getTaskSpaceIllustration(parseSpaces(prevTask), prevTask?.title);
  const nextImageUrl =
    selectImageUrl(nextTask) ||
    getTaskSpaceIllustration(parseSpaces(nextTask), nextTask?.title);
  if (prevImageUrl !== nextImageUrl) return false;
  
  // onClick comparison - if both are functions, we assume they're equivalent if task.id is the same
  // This prevents re-renders when onClick function reference changes but functionality is the same
  // (The onClick handler is recreated but does the same thing)
  
  // All props are equal, skip re-render
  return true;
});

export default TaskCard;