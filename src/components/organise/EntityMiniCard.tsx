import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties, ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  miniCardGroupDroppableId,
  miniCardSubDroppableId,
  type OnboardingDragData,
} from "@/components/onboarding/onboardingAreasDnd";

export type MiniCardSubItem = { id: string; label: string };

export type MiniCardAction = {
  label: string;
  onClick: () => void;
  destructive?: boolean;
};

type EntityMiniCardProps = {
  /** Entity id — also keys the two-zone drop targets. */
  entityId: string;
  title: string;
  /** Small line under the title — area / space / category. */
  meta?: string | null;
  thumbSrc?: string | null;
  icon?: ReactNode;
  accentColor?: string;
  /** e.g. open-task count chip. */
  badge?: ReactNode;
  dragId: string;
  dragData: OnboardingDragData;
  dragDisabled?: boolean;
  onOpen?: () => void;
  /**
   * Two-zone gesture while a peer mini card is dragging
   * (@Docs/04_UI_System.md — organise views): top = Group, bottom = Add sub
   * space. Pass `subZone: false` for entities without nesting (assets).
   */
  dropCandidate?: boolean;
  subZone?: boolean;
  groupZoneLabel?: string;
  subZoneLabel?: string;
  /** Sub-spaces — offset semi-concealed chip below, expands on hover. */
  subItems?: MiniCardSubItem[];
  onOpenSubItem?: (id: string) => void;
  /** Row actions — "…" menu revealed on hover (rename / duplicate / remove). */
  actions?: MiniCardAction[];
  className?: string;
};

/** Display title — capitalise the first letter of each word. */
function toMiniCardTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return title;
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function MiniCardDropZone({
  id,
  label,
  position,
}: {
  id: string;
  label: string;
  position: "top" | "bottom" | "full";
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute inset-x-0 z-20 flex items-center justify-center px-1.5 text-center transition-colors",
        position === "top" && "top-0 h-1/2 rounded-t-[10px]",
        position === "bottom" && "bottom-0 h-1/2 rounded-b-[10px]",
        position === "full" && "inset-0 rounded-[10px]",
        isOver ? "bg-primary/90" : "bg-foreground/70"
      )}
    >
      <span
        className={cn(
          "font-mono text-2xs font-semibold uppercase tracking-wide",
          isOver ? "text-primary-foreground" : "text-background/95"
        )}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Draggable mini card — the organise-views list unit for spaces, assets and
 * records. Whole-card drag (8px activation keeps clicks working); dragging
 * drops the card to 40% opacity; while a peer drags, the card exposes the
 * two-zone Group / Add sub space overlay covering the full receiving card.
 */
export function EntityMiniCard({
  entityId,
  title,
  meta,
  thumbSrc,
  icon,
  accentColor,
  badge,
  dragId,
  dragData,
  dragDisabled = false,
  onOpen,
  dropCandidate = false,
  subZone = true,
  groupZoneLabel = "Group",
  subZoneLabel = "Add sub space",
  subItems: _subItems = [],
  onOpenSubItem: _onOpenSubItem,
  actions = [],
  className,
}: EntityMiniCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: dragData,
    disabled: dragDisabled,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    // 40% while grabbed — the spec'd pickup transparency.
    opacity: isDragging ? 0.4 : undefined,
    zIndex: isDragging ? 30 : undefined,
  };

  const showZones = dropCandidate && !isDragging;
  const displayTitle = toMiniCardTitle(title);

  return (
    <div
      className={cn(
        "group/minicard relative z-0 flex w-full flex-col",
        "hover:z-30 focus-within:z-30",
        className
      )}
    >
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...(dragDisabled ? {} : listeners)}
        className={cn(
          "relative w-full touch-none overflow-hidden rounded-[10px] bg-transparent pb-[10px]",
          "shadow-[1px_1px_1px_rgba(255,255,255,0.8)]",
          !dragDisabled && "cursor-grab active:cursor-grabbing"
        )}
      >
        {/* Paper shows through — transparent at top → 50% white at bottom */}
        <div
          className="pointer-events-none absolute inset-0 z-[1] rounded-[10px] bg-gradient-to-b from-transparent to-white/50"
          aria-hidden
        />

        <button
          type="button"
          onClick={onOpen}
          disabled={!onOpen}
          className="relative z-[2] flex w-full flex-col items-center rounded-[10px] text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          <span className="flex items-center justify-center px-1.5 pt-1.5">
            <span
              className="relative flex h-[65px] w-[65px] shrink-0 items-center justify-center overflow-hidden"
              style={accentColor && !thumbSrc ? { backgroundColor: `${accentColor}1f` } : undefined}
            >
              {thumbSrc ? (
                <img
                  src={thumbSrc}
                  alt=""
                  className="h-[65px] w-[65px] object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="text-muted-foreground/80">{icon}</span>
              )}
              {badge ? <span className="absolute right-0.5 top-0.5">{badge}</span> : null}
            </span>
          </span>
          <span className="min-w-0 w-full px-1.5 pb-1 pt-2">
            <span className="block truncate text-sm font-semibold leading-snug text-foreground">
              {displayTitle}
            </span>
            {meta ? (
              <span className="block truncate pt-0.5 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                {meta}
              </span>
            ) : null}
          </span>
        </button>

        {actions.length > 0 ? (
          <div
            className="absolute right-1 top-1 z-10"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`${displayTitle} actions`}
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-[6px] text-muted-foreground",
                    "opacity-0 transition-opacity focus-visible:opacity-100 group-hover/minicard:opacity-100"
                  )}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[130px]">
                {actions.map((action) => (
                  <DropdownMenuItem
                    key={action.label}
                    onClick={action.onClick}
                    className={cn(
                      "text-xs",
                      action.destructive && "text-destructive focus:text-destructive"
                    )}
                  >
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}

        {showZones ? (
          <div className="absolute inset-0 z-20 overflow-hidden rounded-[10px]">
            {subZone ? (
              <>
                <MiniCardDropZone
                  id={miniCardGroupDroppableId(entityId)}
                  label={groupZoneLabel}
                  position="top"
                />
                <MiniCardDropZone
                  id={miniCardSubDroppableId(entityId)}
                  label={subZoneLabel}
                  position="bottom"
                />
              </>
            ) : (
              <MiniCardDropZone
                id={miniCardGroupDroppableId(entityId)}
                label={groupZoneLabel}
                position="full"
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
