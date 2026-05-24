import { useNavigate } from "react-router-dom";
import { propertyHubPath } from "@/lib/propertyRoutes";
import { CheckSquare, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSpaceMiniCardIllustration } from "@/lib/spaceTypeIllustrations";
import { resolveToCanonicalSpaceType } from "@/config/spaceTypeAliases";

interface SpaceCardProps {
  space: {
    id: string;
    name?: string | null;
    type?: string | null;
    property_id?: string | null;
    icon_name?: string | null;
    /** Resolved space type label for illustration lookup (e.g. space_types.name). */
    spaceTypeName?: string | null;
    taskCount?: number;
    urgentTaskCount?: number;
  };
  /** Group color for mini card (from space group). Falls back to primary teal. */
  groupColor?: string;
  className?: string;
  onFilterClick?: (spaceId: string) => void;
}

export function SpaceCard({ space, groupColor, className, onFilterClick }: SpaceCardProps) {
  const navigate = useNavigate();

  const displayName = space.name || space.type || "Unnamed Space";
  const taskCount = space.taskCount ?? 0;
  const urgentCount = space.urgentTaskCount ?? 0;
  const hasTasks = taskCount > 0;

  const iconColor = groupColor ?? "#8EC9CE";
  const illustrationLabel =
    resolveToCanonicalSpaceType(space.spaceTypeName ?? space.name ?? space.type ?? "") ??
    space.spaceTypeName ??
    space.name ??
    space.type;
  const illustrationSrc = getSpaceMiniCardIllustration(illustrationLabel);

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (space.property_id && space.id) {
      navigate(`/properties/${space.property_id}/spaces/${space.id}`);
    } else if (space.property_id) {
      navigate(propertyHubPath(space.property_id));
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
        "bg-card/60 rounded-[8px] overflow-hidden shadow-e1 h-[137px]",
        "flex flex-col text-center transition-all duration-200",
        className
      )}
    >
      {/* Illustration */}
      <div
        className={cn(
          "w-full overflow-hidden relative flex items-center justify-center cursor-pointer active:scale-[0.99]",
          hasTasks ? "h-[86px] shrink-0" : "flex-1 min-h-0"
        )}
        style={{
          backgroundColor: illustrationSrc ? undefined : iconColor,
        }}
        onClick={handleNavigate}
      >
        {illustrationSrc ? (
          <img
            src={illustrationSrc}
            alt=""
            className={cn(
              "object-contain",
              hasTasks ? "h-[80px] w-[80px]" : "h-full max-h-[108px] w-auto max-w-full px-1"
            )}
            loading="lazy"
          />
        ) : null}
      </div>

      {hasTasks ? (
        <div className="px-2.5 pb-2 pt-0 flex flex-col items-center gap-1.5 h-[68px] shrink-0">
          <div onClick={handleNavigate} className="cursor-pointer active:scale-[0.99] w-full">
            <h3 className="font-semibold text-sm text-foreground leading-[15px] line-clamp-2">
              {displayName}
            </h3>
          </div>

          <div
            className="w-full px-1"
            style={{
              height: "1px",
              backgroundImage:
                "repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)",
              backgroundSize: "7px 1px",
              backgroundRepeat: "repeat-x",
              boxShadow: "1px 1px 0px rgba(255, 255, 255, 1), -1px -1px 1px rgba(0, 0, 0, 0.075)",
            }}
          />

          <div onClick={handleMetaZoneClick} className="cursor-pointer active:scale-[0.99] w-full">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckSquare className="h-3 w-3" />
                {taskCount} Task{taskCount !== 1 ? "s" : ""}
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
      ) : (
        <div
          onClick={handleNavigate}
          className="px-2.5 pb-2.5 pt-1 shrink-0 cursor-pointer active:scale-[0.99]"
        >
          <h3 className="font-semibold text-sm text-foreground leading-[15px] line-clamp-2">
            {displayName}
          </h3>
        </div>
      )}
    </div>
  );
}
