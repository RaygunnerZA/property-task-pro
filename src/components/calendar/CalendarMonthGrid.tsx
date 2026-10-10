import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type TransitionEvent,
} from "react";
import { createPortal } from "react-dom";
import { Plus, Repeat } from "lucide-react";
import {
  addDays,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  rectIntersection,
  MeasuringStrategy,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import {
  resolveCalendarChipBackground,
  resolveCalendarChipColor,
} from "@/lib/calendarSeriesColor";
import {
  buildCalendarPlacements,
  buildScheduleUpdate,
  groupPlacementsByDate,
  parseDropTargetId,
  parsePlacementDragId,
  weekIsAfternoonOnly,
  weekNeedsExpandedHeight,
  type CalendarTaskPlacement,
} from "@/lib/calendarTaskSchedule";

const WEEKDAY_LABELS_SHORT = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
const WEEKDAY_LABELS_FULL = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

/** Show full weekday names when a day column is at least this wide. */
const WEEKDAY_FULL_NAME_MIN_PX = 65;

/** Flush task chips to the cell edges at this width or below. */
const DAY_CELL_FLUSH_MAX_PX = 65;

/**
 * Week row: minimise when events sit in only morning or only afternoon.
 * Expand when both halves are needed, or a day stacks 2+ events.
 * Compact rows use minmax(auto) so a single short chip doesn't leave a tall empty half.
 */
const CALENDAR_ROW_MINIMAL_PX = 48;
const CALENDAR_ROW_EXPANDED_PX = 118;

const HAND_CHIP_HEIGHT = 42;
const HAND_CHIP_COMPACT_HEIGHT = 22;

/** Shared neo chip chrome — the frame around this button animates width and height. */
const CALENDAR_TASK_CHIP_BASE_CLASS =
  "flex h-full w-full min-w-0 cursor-grab touch-none rounded text-left text-2xs active:cursor-grabbing shadow-[2px_2px_2px_0px_rgba(0,0,0,0.2),inset_1px_1px_1px_0px_rgba(255,255,255,0.8)] overflow-hidden transition-[height,width,margin,padding,box-shadow] duration-[320ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none";

/** Lifted chip: soft drop, larger than the resting neo shadow. */
const CHIP_REVEAL_SHADOW_CLASS =
  "z-30 shadow-[0_18px_40px_rgba(0,0,0,0.22),0_6px_16px_rgba(0,0,0,0.14),inset_1px_1px_1px_0px_rgba(255,255,255,0.85)]";

/** Fixed size for every task chip in the month grid (title + property rows). */
const CALENDAR_TASK_CHIP_CLASS = cn(
  CALENDAR_TASK_CHIP_BASE_CLASS,
  "flex-col pt-[3px] pb-0.5 leading-tight"
);

/** Single-line chip while click-and-hold / dragging (morning ↔ afternoon). */
const CALENDAR_TASK_CHIP_COMPACT_CLASS = cn(
  CALENDAR_TASK_CHIP_BASE_CLASS,
  "items-center py-0 leading-none"
);

const CALENDAR_TASK_CHIP_COMPACT_REVEAL_CLASS = cn(
  CALENDAR_TASK_CHIP_BASE_CLASS,
  "items-start py-0.5 leading-snug"
);

/** Gap between stacked hand cards while expanded (Tailwind gap-0.5). */
const HAND_STACK_GAP_PX = 2;

/** Fan → stack geometry + title grow. Paper unfold. */
const HAND_EXPAND_MS = 320;

/** Title reveal — width and height ease together (motion settle / unfold). */
const CHIP_REVEAL_MS = 320;
const CHIP_REVEAL_EASE = "cubic-bezier(0.2, 0, 0, 1)";

/**
 * Hovered chip may cover up to half of each neighbouring day.
 * Monday only reaches right; Sunday only reaches left.
 */
function chipRevealBox(columnIndex: number, baseWidth = 0): { width: string; marginLeft: string } {
  if (baseWidth <= 0) {
    if (columnIndex <= 0) return { width: "calc(150% + 3px)", marginLeft: "0px" };
    if (columnIndex >= 6) return { width: "calc(150% + 3px)", marginLeft: "calc(-50% - 3px)" };
    return { width: "calc(200% + 6px)", marginLeft: "calc(-50% - 3px)" };
  }
  const side = Math.round(baseWidth / 2 + 3);
  if (columnIndex <= 0) {
    return { width: `${Math.round(baseWidth + side)}px`, marginLeft: "0px" };
  }
  if (columnIndex >= 6) {
    return { width: `${Math.round(baseWidth + side)}px`, marginLeft: `${-side}px` };
  }
  return { width: `${Math.round(baseWidth + side * 2)}px`, marginLeft: `${-side}px` };
}

/** Match TouchSensor delay so the chip collapses as drag arms. */
const CALENDAR_CHIP_HOLD_MS = 150;

/** Prefer morning/afternoon drop zones under the pointer (ignore chip hit targets). */
const calendarDropCollision: CollisionDetection = (args) => {
  const dropsOnly = (collisions: ReturnType<CollisionDetection>) =>
    collisions.filter((c) => String(c.id).startsWith("drop|"));

  const pointerHits = dropsOnly(pointerWithin(args));
  if (pointerHits.length > 0) return pointerHits;

  return dropsOnly(rectIntersection(args));
};

type CalendarMonthGridProps = {
  month: Date;
  tasks: unknown[];
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  /** Empty-day double-click, or date-numeral click when the day already has tasks. */
  onCreateForDate?: (date: Date) => void;
  onTaskClick?: (taskId: string) => void;
  onTaskReschedule?: (
    taskId: string,
    updates: { due_date?: string | null; milestones?: Array<{ id: string; dateTime: string; label?: string }> }
  ) => void | Promise<void>;
  selectedTaskId?: string | null;
  propertyMap: Map<string, { nickname?: string; name?: string; address?: string }>;
};

function taskPriorityDotClass(priority?: string | null): string | null {
  const normalized = priority?.toLowerCase();
  if (normalized === "urgent") return "bg-destructive";
  if (normalized === "high") return "bg-warning-vivid";
  return null;
}

function taskPropertyLabel(
  task: { property_id?: string; property_name?: string },
  propertyMap: Map<string, { nickname?: string; name?: string; address?: string }>
): string {
  if (task.property_name?.trim()) return task.property_name.trim();
  if (task.property_id) {
    const p = propertyMap.get(task.property_id);
    return (p?.nickname || p?.name || p?.address || "").trim();
  }
  return "";
}

/** Morning / afternoon halves of the cell body (below the date numeral). */
function periodSlotClass(period: "morning" | "afternoon"): string {
  return period === "morning"
    ? "absolute inset-x-0 top-0 bottom-1/2 z-[1]"
    : "absolute inset-x-0 top-1/2 bottom-0 z-[1]";
}

type CalendarTaskChipProps = {
  placement: CalendarTaskPlacement;
  propertyMap: Map<string, { nickname?: string; name?: string; address?: string }>;
  selectedTaskId?: string | null;
  onTaskClick?: (taskId: string) => void;
  isDragOverlay?: boolean;
  /** Single-line chip while click-and-hold / drag so morning ↔ afternoon halves are reachable. */
  singleLine?: boolean;
  /** Solid fill — used when chips fan/stack so text cannot ghost through. */
  opaque?: boolean;
  /** Deeper neo shadow while a hand is expanded on hover. */
  elevated?: boolean;
  /** Force full title wrap (stacked hand expanded). */
  revealFullTitle?: boolean;
  /** Solo chips: hover expands truncated titles. Off inside a fanned hand. */
  allowHoverReveal?: boolean;
  /** 0 = Monday … 6 = Sunday. Caps how far a hover chip may overlap. */
  columnIndex?: number;
  /** Narrow day cells: drop horizontal chip padding so cards sit edge-to-edge. */
  flushEdges?: boolean;
  /** Position in a same-period hand (0 = furthest back / earliest). */
  stackIndex?: number;
  stackCount?: number;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
};

function CalendarTaskChip({
  placement,
  propertyMap,
  selectedTaskId,
  onTaskClick,
  isDragOverlay,
  singleLine = false,
  opaque = false,
  elevated = false,
  revealFullTitle: revealFullTitleProp = false,
  allowHoverReveal = true,
  columnIndex = 0,
  flushEdges = false,
  stackIndex = 0,
  stackCount = 1,
  onHoldStart,
  onHoldEnd,
}: CalendarTaskChipProps) {
  const task = placement.task as {
    id: string;
    title?: string;
    property_id?: string;
    property_name?: string;
    priority?: string | null;
  };
  const priorityDotClass = taskPriorityDotClass(task.priority);
  /** Property name is redundant when only one property exists in scope. */
  const propertyLabel =
    propertyMap.size > 1 ? taskPropertyLabel(task, propertyMap) : "";
  const { baseColor, isSeriesColor } = resolveCalendarChipColor(placement.task);
  const isRepeat = placement.source === "repeat";
  const compact = singleLine || isRepeat;
  const collapsedHeight = compact ? HAND_CHIP_COMPACT_HEIGHT : HAND_CHIP_HEIGHT;

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const titleRef = useRef<HTMLSpanElement | null>(null);
  const revealTokenRef = useRef(0);
  const [hovered, setHovered] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  /** Unclamp title while open / while collapsing so height can slide. */
  const [unwrapTitle, setUnwrapTitle] = useState(false);
  const [widen, setWiden] = useState(false);
  const [animHeight, setAnimHeight] = useState(collapsedHeight);
  const [revealBox, setRevealBox] = useState({ width: "100%", marginLeft: "0px" });
  /** Solo chips widen themselves. A fanned hand widens its own frame. */
  const spread = allowHoverReveal && widen;

  const wantsReveal =
    Boolean(revealFullTitleProp) ||
    (allowHoverReveal &&
      hovered &&
      isTruncated &&
      !isDragOverlay &&
      !singleLine);

  // When a DragOverlay is active, leave the source chip in place (dimmed) —
  // applying `transform` here AND rendering an overlay causes a cursor offset.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: placement.id,
    data: { placement },
    disabled: isDragOverlay,
  });

  const setButtonRef = useCallback(
    (node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      if (!isDragOverlay) setNodeRef(node);
    },
    [isDragOverlay, setNodeRef]
  );

  const floating = spread || elevated || revealFullTitleProp || unwrapTitle;
  const chipBackground = resolveCalendarChipBackground(placement.task, isRepeat, {
    opaque,
    floating,
    stackIndex,
    stackCount,
  });
  const title = task.title || "Task";

  // Detect clipped title only while collapsed — hover expand only when text is hidden.
  useLayoutEffect(() => {
    if (unwrapTitle || isDragOverlay) return;
    const titleEl = titleRef.current;
    if (!titleEl) {
      setIsTruncated(false);
      return;
    }
    const clipped =
      titleEl.scrollHeight > titleEl.clientHeight + 1 ||
      titleEl.scrollWidth > titleEl.clientWidth + 1;
    setIsTruncated(clipped);
  }, [
    title,
    propertyLabel,
    compact,
    flushEdges,
    unwrapTitle,
    isDragOverlay,
    collapsedHeight,
  ]);

  // Unwrap first (still at collapsed height), then measure and slide open after paint.
  useLayoutEffect(() => {
    if (wantsReveal) {
      setUnwrapTitle(true);
      return;
    }
    revealTokenRef.current += 1;
    setWiden(false);
    setRevealBox({ width: "100%", marginLeft: "0px" });
    setAnimHeight(collapsedHeight);
  }, [wantsReveal, collapsedHeight]);

  useLayoutEffect(() => {
    if (!wantsReveal || !unwrapTitle) return;
    const el = buttonRef.current;
    if (!el) return;

    const sizer = el.parentElement?.parentElement;
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;height:auto;";
    const baseWidth = sizer?.clientWidth ?? el.parentElement?.clientWidth ?? 0;
    const nextBox = chipRevealBox(columnIndex, baseWidth);
    probe.style.width = allowHoverReveal ? nextBox.width : "100%";
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.height = "auto";
    clone.style.width = "100%";
    probe.appendChild(clone);
    (sizer ?? el.parentElement ?? document.body).appendChild(probe);
    const fullHeight = clone.scrollHeight;
    probe.remove();
    const nextHeight = Math.max(fullHeight, collapsedHeight);
    // Wait a beat so the transition is already on the element before the size changes.
    const token = ++revealTokenRef.current;
    window.setTimeout(() => {
      if (revealTokenRef.current !== token) return;
      setAnimHeight((current) => (current === nextHeight ? current : nextHeight));
      if (allowHoverReveal) {
        setRevealBox(nextBox);
        setWiden(true);
      }
    }, 16);
  }, [
    wantsReveal,
    unwrapTitle,
    title,
    propertyLabel,
    compact,
    flushEdges,
    collapsedHeight,
    allowHoverReveal,
    columnIndex,
  ]);

  // Keep collapsed height in sync when compact mode toggles mid-drag.
  useEffect(() => {
    if (!wantsReveal && !unwrapTitle) {
      setAnimHeight(collapsedHeight);
    }
  }, [collapsedHeight, wantsReveal, unwrapTitle]);

  // Re-clamp after close; timeout covers prefers-reduced-motion (no transitionend).
  useEffect(() => {
    if (wantsReveal || !unwrapTitle) return;
    const timer = window.setTimeout(() => {
      setUnwrapTitle(false);
    }, CHIP_REVEAL_MS + 40);
    return () => window.clearTimeout(timer);
  }, [wantsReveal, unwrapTitle]);

  const handleRevealTransitionEnd = useCallback(
    (event: TransitionEvent<HTMLDivElement>) => {
      if (event.propertyName !== "height") return;
      if (event.target !== event.currentTarget) return;
      if (!wantsReveal) {
        setUnwrapTitle(false);
      }
    },
    [wantsReveal]
  );

  const shellClass = compact
    ? unwrapTitle
      ? CALENDAR_TASK_CHIP_COMPACT_REVEAL_CLASS
      : CALENDAR_TASK_CHIP_COMPACT_CLASS
    : cn(CALENDAR_TASK_CHIP_CLASS, unwrapTitle && "pb-1");

  const revealFullTitle = unwrapTitle;

  return (
    <div
      className={cn(
        "relative w-full min-w-0 shrink-0 motion-reduce:transition-none",
        spread && "z-30"
      )}
      style={{
        height: animHeight,
        minHeight: animHeight,
        transitionProperty: "height, min-height",
        transitionDuration: `${CHIP_REVEAL_MS}ms`,
        transitionTimingFunction: CHIP_REVEAL_EASE,
      }}
      onTransitionEnd={handleRevealTransitionEnd}
    >
    <div
      className={cn(
        "absolute top-0 motion-reduce:transition-none",
        spread && CHIP_REVEAL_SHADOW_CLASS
      )}
      style={{
        height: spread ? animHeight : collapsedHeight,
        width: spread ? revealBox.width : "100%",
        marginLeft: spread ? revealBox.marginLeft : "0px",
        transitionProperty: "width, margin-left, height, box-shadow",
        transitionDuration: `${CHIP_REVEAL_MS}ms`,
        transitionTimingFunction: CHIP_REVEAL_EASE,
      }}
    >
    <button
      ref={setButtonRef}
      type="button"
      style={{ backgroundColor: chipBackground }}
      {...(isDragOverlay ? {} : { ...listeners, ...attributes })}
      onPointerDown={(e) => {
        listeners?.onPointerDown?.(e);
        onHoldStart?.();
      }}
      onPointerUp={() => onHoldEnd?.()}
      onPointerCancel={() => onHoldEnd?.()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onTaskClick?.(task.id);
      }}
      className={cn(
        shellClass,
        flushEdges ? "px-0.5" : "pl-3 pr-0.5",
        isRepeat &&
          cn(
            "shadow-[1px_1px_1px_0px_rgba(0,0,0,0.08),inset_1px_1px_1px_0px_rgba(255,255,255,0.55)]",
            !flushEdges && "pl-1.5"
          ),
        elevated && !spread && CHIP_REVEAL_SHADOW_CLASS,
        isDragging && !isDragOverlay && "opacity-40",
        isDragOverlay && "w-full cursor-grabbing shadow-md ring-1 ring-white/30"
      )}
    >
      {priorityDotClass && !isRepeat ? (
        <span
          className={cn(
            "pointer-events-none absolute rounded-full",
            flushEdges ? "left-0.5" : "left-1",
            compact && !revealFullTitle
              ? "top-1/2 h-[4px] w-[4px] -translate-y-1/2"
              : "top-1.5 h-[5px] w-[5px]",
            priorityDotClass
          )}
          aria-hidden
        />
      ) : null}
      {compact ? (
        <span
          className={cn(
            "flex min-w-0 flex-1 items-start gap-0.5",
            priorityDotClass && !isRepeat && (flushEdges ? "pl-2" : "pl-0")
          )}
        >
          {isRepeat ? (
            <Repeat
              className={cn(
                "mt-0.5 h-2.5 w-2.5 shrink-0",
                isSeriesColor ? "text-ink/55" : "text-ink/35"
              )}
              style={isSeriesColor ? { color: baseColor } : undefined}
              aria-hidden
            />
          ) : null}
          <span
            ref={titleRef}
            className={cn(
              "min-w-0 flex-1",
              revealFullTitle ? "whitespace-normal break-words" : "truncate",
              isRepeat
                ? isSeriesColor
                  ? "font-medium text-ink/75"
                  : "font-normal text-ink/50"
                : "font-medium text-ink"
            )}
            title={isRepeat ? `${title} (repeats)` : title}
          >
            {title}
          </span>
        </span>
      ) : (
        <>
          <span
            ref={titleRef}
            className={cn(
              "min-h-0 flex-1 font-medium leading-[11px] text-ink",
              priorityDotClass && (flushEdges ? "pl-2" : "pl-0"),
              revealFullTitle
                ? "overflow-visible whitespace-normal break-words"
                : "overflow-hidden line-clamp-2"
            )}
            title={title}
          >
            {title}
          </span>
          {propertyLabel ? (
            <span className="shrink-0 truncate text-2xs leading-none text-ink opacity-90">
              {propertyLabel}
            </span>
          ) : null}
        </>
      )}
    </button>
    </div>
    </div>
  );
}

