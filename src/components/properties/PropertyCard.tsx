import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";

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
        {/* Name */}
        <h3 className="font-semibold text-lg text-foreground leading-tight">
          {displayName}
        </h3>

        {/* Address */}
        <div>
          <Badge variant="neutral" size="sm" className="inline-flex items-start gap-1.5">
            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{property.address}</span>
          </Badge>
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

