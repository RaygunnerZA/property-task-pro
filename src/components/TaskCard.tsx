import { mapTask } from "../utils/mapTask";
import { cn } from "@/lib/utils";
import { Home, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
        "rounded-[8px] bg-card",
        "shadow-e1",
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
          <Badge 
            variant={t.status === 'completed' ? 'success' : 'neutral'}
            className="text-[10px] px-2 py-0.5 shrink-0"
          >
            {t.status || 'pending'}
          </Badge>
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
      {imageUrl && (
        <div className="w-24 sm:w-28 flex-shrink-0 relative">
          <img 
            src={imageUrl} 
            alt={t.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Neumorphic overlay - light inner shadow top/left, outer shadow right */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: 'inset 2px 2px 4px rgba(255, 255, 255, 0.6), inset -1px -1px 2px rgba(0, 0, 0, 0.1), 3px 0px 6px rgba(0, 0, 0, 0.15)'
            }}
          />
        </div>
      )}
    </div>
  );
}