type DayDropZoneProps = {
  dateKey: string;
  period: "morning" | "afternoon";
  isDragging: boolean;
};

function DayDropZone({ dateKey, period, isDragging }: DayDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop|${dateKey}|${period}`,
    data: { dateKey, period },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        // Above chips while dragging so halves stay targetable in compact rows.
        isDragging ? "pointer-events-auto z-[4]" : "pointer-events-none z-0",
        periodSlotClass(period),
        isDragging && "bg-muted/15",
        isDragging && isOver && "bg-primary/15 ring-1 ring-inset ring-primary/30"
      )}
      aria-hidden
    />
  );
}

function handChipHeight(placement: CalendarTaskPlacement): number {
  return placement.source === "repeat" ? HAND_CHIP_COMPACT_HEIGHT : HAND_CHIP_HEIGHT;
}

type PeriodHandGroup = {
  period: CalendarTaskPlacement["period"];
  items: CalendarTaskPlacement[];
};

/** Morning → afternoon → untimed groups (empty groups omitted). */
function groupPlacementsIntoHands(
  placements: CalendarTaskPlacement[]
): PeriodHandGroup[] {
  const buckets: PeriodHandGroup[] = [
    { period: "morning", items: [] },
    { period: "afternoon", items: [] },
    { period: "untimed", items: [] },
  ];
  for (const placement of placements) {
    const bucket = buckets.find((b) => b.period === placement.period);
    bucket?.items.push(placement);
  }
  return buckets.filter((b) => b.items.length > 0);
}

type CalendarEventHandProps = {
  items: CalendarTaskPlacement[];
  propertyMap: Map<string, { nickname?: string; name?: string; address?: string }>;
  selectedTaskId?: string | null;
  onTaskClick?: (taskId: string) => void;
  isDragging: boolean;
  flushEdges?: boolean;
  columnIndex?: number;
  onExpandedChange?: (expanded: boolean) => void;
};

/**
 * Same-period multi-event layout: opaque chips fanned horizontally inside the cell;
 * on hover, deal into a vertical stack with each card sized to its full title.
 * Geometry stays on one DOM tree so fan → stack can ease instead of remounting.
 */
function CalendarEventHand({
  items,
  propertyMap,
  selectedTaskId,
  onTaskClick,
  isDragging,
  flushEdges = false,
  columnIndex = 0,
  onExpandedChange,
}: CalendarEventHandProps) {
  const revealBox = chipRevealBox(columnIndex);
  const [expanded, setExpanded] = useState(false);
  const n = items.length;
  const restHeight = Math.max(...items.map(handChipHeight));
  // Keep every card inside the cell: total horizontal peek ≤ 36% of width.
  const peekFraction = Math.min(0.14, 0.36 / Math.max(n - 1, 1));
  const fanWidthPercent = 100 - (n - 1) * peekFraction * 100;

  const chipWrapRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [chipHeights, setChipHeights] = useState(() => items.map(handChipHeight));

  const setExpandedSafe = useCallback(
    (next: boolean) => {
      if (isDragging) {
        setExpanded(false);
        onExpandedChange?.(false);
        return;
      }
      setExpanded(next);
      onExpandedChange?.(next);
    },
    [isDragging, onExpandedChange]
  );

  useEffect(() => {
    if (isDragging) setExpandedSafe(false);
  }, [isDragging, setExpandedSafe]);

  useEffect(
    () => () => {
      onExpandedChange?.(false);
    },
    [onExpandedChange]
  );

  useLayoutEffect(() => {
    chipWrapRefs.current = chipWrapRefs.current.slice(0, n);
    const measure = () => {
      setChipHeights((prev) => {
        const next = items.map((placement, index) => {
          const el = chipWrapRefs.current[index];
          return el?.offsetHeight || handChipHeight(placement);
        });
        if (
          prev.length === next.length &&
          prev.every((height, index) => height === next[index])
        ) {
          return prev;
        }
        return next;
      });
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;

    const observers = items.map((_, index) => {
      const el = chipWrapRefs.current[index];
      if (!el) return null;
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return ro;
    });

    return () => {
      observers.forEach((ro) => ro?.disconnect());
    };
  }, [items, n, expanded]);

  const stackTops = useMemo(() => {
    const tops: number[] = [];
    let cursor = 0;
    for (let i = 0; i < n; i++) {
      tops.push(cursor);
      cursor += chipHeights[i] ?? handChipHeight(items[i]);
      if (i < n - 1) cursor += HAND_STACK_GAP_PX;
    }
    return tops;
  }, [chipHeights, items, n]);

  const stackHeight =
    n === 0
      ? restHeight
      : (stackTops[n - 1] ?? 0) + (chipHeights[n - 1] ?? restHeight);

  return (
    <div
      className={cn(
        "relative w-full shrink-0 overflow-visible transition-[height] duration-[320ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
        expanded ? "z-40" : "z-[1]"
      )}
        style={{
          height: expanded ? stackHeight : restHeight,
          transitionDuration: `${HAND_EXPAND_MS}ms`,
          transitionTimingFunction: CHIP_REVEAL_EASE,
        }}
      onMouseEnter={() => setExpandedSafe(true)}
      onMouseLeave={() => setExpandedSafe(false)}
      onFocusCapture={() => setExpandedSafe(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setExpandedSafe(false);
        }
      }}
    >
      {items.map((placement, index) => (
        <div
          key={placement.id}
          ref={(el) => {
            chipWrapRefs.current[index] = el;
          }}
          className="absolute top-0 transition-[top,left,width,margin] duration-[320ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none"
          style={{
            top: expanded ? stackTops[index] : 0,
            left: expanded ? revealBox.marginLeft : `${index * peekFraction * 100}%`,
            width: expanded ? revealBox.width : `${fanWidthPercent}%`,
            zIndex: index + 1,
            transitionDuration: `${HAND_EXPAND_MS}ms`,
            transitionTimingFunction: CHIP_REVEAL_EASE,
          }}
        >
          <CalendarTaskChip
            placement={placement}
            propertyMap={propertyMap}
            selectedTaskId={selectedTaskId}
            onTaskClick={onTaskClick}
            opaque
            elevated={expanded}
            revealFullTitle={expanded}
            allowHoverReveal={false}
            columnIndex={columnIndex}
            flushEdges={flushEdges}
            stackIndex={index}
            stackCount={n}
          />
        </div>
      ))}
    </div>
  );
}

type CalendarDayCellProps = {
  date: Date;
  month: Date;
  placements: CalendarTaskPlacement[];
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  onCreateForDate?: (date: Date) => void;
  onTaskClick?: (taskId: string) => void;
  selectedTaskId?: string | null;
  propertyMap: Map<string, { nickname?: string; name?: string; address?: string }>;
  isDragging: boolean;
  isWeekendColumn?: boolean;
  /** Half-height week (single period); expands when morning and afternoon both appear. */
  compact?: boolean;
  /** Compact week whose timed events are afternoon-only — pin chips to the bottom half. */
  afternoonOnly?: boolean;
  /** Narrow cells: flush task cards to the cell edges. */
  flushEdges?: boolean;
  /** 0 = Monday … 6 = Sunday. */
  columnIndex?: number;
};

function CalendarDayCell({
  date,
  month,
  placements,
  selectedDate,
  onDateSelect,
  onCreateForDate,
  onTaskClick,
  selectedTaskId,
  propertyMap,
  isDragging,
  isWeekendColumn = false,
  compact = false,
  afternoonOnly = false,
  flushEdges = false,
  columnIndex = 0,
}: CalendarDayCellProps) {
  const dateKey = format(date, "yyyy-MM-dd");
  const inMonth = isSameMonth(date, month);
  const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
  const isTodayDate = isToday(date);
  const [holding, setHolding] = useState(false);
  const [handExpanded, setHandExpanded] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const handExpandCountRef = useRef(0);

  const onHandExpandedChange = useCallback((expanded: boolean) => {
    handExpandCountRef.current = Math.max(
      0,
      handExpandCountRef.current + (expanded ? 1 : -1)
    );
    setHandExpanded(handExpandCountRef.current > 0);
  }, []);

  const rowMinHeight = compact ? CALENDAR_ROW_MINIMAL_PX : CALENDAR_ROW_EXPANDED_PX;
  const singleEvent = placements.length === 1;
  const occupied = placements.length > 0;
  const dateLabel = format(date, "MMMM d");
  const hands = useMemo(() => groupPlacementsIntoHands(placements), [placements]);
  const hasMultiHand = hands.some((hand) => hand.items.length > 1);

  /**
   * Half-day pins (morning → top, afternoon → bottom) only for single chips per
   * period. Same-period multiples use the opaque hand fan instead.
   */
  const collapseForPeriodMove =
    singleEvent && ((compact && holding) || isDragging);

  const morningCount = placements.filter((p) => p.period === "morning").length;
  const afternoonCount = placements.filter((p) => p.period === "afternoon").length;
  const hasUntimed = placements.some((p) => p.period === "untimed");
  const useHalfDayPins =
    !compact &&
    !hasMultiHand &&
    !hasUntimed &&
    morningCount <= 1 &&
    afternoonCount <= 1;

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const startHold = useCallback(() => {
    if (!compact || !singleEvent) return;
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      setHolding(true);
      holdTimerRef.current = null;
    }, CALENDAR_CHIP_HOLD_MS);
  }, [clearHoldTimer, compact, singleEvent]);

  const endHold = useCallback(() => {
    clearHoldTimer();
    if (!isDragging) setHolding(false);
  }, [clearHoldTimer, isDragging]);

  useEffect(() => {
    if (!isDragging) setHolding(false);
  }, [isDragging]);

  useEffect(() => () => clearHoldTimer(), [clearHoldTimer]);

  const handleCreate = useCallback(() => {
    onCreateForDate?.(date);
  }, [date, onCreateForDate]);

  const fillRow = !compact || isDragging;
  const fullCellCreate = Boolean(onCreateForDate) && !occupied;

  const dateNumberClassName = cn(
    "relative inline-flex shrink-0 items-center justify-center rounded-sharp font-mono text-caption font-medium",
    flushEdges ? "mx-0.5" : "-mx-px",
    // Below expanded hands so stacked cards aren't clipped by the date badge.
    handExpanded ? "z-[1]" : "z-[2]",
    compact ? "h-5 w-5" : "h-6 w-6",
    // Mute date chrome only — task chips must keep full colour on weekends / out-of-month.
    (isWeekendColumn || !inMonth) && "opacity-50"
  );

  const dateNumberInner = (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-sharp",
        compact ? "h-5 w-5" : "h-6 w-6",
        isSelected && "bg-white text-foreground opacity-100",
        isTodayDate && !isSelected && "ring-1 ring-accent/60",
        !inMonth && !isSelected && "text-muted-foreground/50"
      )}
    >
      {date.getDate()}
    </span>
  );

  return (
    <div
      className={cn(
        "calendar-day-cell group relative flex flex-col text-left select-none",
        "min-w-0 overflow-visible",
        flushEdges ? "px-0 pt-[3px]" : "px-[3px] pt-[3px]",
        fillRow ? "h-full pb-1.5" : "h-auto pb-0.5",
        // Hovered chips paint over the neighbouring days they overlap.
        handExpanded && "z-30",
        "hover:z-30 focus-within:z-30"
      )}
      style={{ minHeight: isDragging ? CALENDAR_ROW_EXPANDED_PX : rowMinHeight }}
      onDoubleClick={() => {
        if (!occupied) handleCreate();
      }}
    >
      {fullCellCreate ? (
        <span className={dateNumberClassName} aria-hidden>
          {dateNumberInner}
        </span>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDateSelect?.(date);
          }}
          aria-label={`Select ${dateLabel}`}
          className={dateNumberClassName}
        >
          {dateNumberInner}
        </button>
      )}

      {fullCellCreate ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCreate();
          }}
          className={cn(
            "absolute inset-0 z-[3] flex items-center justify-center rounded-[5px] bg-transparent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            isDragging && "pointer-events-none"
          )}
          aria-label={`Create task on ${dateLabel}`}
          title={`Create task on ${dateLabel}`}
        >
          <Plus
            className="calendar-day-cell__add h-5 w-5 text-primary icon-shadow-neu-pressed"
            strokeWidth={2.25}
            aria-hidden
          />
        </button>
      ) : null}
      <div
        className={cn(
          "relative flex min-h-min flex-col",
          fillRow ? "flex-1" : "min-h-[22px]",
          // Title reveal / stacked hands may spill past the cell.
          "z-[1] overflow-visible",
          handExpanded && "z-20"
        )}
      >
        <DayDropZone dateKey={dateKey} period="morning" isDragging={isDragging} />
        <DayDropZone dateKey={dateKey} period="afternoon" isDragging={isDragging} />
        <div
          className={cn(
            "relative flex min-h-min flex-col gap-0.5 overflow-visible",
            fillRow && "flex-1",
            handExpanded ? "z-20" : "z-[1]",
            collapseForPeriodMove && fillRow && "h-full",
            // Source chips must not steal the drop target under the pointer.
            isDragging && "pointer-events-none"
          )}
        >
          {hands.map((hand) => {
            if (hand.items.length > 1) {
              return (
                <CalendarEventHand
                  key={`${dateKey}-${hand.period}`}
                  items={hand.items}
                  propertyMap={propertyMap}
                  selectedTaskId={selectedTaskId}
                  onTaskClick={onTaskClick}
                  isDragging={isDragging}
                  flushEdges={flushEdges}
                  columnIndex={columnIndex}
                  onExpandedChange={onHandExpandedChange}
                />
              );
            }

            const placement = hand.items[0];
            const period = placement.period;
            const pinExpanded =
              useHalfDayPins && (period === "morning" || period === "afternoon");
            const pinHold =
              collapseForPeriodMove && (period === "morning" || period === "afternoon");
            const pinAfternoonCompact =
              compact && afternoonOnly && period === "afternoon" && !collapseForPeriodMove;
            const pinAbsolute = pinExpanded || pinHold;
            return (
              <div
                key={placement.id}
                className={cn(
                  "min-w-0 shrink-0",
                  pinAbsolute && "absolute inset-x-0 z-[1]",
                  pinAbsolute && period === "morning" && "top-0",
                  pinAbsolute && period === "afternoon" && "bottom-0",
                  pinAfternoonCompact && "mt-auto"
                )}
              >
                <CalendarTaskChip
                  placement={placement}
                  propertyMap={propertyMap}
                  selectedTaskId={selectedTaskId}
                  onTaskClick={onTaskClick}
                  singleLine={collapseForPeriodMove}
                  flushEdges={flushEdges}
                  columnIndex={columnIndex}
                  onHoldStart={startHold}
                  onHoldEnd={endHold}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function weekDateKeys(week: Date[]): string[] {
  return week.map((date) => format(date, "yyyy-MM-dd"));
}

export function CalendarMonthGrid({
  month,
  tasks,
  selectedDate,
  onDateSelect,
  onCreateForDate,
  onTaskClick,
  onTaskReschedule,
  selectedTaskId,
  propertyMap,
}: CalendarMonthGridProps) {
  const [activePlacement, setActivePlacement] = useState<CalendarTaskPlacement | null>(null);
  /** Lock overlay width to the source chip so it doesn't jump size under the cursor. */
  const [activeChipWidth, setActiveChipWidth] = useState<number | null>(null);
  const [showFullWeekdayNames, setShowFullWeekdayNames] = useState(false);
  const [flushEdges, setFlushEdges] = useState(false);
  const weekdayHeaderRef = useRef<HTMLDivElement>(null);
  const daysGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const headerEl = weekdayHeaderRef.current;
    const daysEl = daysGridRef.current;
    if ((!headerEl && !daysEl) || typeof ResizeObserver === "undefined") return;

    const update = () => {
      const sample =
        (daysEl?.firstElementChild as HTMLElement | null) ??
        (headerEl?.firstElementChild as HTMLElement | null);
      const cellWidth =
        sample?.getBoundingClientRect().width ??
        (daysEl ?? headerEl)!.clientWidth / 7;
      setShowFullWeekdayNames(cellWidth >= WEEKDAY_FULL_NAME_MIN_PX);
      setFlushEdges(cellWidth <= DAY_CELL_FLUSH_MAX_PX);
    };

    update();
    const ro = new ResizeObserver(update);
    if (headerEl) ro.observe(headerEl);
    if (daysEl) ro.observe(daysEl);
    return () => ro.disconnect();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    let cursor = startOfWeek(monthStart, { weekStartsOn: 1 });
    const rows: Date[][] = [];
    while (cursor <= monthEnd || rows.length < 6) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(addDays(cursor, i));
      }
      rows.push(week);
      cursor = addDays(cursor, 7);
      if (rows.length >= 6 && cursor > monthEnd) break;
    }
    return rows;
  }, [month]);

  const placementsByDate = useMemo(() => {
    return groupPlacementsByDate(buildCalendarPlacements(tasks));
  }, [tasks]);

  /** Per-week row height: minimise unless morning and afternoon both appear. */
  const weekExpanded = useMemo(
    () =>
      weeks.map((week) => weekNeedsExpandedHeight(weekDateKeys(week), placementsByDate)),
    [weeks, placementsByDate]
  );

  const weekAfternoonOnly = useMemo(
    () =>
      weeks.map((week) => weekIsAfternoonOnly(weekDateKeys(week), placementsByDate)),
    [weeks, placementsByDate]
  );

  const isDraggingAny = activePlacement != null;

  /** Expand all week rows while dragging so morning/afternoon halves are large enough to hit. */
  const gridTemplateRows = useMemo(() => {
    if (isDraggingAny) {
      return weeks.map(() => `${CALENDAR_ROW_EXPANDED_PX}px`).join(" ");
    }
    return weekExpanded
      .map((expanded) =>
        expanded
          ? `${CALENDAR_ROW_EXPANDED_PX}px`
          : `minmax(${CALENDAR_ROW_MINIMAL_PX}px, auto)`
      )
      .join(" ");
  }, [isDraggingAny, weeks, weekExpanded]);

  const flatDays = useMemo(() => weeks.flat(), [weeks]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const placement = event.active.data.current?.placement as CalendarTaskPlacement | undefined;
    setActivePlacement(placement ?? null);
    setActiveChipWidth(event.active.rect.current.initial?.width ?? null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActivePlacement(null);
      setActiveChipWidth(null);
      if (!over || !onTaskReschedule) return;

      const parsed = parsePlacementDragId(String(active.id));
      const drop = parseDropTargetId(String(over.id));
      if (!parsed || !drop) return;

      const placement = active.data.current?.placement as CalendarTaskPlacement | undefined;
      if (!placement) return;

      const targetDate = parseISO(`${drop.dateKey}T12:00:00`);
      const effectivePeriod = placement.period === "untimed" ? null : placement.period;
      if (placement.dateKey === drop.dateKey && effectivePeriod === drop.period) return;

      const updates = buildScheduleUpdate(
        placement.task,
        parsed.source,
        parsed.milestoneId,
        targetDate,
        drop.period
      );

      await onTaskReschedule(parsed.taskId, updates);
    },
    [onTaskReschedule]
  );

  const handleDragCancel = useCallback(() => {
    setActivePlacement(null);
    setActiveChipWidth(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={calendarDropCollision}
      autoScroll={false}
      measuring={{
        droppable: { strategy: MeasuringStrategy.Always },
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex w-full flex-col bg-transparent">
        <div
          ref={weekdayHeaderRef}
          className="grid shrink-0 grid-cols-7 gap-[3px] px-2 pb-1.5 pt-2"
        >
          {(showFullWeekdayNames ? WEEKDAY_LABELS_FULL : WEEKDAY_LABELS_SHORT).map(
            (label, index) => (
              <div
                key={WEEKDAY_LABELS_SHORT[index]}
                className={cn(
                  "min-w-0 truncate text-center font-mono text-2xs font-semibold uppercase tracking-wider",
                  index < 5 ? "text-foreground" : "opacity-50"
                )}
              >
                {label}
              </div>
            )
          )}
        </div>
        <div
          ref={daysGridRef}
          className="grid shrink-0 grid-cols-7 gap-[3px] overflow-visible px-2 pb-2"
          style={{ gridTemplateRows }}
        >
          {flatDays.map((date, index) => {
            const key = format(date, "yyyy-MM-dd");
            const weekIndex = Math.floor(index / 7);
            const compact = !weekExpanded[weekIndex];
            const isWeekendColumn = index % 7 >= 5;
            return (
              <CalendarDayCell
                key={key}
                date={date}
                month={month}
                placements={placementsByDate.get(key) ?? []}
                selectedDate={selectedDate}
                onDateSelect={onDateSelect}
                onCreateForDate={onCreateForDate}
                onTaskClick={onTaskClick}
                selectedTaskId={selectedTaskId}
                propertyMap={propertyMap}
                isDragging={isDraggingAny}
                isWeekendColumn={isWeekendColumn}
                compact={compact}
                afternoonOnly={compact && weekAfternoonOnly[weekIndex]}
                flushEdges={flushEdges}
                columnIndex={index % 7}
              />
            );
          })}
        </div>
      </div>

      {/* Portal to body so fixed positioning isn't skewed by layout ancestors. */}
      {typeof document !== "undefined"
        ? createPortal(
            <DragOverlay dropAnimation={null} zIndex={80}>
              {activePlacement ? (
                <div style={activeChipWidth ? { width: activeChipWidth } : undefined}>
                  <CalendarTaskChip
                    placement={activePlacement}
                    propertyMap={propertyMap}
                    selectedTaskId={selectedTaskId}
                    isDragOverlay
                  />
                </div>
              ) : null}
            </DragOverlay>,
            document.body
          )
        : null}
    </DndContext>
  );
}
