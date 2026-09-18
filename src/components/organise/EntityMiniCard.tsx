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
        "absolute inset-x-0 z-20 flex items-center justify-center px-1 text-center transition-colors",
        position === "top" && "top-0 h-1/2 rounded-t-[10px]",
        position === "bottom" && "bottom-0 h-1/2 rounded-b-[10px]",
        position === "full" && "inset-y-0 rounded-[10px]",
        isOver ? "bg-primary/85" : "bg-foreground/60"
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
 * two-zone Group / Add sub space overlay.
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
  subItems = [],
  onOpenSubItem,
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
  const hasSubItems = subItems.length > 0;

  return (
    <div className={cn("group/minicard relative", hasSubItems && "pb-3", className)}>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...(dragDisabled ? {} : listeners)}
        className={cn(
          "relative w-[132px] touch-none rounded-[10px] bg-card shadow-e1 transition-shadow",
          !dragDisabled && "cursor-grab active:cursor-grabbing",
          onOpen && "hover:shadow-md"
        )}
      >
        <button
          type="button"
          onClick={onOpen}
          disabled={!onOpen}
          className="flex w-full flex-col items-stretch rounded-[10px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          <span
            className="relative flex h-[72px] w-full items-center justify-center overflow-hidden rounded-t-[10px] bg-muted/40"
            style={accentColor ? { backgroundColor: `${accentColor}1f` } : undefined}
          >
            {thumbSrc ? (
              <img src={thumbSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span className="text-muted-foreground/80">{icon}</span>
            )}
            {badge ? <span className="absolute right-1 top-1">{badge}</span> : null}
          </span>
          <span className="min-w-0 px-2 pb-2 pt-1.5">
            <span className="block truncate text-xs font-semibold leading-snug text-foreground">
              {title}
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
            className="absolute left-1 top-1 z-10"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`${title} actions`}
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-[6px] bg-card/90 text-muted-foreground shadow-e1",
                    "opacity-0 transition-opacity focus-visible:opacity-100 group-hover/minicard:opacity-100"
                  )}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[130px]">
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
          subZone ? (
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
          )
        ) : null}
      </div>

      {/* Offset semi-concealed sub-space chip — expands down on hover */}
      {hasSubItems ? (
        <div
          className={cn(
            "absolute left-3 right-1 top-full z-10 -mt-2 rounded-b-[8px] rounded-t-[4px] bg-card/95 px-2 shadow-e1 transition-all",
            "max-h-3 overflow-hidden pt-2.5 opacity-90",
            "group-hover/minicard:max-h-40 group-hover/minicard:pb-1.5 group-hover/minicard:opacity-100"
          )}
        >
          <p className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
            {subItems.length} sub space{subItems.length === 1 ? "" : "s"}
          </p>
          <ul className="pt-0.5">
            {subItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpenSubItem?.(item.id)}
                  disabled={!onOpenSubItem}
                  className="w-full truncate rounded px-0.5 py-0.5 text-left text-2xs text-foreground/90 hover:bg-primary/10"
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
