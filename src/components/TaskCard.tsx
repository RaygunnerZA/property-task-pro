import { mapTask } from "../utils/mapTask";
import { cn } from "@/lib/utils";
import { Home, Clock, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { archiveTask } from "@/services/tasks/taskMutations";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function TaskCard({ 
  task, 
  property, 
  onClick,
  isSelected = false
}: { 
  task: any; 
  property?: any; 
  onClick?: () => void;
  isSelected?: boolean;
}) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isArchiving, setIsArchiving] = useState(false);
  const t = mapTask(task);
  
  // Debug: Log the full task object to see what we're receiving
  console.log('[TaskCard] Task object:', {
    id: task?.id,
    title: task?.title,
    images: task?.images,
    imagesType: typeof task?.images,
    imagesIsArray: Array.isArray(task?.images),
    primary_image_url: task?.primary_image_url,
    image_url: task?.image_url,
    fullTask: task
  });
  
  // Get image from new images array (from tasks_view)
  // Handle both JSON string and array formats
  let images: any[] = [];
  if (task?.images) {
    if (typeof task.images === 'string') {
      try {
        images = JSON.parse(task.images);
      } catch (e) {
        console.error('[TaskCard] Failed to parse images JSON:', e);
        images = [];
      }
    } else if (Array.isArray(task.images)) {
      images = task.images;
    }
  }
  
  const firstImage = images.length > 0 ? images[0] : null;
  const imageUrl = firstImage?.thumbnail_url || firstImage?.file_url || task?.primary_image_url || task?.image_url || (task as any)?.image_url;
  
  const handleDone = async (e: React.MouseEvent) => {
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
      console.error("Error archiving task:", error);
      toast({
        title: "Error",
        description: "Failed to archive task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsArchiving(false);
    }
  };
  
  // Don't show Done button if task is already archived or completed
  const showDoneButton = task?.status !== 'archived' && task?.status !== 'completed';

  return (
    <div 
      className={cn(
        "rounded-[8px] bg-card",
        "shadow-e1",
        "cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all duration-150",
        "overflow-hidden flex min-h-[80px]",
        isSelected && "border-2 border-primary shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)] bg-primary/5"
      )}
      onClick={onClick}
    >
      {/* Content */}
      <div className="flex-1 p-4 flex flex-col justify-center">
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-[16px] font-medium text-foreground line-clamp-2 leading-tight">
            {t.title}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            <Badge 
              variant={t.status === 'completed' ? 'success' : 'neutral'}
              className="text-[10px] px-2 py-0.5"
            >
              {t.status || 'pending'}
            </Badge>
            {showDoneButton && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px] text-primary hover:text-primary hover:bg-primary/10"
                onClick={handleDone}
                disabled={isArchiving}
              >
                <Check className="h-3 w-3 mr-1" />
                Done
              </Button>
            )}
          </div>
        </div>

        <div className="mt-2 flex gap-2 flex-wrap">
          {property && (
            <Badge variant="neutral" size="sm" className="text-[10px] px-2 py-0.5 flex items-center gap-1">
              <Home className="h-3 w-3" />
              <span className="truncate max-w-[100px]">{property.name || property.address}</span>
            </Badge>
          )}
          <Badge variant="neutral" size="sm" className="text-[10px] px-2 py-0.5 flex items-center gap-1">
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
      </div>
    </div>
  );
}