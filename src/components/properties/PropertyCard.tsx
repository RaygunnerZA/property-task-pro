import { useNavigate } from "react-router-dom";
import { propertyHubPath } from "@/lib/propertyRoutes";
import { Shield, CheckSquare, AlertTriangle, Layers, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { differenceInDays } from "date-fns";
import { getPropertyChipIcon } from "@/lib/propertyChipIcons";

type PropertyRow = Tables<"properties">;

interface PropertyCardProps {
  property: PropertyRow & { 
    taskCount?: number;
    urgentTaskCount?: number;
    lastInspectedDate?: string | null;
  };
  className?: string;
  /** When "horizontal", thumbnail is on the left (for single-property view). */
  variant?: 'default' | 'horizontal';
  /** Shown in top-right of horizontal card; opens add-property flow when provided. */
  onAddPropertyClick?: () => void;
}

function ThumbnailBlock({
  property,
  displayName,
  IconComponent,
  iconColor,
  horizontal,
}: {
  property: PropertyRow & { thumbnail_url?: string | null };
  displayName: string;
  IconComponent: React.ComponentType<{ className?: string }>;
  iconColor: string;
  horizontal: boolean;
}) {
  const wrapperClass = horizontal
    ? "w-[80px] min-w-[80px] h-full min-h-[100px] flex-shrink-0 overflow-hidden relative self-stretch"
    : "w-full h-[100px] overflow-hidden relative";
  return (
    <div
      className={wrapperClass}
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
          <div
            className="absolute top-2 left-2 rounded-[151px] flex items-center justify-center z-10"
            style={{
              backgroundColor: iconColor,
              width: '24px',
              height: '24px',
              boxShadow: "3px 3px 6px rgba(0,0,0,0.08), -2px -2px 4px rgba(255,255,255,0.5), inset 1px 1px 1px rgba(255,255,255,0.3)",
            }}
          >
            <IconComponent className="h-4 w-4 text-white" />
          </div>
        </>
      ) : (
        <div
          className="absolute top-2 left-2 rounded-[151px] flex items-center justify-center z-10"
          style={{
            backgroundColor: iconColor,
            width: '24px',
            height: '24px',
            boxShadow: "3px 3px 6px rgba(0,0,0,0.08), -2px -2px 4px rgba(255,255,255,0.5), inset 1px 1px 1px rgba(255,255,255,0.3)",
          }}
        >
          <IconComponent className="h-4 w-4 text-white" />
        </div>
      )}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 2px 2px 2px 0px rgba(255, 255, 255, 0.4), inset -1px -1px 2px 0px rgba(0, 0, 0, 0.1), 3px 0px 6px 0px rgba(0, 0, 0, 0.15)'
        }}
      />
    </div>
  );
}

export function PropertyCard({ property, className, variant = 'default', onAddPropertyClick }: PropertyCardProps) {
  const navigate = useNavigate();
  
  const displayName = property.nickname || property.address;
  const taskCount = property.taskCount ?? 0;
  const urgentCount = property.urgentTaskCount ?? 0;
  
  // Get property icon
  const iconName = property.icon_name || "home";
  const IconComponent = getPropertyChipIcon(iconName);
  const iconColor = property.icon_color_hex || "#8EC9CE";
  
  // Calculate days since last inspection
  const lastInspectedDays = property.lastInspectedDate 
    ? differenceInDays(new Date(), new Date(property.lastInspectedDate))
    : null;

  const goToPropertyHub = () => {
    navigate(propertyHubPath(property.id));
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToPropertyHub();
    }
  };

  const isHorizontal = variant === 'horizontal';

  const contentBlock = (
    <div className={cn("flex-1 min-w-0 flex flex-col justify-center", isHorizontal ? "pt-3 pb-3 pl-3 pr-2.5" : "pt-4 pb-3 pl-2.5 pr-2.5 space-y-3")}>
      <div className="mt-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-lg text-foreground leading-tight truncate">
            {displayName}
          </h3>
          {!isHorizontal && (
            <Layers className="h-6 w-[18px] text-muted-foreground flex-shrink-0" style={{ width: '16px', height: '16px' }} />
          )}
        </div>
      </div>

      {/* Neumorphic Perforation Line - Row of cut circles */}
      <div
        className={cn("flex-shrink-0 -mr-2.5 pt-0 pb-0 px-1", isHorizontal ? "-ml-3 mt-3 mb-2" : "-ml-2.5 mb-[11px]")}
        style={{
          height: '1px',
          minHeight: '1px',
          backgroundImage: 'repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)',
          backgroundSize: '7px 1px',
          backgroundRepeat: 'repeat-x',
          boxShadow: '1px 1px 0px rgba(255, 255, 255, 1), -1px -1px 1px rgba(0, 0, 0, 0.075)',
        }}
      />

      {/* Meta Zone */}
        <div
          className={cn("!mt-0", isHorizontal ? "pt-0" : "pt-[7px]")}
        >
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
        <div className="flex items-center gap-1.5 !mt-1.5">
          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground/80">
            {lastInspectedDays !== null
              ? `Last Inspected ${lastInspectedDays} day${lastInspectedDays !== 1 ? 's' : ''} ago`
              : 'No inspections yet'
            }
          </span>
        </div>
      </div>
    </div>
  );

  const interactiveCardClass = cn(
    "cursor-pointer transition-all duration-200 active:scale-[0.99]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  );

  if (isHorizontal) {
    return (
      <div
        role="link"
        tabIndex={0}
        aria-label={`Open property ${displayName}`}
        onClick={goToPropertyHub}
        onKeyDown={handleCardKeyDown}
        className={cn(
          "bg-card/60 rounded-[12px] overflow-hidden shadow-e1 flex flex-row w-full h-[100px] items-stretch relative",
          interactiveCardClass,
          className
        )}
      >
        <ThumbnailBlock
          property={property}
          displayName={displayName}
          IconComponent={IconComponent}
          iconColor={iconColor}
          horizontal={true}
        />
        {contentBlock}
        {onAddPropertyClick && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddPropertyClick();
            }}
            className="absolute top-2 right-2 z-10 flex items-center justify-center rounded-[5px] transition-all duration-200 hover:bg-muted/30 text-muted-foreground hover:text-foreground"
            style={{ width: '20px', height: '20px' }}
            aria-label="Add property"
          >
            <Plus className="h-4 w-4" style={{ width: '16px', height: '16px' }} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Open property ${displayName}`}
      onClick={goToPropertyHub}
      onKeyDown={handleCardKeyDown}
      className={cn(
        "bg-card/60 rounded-[12px] overflow-hidden shadow-e1 h-[216px] flex flex-col",
        interactiveCardClass,
        className
      )}
    >
      <ThumbnailBlock
        property={property}
        displayName={displayName}
        IconComponent={IconComponent}
        iconColor={iconColor}
        horizontal={false}
      />
      {contentBlock}
    </div>
  );
}

