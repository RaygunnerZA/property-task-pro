import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { MapPin, MoreVertical, Edit, Trash2, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PropertyRow = Tables<"properties">;

interface PropertyCardProps {
  property: PropertyRow & { taskCount?: number };
  className?: string;
}

export function PropertyCard({ property, className }: PropertyCardProps) {
  const navigate = useNavigate();
  
  const displayName = property.nickname || property.address;
  const taskCount = property.taskCount ?? 0;

  return (
    <div
      onClick={() => navigate(`/properties/${property.id}`)}
      className={cn(
        "bg-card rounded-[8px] overflow-hidden shadow-e1",
        "cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-[1px]",
        "active:scale-[0.99] active:translate-y-0",
        className
      )}
    >
      {/* Thumbnail Image */}
      {property.thumbnail_url && (
        <div className="w-full h-32 bg-muted overflow-hidden relative">
          <img
            src={property.thumbnail_url}
            alt={displayName}
            className="w-full h-full object-cover"
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
      
      <div className="p-4 space-y-3">
        {/* Name with Options Menu */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-lg text-foreground leading-tight flex-1">
            {displayName}
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="p-1.5 rounded-[5px] hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label="Property options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border shadow-e2">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/properties/${property.id}`);
                }}
                className="gap-2 text-sm"
              >
                <Edit className="h-4 w-4" />
                Edit Property
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Implement archive functionality
                }}
                className="gap-2 text-sm"
              >
                <Archive className="h-4 w-4" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Implement delete functionality
                }}
                className="gap-2 text-sm text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Tasks Badge */}
        {taskCount > 0 && (
          <div className="pt-2">
            <Badge variant="secondary" className="inline-flex">
              Tasks: {taskCount}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}

