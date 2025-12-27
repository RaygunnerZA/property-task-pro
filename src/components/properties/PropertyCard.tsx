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
        <div className="w-full h-32 bg-muted overflow-hidden">
          <img
            src={property.thumbnail_url}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="p-4 space-y-3">
        {/* Name */}
        <h3 className="font-semibold text-lg text-foreground leading-tight">
          {displayName}
        </h3>

        {/* Address */}
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p className="line-clamp-2">{property.address}</p>
        </div>

        {/* Tasks Badge */}
        {taskCount > 0 && (
          <div className="pt-2">
            <Badge variant="secondary" className="text-xs">
              Tasks: {taskCount}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}

