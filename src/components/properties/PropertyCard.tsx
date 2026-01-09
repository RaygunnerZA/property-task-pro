import { useNavigate } from "react-router-dom";
import { Shield, Building2, Home, Hotel, Warehouse, Store, Castle, CheckSquare, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { differenceInDays } from "date-fns";

type PropertyRow = Tables<"properties">;

// Property icon mapping
const PROPERTY_ICONS = {
  home: Home,
  building: Building2,
  hotel: Hotel,
  warehouse: Warehouse,
  store: Store,
  castle: Castle,
} as const;

interface PropertyCardProps {
  property: PropertyRow & { 
    taskCount?: number;
    urgentTaskCount?: number;
    lastInspectedDate?: string | null;
  };
  className?: string;
  onFilterClick?: (propertyId: string) => void;
}

export function PropertyCard({ property, className, onFilterClick }: PropertyCardProps) {
  const navigate = useNavigate();
  
  const displayName = property.nickname || property.address;
  const taskCount = property.taskCount ?? 0;
  const urgentCount = property.urgentTaskCount ?? 0;
  
  // Get property icon
  const iconName = property.icon_name || "home";
  const IconComponent = PROPERTY_ICONS[iconName as keyof typeof PROPERTY_ICONS] || Home;
  const iconColor = property.icon_color_hex || "#8EC9CE";
  
  // Calculate days since last inspection
  const lastInspectedDays = property.lastInspectedDate 
    ? differenceInDays(new Date(), new Date(property.lastInspectedDate))
    : null;

  const handleTopSectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/properties/${property.id}`);
  };

  const handleMetaZoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFilterClick) {
      onFilterClick(property.id);
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
        className="w-full h-[100px] overflow-hidden relative"
        style={{
          backgroundColor: property.thumbnail_url ? undefined : iconColor,
        }}
      >
        {property.thumbnail_url ? (
          <>
            <img
              src={property.thumbnail_url}
              alt={displayName}
              className="w-full h-full object-cover"
            />
            {/* Property Icon - positioned top left over image */}
            <div
              className="absolute top-2 left-2 p-2 rounded-[5px] flex items-center justify-center z-10"
              style={{
                backgroundColor: iconColor,
                boxShadow: "2px 2px 4px rgba(0,0,0,0.1), -1px -1px 2px rgba(255,255,255,0.3)",
              }}
            >
              <IconComponent className="h-4 w-4 text-white" />
            </div>
          </>
        ) : (
          /* Property Icon - centered when no image, just white icon on colored background */
          <div className="absolute inset-0 flex items-start justify-start pl-[10px] pr-[10px] pt-[11px] pb-[11px]">
            <IconComponent className="h-8 w-8 text-white" />
          </div>
        )}
        {/* Neumorphic overlay - light inner shadow top/left, outer shadow right */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 2px 2px 4px rgba(255, 255, 255, 0.6), inset -1px -1px 2px rgba(0, 0, 0, 0.1), 3px 0px 6px rgba(0, 0, 0, 0.15)'
          }}
        />
      </div>
      
      <div className="pt-4 pb-3 pl-2.5 pr-2.5 space-y-3">
        {/* Top Section - Clickable for navigation */}
        <div 
          onClick={handleTopSectionClick}
          className="cursor-pointer active:scale-[0.99] mt-0"
        >
          <h3 className="font-semibold text-lg text-foreground leading-tight">
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
          className="cursor-pointer active:scale-[0.99] !mt-0"
        >
          {/* Task Counts Row */}
          <div className="flex items-center gap-2 flex-wrap !mt-[4px]">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckSquare className="h-3 w-3" />
              {taskCount} Open Task{taskCount !== 1 ? 's' : ''}
            </span>
            {urgentCount > 0 && (
              <span className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {urgentCount} Urgent
              </span>
            )}
          </div>

          {/* Compliance Row */}
          <div className="flex items-center gap-1.5 !mt-1.5">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {lastInspectedDays !== null 
                ? `Last Inspected ${lastInspectedDays} day${lastInspectedDays !== 1 ? 's' : ''} ago`
                : 'No inspections yet'
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

