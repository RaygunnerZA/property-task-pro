import { useNavigate } from "react-router-dom";
import { Users, CheckSquare, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamCardProps {
  team: {
    id: string;
    name?: string | null;
    taskCount?: number;
    urgentTaskCount?: number;
  };
  className?: string;
}

export function TeamCard({ team, className }: TeamCardProps) {
  const navigate = useNavigate();
  
  const displayName = team.name || 'Unnamed Team';
  const taskCount = team.taskCount ?? 0;
  const urgentCount = team.urgentTaskCount ?? 0;
  
  // Use a simple color for teams (slightly different teal)
  const iconColor = "#7BA8AD";

  return (
    <div
      onClick={() => navigate(`/teams/${team.id}`)}
      className={cn(
        "bg-card rounded-[8px] overflow-hidden shadow-e1",
        "cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-[1px]",
        "active:scale-[0.99] active:translate-y-0",
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
        {/* Team Icon - centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Users className="h-6 w-6 text-white" />
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
        {/* Name */}
        <div>
          <h3 className="font-semibold text-sm text-foreground leading-tight">
            {displayName}
          </h3>
        </div>

        {/* Task Counts Row */}
        <div className="flex items-center gap-2 flex-wrap">
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
  );
}

