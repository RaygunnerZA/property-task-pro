import { mapTask } from "../utils/mapTask";
import { cn } from "@/lib/utils";
import { Home, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { archiveTask } from "@/services/tasks/taskMutations";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useCallback, memo } from "react";

function TaskCardComponent({
  task, 
  property, 
  onClick,
  isSelected = false,
  layout = 'horizontal'
}: { 
  task: any; 
  property?: any; 
  onClick?: () => void;
  isSelected?: boolean;
  layout?: 'horizontal' | 'vertical';
}) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isArchiving, setIsArchiving] = useState(false);
  
  // Memoize task mapping and image parsing to prevent re-renders
  // Only recalculate when task data actually changes, not when object reference changes
  const { t, imageUrl } = useMemo(() => {
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
    
    const firstImage = images.length > 0 ? images[0] : null;
    const url = firstImage?.thumbnail_url || firstImage?.file_url || task?.primary_image_url || task?.image_url || (task as any)?.image_url;
    
    return { t: mappedTask, imageUrl: url };
  }, [
    task?.id,
    task?.title,
    task?.status,
    task?.due_date,
    task?.priority,
    task?.images,
    task?.primary_image_url,
    task?.image_url,
  ]);
  
  // Memoize handleDone to prevent recreation on every render
  const handleDone = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!task?.id || !orgId || isArchiving) return;
    
    setIsArchiving(true);
    try {
      await archiveTask(task.id, orgId);
      toast({
        title: "Task archived",
        description: "The task has been archived and is still available to view.",
      });
      // Invalidate queries to refresh the task list
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", orgId, task.id] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to archive task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsArchiving(false);
    }
  }, [task?.id, orgId, isArchiving, toast, queryClient]);
  
  // Don't show Done button if task is already archived or completed
  const showDoneButton = task?.status !== 'archived' && task?.status !== 'completed';

  // Get priority color for indicator circle
  const getPriorityColor = (priority?: string | null) => {
    if (!priority) return 'bg-transparent'; // Transparent when no priority
    const normalizedPriority = priority?.toLowerCase();
    if (normalizedPriority === 'low') return 'bg-transparent'; // Transparent for low
    if (normalizedPriority === 'normal' || normalizedPriority === 'medium') return 'bg-gray-400'; // Light grey
    if (normalizedPriority === 'high') return 'bg-[#EB6834]'; // Filla orange
    if (normalizedPriority === 'urgent') return 'bg-red-500'; // Red
    return 'bg-transparent'; // Default: transparent
  };

  const priorityColor = getPriorityColor(task?.priority);

  // Horizontal layout (image on right)
  if (layout === 'horizontal') {
    return (
      <div 
        className={cn(
          "rounded-[8px] bg-card",
          "shadow-e1",
          "cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all duration-150",
          "overflow-hidden flex min-h-[80px] relative group",
          isSelected && "border-2 border-primary shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)] bg-primary/5"
        )}
        onClick={onClick}
      >
        {/* Priority Indicator Circle - Top Left Corner */}
        <div 
          className={cn(
            "absolute top-[3px] left-[3px] w-2.5 h-2.5 rounded-full",
            priorityColor
          )}
        />
        {/* Content */}
        <div className="flex-1 px-[7px] py-4 flex flex-col justify-center">
          <div className="flex justify-start items-center gap-2 h-[44px]">
            <h3 className="text-[16px] font-medium text-foreground line-clamp-2 leading-tight">
              {t.title}
            </h3>
          </div>

          <div className="mt-[7px] flex gap-2 flex-wrap">
            {property && (
              <Badge variant="neutral" size="sm" className="text-[10px] px-[5px] py-0.5 flex items-center gap-1">
                <Home className="h-3 w-3" />
                <span className="truncate max-w-[100px]">{property.name || property.address}</span>
              </Badge>
            )}
            <Badge variant="neutral" size="sm" className="text-[10px] px-[5px] py-0.5 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t.due_at ? new Date(t.due_at).toLocaleDateString() : "No due date"}
            </Badge>
          </div>
        </div>

        {/* Image Zone - Anchored to right side with no padding on top/right/bottom */}
        {/* Always show image area for consistent layout, show placeholder if no image */}
        <div className="w-24 sm:w-28 flex-shrink-0 relative">
          {imageUrl ? (
            <>
              <img 
                src={imageUrl} 
                alt={t.title}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  // Hide image on error, show placeholder
                  (e.target as HTMLImageElement).style.display = 'none';
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    parent.classList.add('bg-muted');
                  }
                }}
              />
              {/* Neumorphic overlay - light inner shadow top/left, outer shadow right */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow: 'inset 2px 2px 4px rgba(255, 255, 255, 0.6), inset -1px -1px 2px rgba(0, 0, 0, 0.1), 3px 0px 6px rgba(0, 0, 0, 0.15)'
                }}
              />
            </>
          ) : (
            <div className="absolute inset-0 bg-muted/30 flex items-center justify-center">
              <div className="w-8 h-8 rounded bg-muted/50" />
            </div>
          )}
          {/* DONE chip - appears on hover, bottom right corner */}
          {showDoneButton && (
            <div 
              className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer z-10"
              onClick={(e) => {
                e.stopPropagation();
                handleDone(e);
              }}
            >
              <Badge 
                className="text-[10px] px-2 py-0.5 bg-success text-success-foreground border-0"
              >
                DONE
              </Badge>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vertical layout (image on top)
  return (
    <div 
      className={cn(
        "rounded-[8px] bg-card",
        "shadow-e1",
        "cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all duration-150",
        "overflow-hidden flex flex-col relative group",
        isSelected && "border-2 border-primary shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)] bg-primary/5"
      )}
      onClick={onClick}
    >
      {/* Image Zone - Top */}
      <div className="w-full h-40 sm:h-48 relative flex-shrink-0">
        {/* Priority Indicator Circle - Top Left Corner of Image */}
        <div 
          className={cn(
            "absolute top-[3px] left-[3px] w-2.5 h-2.5 rounded-full z-10",
            priorityColor
          )}
        />
        {imageUrl ? (
          <>
            <img 
              src={imageUrl} 
              alt={t.title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                // Hide image on error, show placeholder
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  parent.classList.add('bg-muted');
                }
              }}
            />
            {/* Neumorphic overlay - light inner shadow top/left, outer shadow bottom */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: 'inset 2px 2px 4px rgba(255, 255, 255, 0.6), inset -1px -1px 2px rgba(0, 0, 0, 0.1), 0px 3px 6px rgba(0, 0, 0, 0.15)'
              }}
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-muted/30 flex items-center justify-center">
            <div className="w-12 h-12 rounded bg-muted/50" />
          </div>
        )}
        {/* DONE chip - appears on hover, top right corner */}
        {showDoneButton && (
          <div 
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer z-10"
            onClick={(e) => {
              e.stopPropagation();
              handleDone(e);
            }}
          >
            <Badge 
              className="text-[10px] px-2 py-0.5 bg-success text-success-foreground border-0"
            >
              DONE
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-[7px] py-4 flex flex-col justify-center">
        <div className="flex justify-start items-center gap-2 min-h-[44px]">
          <h3 className="text-[16px] font-medium text-foreground line-clamp-2 leading-tight">
            {t.title}
          </h3>
        </div>

        <div className="mt-[7px] flex gap-2 flex-wrap">
          {property && (
            <Badge variant="neutral" size="sm" className="text-[10px] px-[5px] py-0.5 flex items-center gap-1">
              <Home className="h-3 w-3" />
              <span className="truncate max-w-[100px]">{property.name || property.address}</span>
            </Badge>
          )}
          <Badge variant="neutral" size="sm" className="text-[10px] px-[5px] py-0.5 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {t.due_at ? new Date(t.due_at).toLocaleDateString() : "No due date"}
          </Badge>
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
  
  // If property changed, re-render
  if (prevProps.property?.id !== nextProps.property?.id) return false;
  
  // Compare all task data that affects rendering
  const prevTask = prevProps.task;
  const nextTask = nextProps.task;
  
  if (
    prevTask?.status !== nextTask?.status ||
    prevTask?.title !== nextTask?.title ||
    prevTask?.due_date !== nextTask?.due_date ||
    prevTask?.priority !== nextTask?.priority
  ) {
    return false; // Task fields changed, re-render
  }
  
  // Compare images array (by first image URL)
  const prevImageUrl = prevTask?.images?.[0]?.thumbnail_url || prevTask?.images?.[0]?.file_url || prevTask?.primary_image_url;
  const nextImageUrl = nextTask?.images?.[0]?.thumbnail_url || nextTask?.images?.[0]?.file_url || nextTask?.primary_image_url;
  if (prevImageUrl !== nextImageUrl) return false;
  
  // onClick comparison - if both are functions, we assume they're equivalent if task.id is the same
  // This prevents re-renders when onClick function reference changes but functionality is the same
  // (The onClick handler is recreated but does the same thing)
  
  // All props are equal, skip re-render
  return true;
});

export default TaskCard;