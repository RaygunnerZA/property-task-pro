import { useNavigate } from "react-router-dom";
import { FolderOpen, CheckSquare, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpaceCardProps {
  space: {
    id: string;
    name?: string | null;
    type?: string | null;
    property_id?: string | null;
    taskCount?: number;
    urgentTaskCount?: number;
  };
  className?: string;
  onFilterClick?: (spaceId: string) => void;
}

export function SpaceCard({ space, className, onFilterClick }: SpaceCardProps) {
  const navigate = useNavigate();
  
  const displayName = space.name || space.type || 'Unnamed Space';
  const taskCount = space.taskCount ?? 0;
  const urgentCount = space.urgentTaskCount ?? 0;
  
  // Use a simple color for spaces (lighter teal)
  const iconColor = "#8EC9CE";

  const handleTopSectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (space.property_id) {
      navigate(`/properties/${space.property_id}`);
    }
  };

  const handleMetaZoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFilterClick) {
      onFilterClick(space.id);
    }
  };

  return (
    <div
      className={cn(
        "bg-card rounded-[8px] overflow-hidden shadow-e1",
        "transition-all duration-200",
        className
      )}
    >
      {/* Thumbnail Image */}
      <div 
        className="w-full h-[70px] overflow-hidden relative"
        style={{
          backgroundColor: iconColor,
        }}
      >
        {/* Space Icon - centered */}
        <div className="absolute inset-0 flex items-center justify-start pl-[9px] pr-[9px]">
          <FolderOpen className="h-6 w-6 text-white" />
        </div>
        {/* Neumorphic overlay */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 2px 2px 4px rgba(255, 255, 255, 0.6), inset -1px -1px 2px rgba(0, 0, 0, 0.1), 3px 0px 6px rgba(0, 0, 0, 0.15)'
          }}
        />
      </div>
      
      <div className="pt-3 pb-3 pl-2.5 pr-2.5 space-y-2">
        {/* Top Section - Clickable for navigation */}
        <div 
          onClick={handleTopSectionClick}
          style={{ verticalAlign: 'middle' }}
          className="cursor-pointer active:scale-[0.99]"
        >
          <h3 className="font-semibold text-sm text-foreground leading-tight h-[20px]" style={{ verticalAlign: 'middle' }}>
            {displayName}
          </h3>
        </div>

        {/* Neumorphic Perforation Line - Row of cut circles */}
        <div 
          className="-ml-2.5 -mr-2.5 pt-2 pb-0 px-1"
          style={{
            height: '1px',
            backgroundImage: 'repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)',
            backgroundSize: '7px 1px',
            backgroundRepeat: 'repeat-x',
            boxShadow: '1px 1px 0px rgba(255, 255, 255, 1), -1px -1px 1px rgba(0, 0, 0, 0.075)',
          }}
        />

        {/* Meta Zone - Clickable for filtering */}
        <div 
          onClick={handleMetaZoneClick}
          className="cursor-pointer active:scale-[0.99] m-0"
        >
          {/* Task Counts Row */}
          <div className="flex items-center gap-2 flex-wrap mt-[2px]">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckSquare className="h-3 w-3" />
              {taskCount} Task{taskCount !== 1 ? 's' : ''}
            </span>
            {urgentCount > 0 && (
              <span className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {urgentCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

