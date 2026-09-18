import { useNavigate } from "react-router-dom";
import { propertyHubPath } from "@/lib/propertyRoutes";
import { CheckSquare, AlertTriangle, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSpaceDisplayIllustration } from "@/lib/spaceTypeIllustrations";
import { resolveToCanonicalSpaceType } from "@/config/spaceTypeAliases";

interface SpaceCardProps {
  space: {
    id: string;
    name?: string | null;
    type?: string | null;
    property_id?: string | null;
    icon_name?: string | null;
    thumbnail_url?: string | null;
    /** Resolved space type label for illustration lookup (e.g. space_types.name). */
    spaceTypeName?: string | null;
    taskCount?: number;
    urgentTaskCount?: number;
  };
  /** Group color for mini card (from space group). Falls back to primary teal. */
  groupColor?: string;
  className?: string;
  onFilterClick?: (spaceId: string) => void;
  /** When set, card body opens this instead of navigating to the space page. */
  onOpen?: (spaceId: string) => void;
}

/**
 * Compact space card — matches EntityMiniCard visual language (centred 65×65
 * illustration, transparent fill with soft white gradient, title below).
 */
export function SpaceCard({ space, groupColor, className, onFilterClick, onOpen }: SpaceCardProps) {
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
  const illustrationSrc = getSpaceDisplayIllustration({
    name: illustrationLabel,
    thumbnail_url: space.thumbnail_url,
    spaceTypeName: space.spaceTypeName,
  });

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpen) {
      onOpen(space.id);
      return;
    }
    if (space.property_id && space.id) {
      navigate(`/properties/${space.property_id}/spaces/${space.id}`);
    } else if (space.property_id) {
      navigate(propertyHubPath(space.property_id));
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpen) {
      onOpen(space.id);
      return;
    }
    if (space.property_id && space.id) {
      navigate(`/properties/${space.property_id}/spaces/${space.id}`);
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
        "group/space-card relative flex h-full w-full flex-col overflow-hidden rounded-[10px] bg-transparent pb-[10px]",
        "shadow-[1px_1px_1px_rgba(255,255,255,0.8)]",
        "text-center transition-all duration-200",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 z-[1] rounded-[10px] bg-gradient-to-b from-transparent to-white/50"
        aria-hidden
      />

      <button
        type="button"
        onClick={handleEdit}
        className={cn(
          "absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center",
          "rounded-[6px] text-muted-foreground",
          "opacity-0 transition-opacity group-hover/space-card:opacity-100",
          "hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        )}
        aria-label={`Edit ${displayName}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={handleNavigate}
        className="relative z-[2] flex w-full flex-1 flex-col items-center rounded-[10px] text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
      >
        <span className="flex items-center justify-center px-1.5 pt-1.5">
          <span
            className="relative flex h-[65px] w-[65px] shrink-0 items-center justify-center overflow-hidden"
            style={
              !illustrationSrc
                ? { backgroundColor: `${iconColor}1f` }
                : undefined
            }
          >
            {illustrationSrc ? (
              <img
                src={illustrationSrc}
                alt=""
                className="h-[65px] w-[65px] object-cover"
                loading="lazy"
              />
            ) : null}
            {urgentCount > 0 ? (
              <span className="absolute right-0.5 top-0.5 flex items-center gap-0.5 rounded-md bg-card/90 px-1 py-0.5 font-mono text-2xs font-semibold text-destructive shadow-e1">
                <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
                {urgentCount}
              </span>
            ) : null}
          </span>
        </span>
        <span className="min-w-0 w-full px-1.5 pb-1 pt-2">
          <span className="block truncate text-sm font-semibold leading-snug text-foreground">
            {displayName}
          </span>
          {hasTasks ? (
            <span
              role="presentation"
              onClick={handleMetaZoneClick}
              className="mt-0.5 inline-flex items-center justify-center gap-1 font-mono text-2xs uppercase tracking-wide text-muted-foreground"
            >
              <CheckSquare className="h-3 w-3" aria-hidden />
              {taskCount} task{taskCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </span>
      </button>
    </div>
  );
}
