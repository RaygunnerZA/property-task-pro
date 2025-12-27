import { mapTask } from "../utils/mapTask";
import { cn } from "@/lib/utils";
import { Home, Clock } from "lucide-react";

export default function TaskCard({ 
  task, 
  property, 
  onClick 
}: { 
  task: any; 
  property?: any; 
  onClick?: () => void;
}) {
  const t = mapTask(task);
  // Support both image_url and primary_image_url from useTasks hook
  const imageUrl = task?.primary_image_url || task?.image_url;

  return (
    <div 
      className={cn(
        "rounded-[8px] bg-[rgba(232,230,227,0.5)]",
        "shadow-[3px_5px_8px_rgba(174,174,178,0.25),-3px_-3px_6px_rgba(255,255,255,0.7),inset_1px_1px_1px_rgba(255,255,255,0.6)]",
        "cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all duration-150",
        "overflow-hidden flex min-h-[80px]"
      )}
      onClick={onClick}
    >
      {/* Content */}
      <div className="flex-1 p-4 flex flex-col justify-center">
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-[15px] font-semibold text-foreground line-clamp-2 leading-tight">
            {t.title}
          </h3>
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0",
            t.status === 'completed' 
              ? "bg-primary/15 text-primary" 
              : "bg-muted text-muted-foreground"
          )}>
            {t.status || 'pending'}
          </span>
        </div>

        <div className="mt-2 text-xs text-muted-foreground flex gap-3 flex-wrap">
          {property && (
            <span className="flex items-center gap-1">
              <Home className="h-3 w-3" />
              <span className="truncate max-w-[100px]">{property.name || property.address}</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {t.due_at ? new Date(t.due_at).toLocaleDateString() : "No due date"}
          </span>
        </div>
      </div>

      {/* Image Zone - Anchored to right side with no padding on top/right/bottom */}
      {imageUrl && (
        <div className="w-24 sm:w-28 flex-shrink-0 relative">
          <img 
            src={imageUrl} 
            alt={t.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
}