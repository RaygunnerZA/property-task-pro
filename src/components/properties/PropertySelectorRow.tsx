import { AlertTriangle, CheckSquare, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPropertyChipIcon } from "@/lib/propertyChipIcons";
import { truncatePropertySelectorHighlight } from "@/lib/propertySelectorHighlight";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type PropertySelectorRowProperty = {
  id: string;
  nickname?: string | null;
  address?: string | null;
  thumbnail_url?: string | null;
  icon_name?: string | null;
  icon_color_hex?: string | null;
  open_tasks_count?: number | null;
  expired_compliance_count?: number | null;
};

type PropertySelectorRowProps = {
  property: PropertySelectorRowProperty;
  taskCount: number;
  urgentCount: number;
  highlight?: string | null;
  isSelected?: boolean;
  isDefaultPinned?: boolean;
  onSelect: () => void;
  onToggleDefault?: () => void;
  className?: string;
};

function DefaultStarButton({
  isDefaultPinned,
  onToggleDefault,
}: {
  isDefaultPinned: boolean;
  onToggleDefault: () => void;
}) {
  return (
    <div
      className={cn(
        "shrink-0 transition-opacity",
        isDefaultPinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleDefault();
            }}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
              isDefaultPinned
                ? "text-[#EB6834]"
                : "text-muted-foreground hover:bg-muted/60 hover:text-[#EB6834]"
            )}
            aria-label={isDefaultPinned ? "Remove default property" : "Set as default"}
            aria-pressed={isDefaultPinned}
          >
            <Star className="h-3.5 w-3.5" fill={isDefaultPinned ? "currentColor" : "none"} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Set as default</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function PropertySelectorRow({
  property,
  taskCount,
  urgentCount,
  highlight,
  isSelected,
  isDefaultPinned = false,
  onSelect,
  onToggleDefault,
  className,
}: PropertySelectorRowProps) {
  const displayName = property.nickname || property.address || "Property";
  const iconName = property.icon_name || "home";
  const IconComponent = getPropertyChipIcon(iconName);
  const iconColor = property.icon_color_hex || "#8EC9CE";
  const hasUrgent = urgentCount > 0;
  const summaryLine = highlight ? truncatePropertySelectorHighlight(highlight) : null;

  const handleRowKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleRowKeyDown}
      className={cn(
        "group flex w-full min-w-0 cursor-pointer items-stretch gap-2.5 border-b border-border/40 px-2 py-2.5 last:border-b-0",
        "transition-colors hover:bg-muted/45",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isSelected && "bg-primary/[0.06]",
        className
      )}
    >
      <div
        className="relative h-[72px] w-[56px] shrink-0 overflow-hidden rounded-[8px]"
        style={{ backgroundColor: property.thumbnail_url ? undefined : iconColor }}
      >
        {property.thumbnail_url ? (
          <img src={property.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : null}
        <div
          className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full"
          style={{
            backgroundColor: iconColor,
            boxShadow:
              "2px 2px 4px rgba(0,0,0,0.08), -1px -1px 2px rgba(255,255,255,0.5), inset 1px 1px 1px rgba(255,255,255,0.3)",
          }}
        >
          <IconComponent className="h-3 w-3 text-white" />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
        <div className="flex min-w-0 items-center gap-1">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight text-foreground">
            {displayName}
          </span>
          {onToggleDefault ? (
            <DefaultStarButton
              isDefaultPinned={isDefaultPinned}
              onToggleDefault={onToggleDefault}
            />
          ) : null}
        </div>

        <div className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[11px] text-muted-foreground">
          <span className="inline-flex shrink-0 items-center gap-1">
            <CheckSquare className="h-3 w-3 opacity-70" aria-hidden />
            {taskCount} Open task{taskCount !== 1 ? "s" : ""}
          </span>
          {hasUrgent ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-destructive/90">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              {urgentCount} Urgent
            </span>
          ) : null}
        </div>

        {summaryLine ? (
          <p
            className="truncate text-[11px] leading-snug text-muted-foreground/90"
            title={highlight ?? undefined}
          >
            {summaryLine}
          </p>
        ) : null}
      </div>
    </div>
  );
}
