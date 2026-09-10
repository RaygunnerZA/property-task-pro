import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Repeat } from "lucide-react";
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

const WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/**
 * Week row: minimise when events sit in only morning or only afternoon.
 * Expand when both halves are needed, or a day stacks 2+ events.
 * Compact rows use minmax(auto) so a single short chip doesn't leave a tall empty half.
 */
const CALENDAR_ROW_MINIMAL_PX = 48;
const CALENDAR_ROW_EXPANDED_PX = 118;

/** Fixed size for every task chip in the month grid (title + property rows). */
const CALENDAR_TASK_CHIP_CLASS =
  "relative flex h-[42px] min-h-[42px] shrink-0 w-full min-w-0 flex-col overflow-hidden cursor-grab touch-none rounded pt-[3px] pb-0.5 pl-3 pr-0.5 text-left text-2xs leading-tight active:cursor-grabbing shadow-[2px_2px_2px_0px_rgba(0,0,0,0.2),inset_1px_1px_1px_0px_rgba(255,255,255,0.8)]";

/** Single-line chip while click-and-hold / dragging (morning ↔ afternoon). */
const CALENDAR_TASK_CHIP_COMPACT_CLASS =
  "relative flex h-[22px] min-h-[22px] shrink-0 w-full min-w-0 items-center overflow-hidden cursor-grab touch-none rounded py-0 pl-3 pr-0.5 text-left text-2xs leading-none active:cursor-grabbing shadow-[2px_2px_2px_0px_rgba(0,0,0,0.2),inset_1px_1px_1px_0px_rgba(255,255,255,0.8)]";

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

  // When a DragOverlay is active, leave the source chip in place (dimmed) —
  // applying `transform` here AND rendering an overlay causes a cursor offset.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: placement.id,
    data: { placement },
    disabled: isDragOverlay,
  });

  const chipBackground = resolveCalendarChipBackground(placement.task, isRepeat, {
    opaque,
    stackIndex,
    stackCount,
  });
  const title = task.title || "Task";

  return (
    <button
      ref={isDragOverlay ? undefined : setNodeRef}
      type="button"
      style={{ backgroundColor: chipBackground }}
      {...(isDragOverlay ? {} : { ...listeners, ...attributes })}
      onPointerDown={(e) => {
        listeners?.onPointerDown?.(e);
        onHoldStart?.();
      }}
      onPointerUp={() => onHoldEnd?.()}
      onPointerCancel={() => onHoldEnd?.()}
      onClick={(e) => {
        e.stopPropagation();
        onTaskClick?.(task.id);
      }}
      className={cn(
        compact ? CALENDAR_TASK_CHIP_COMPACT_CLASS : CALENDAR_TASK_CHIP_CLASS,
        "transition-[height,min-height,opacity,box-shadow] duration-200 ease-out",
        isRepeat &&
          "pl-1.5 shadow-[1px_1px_1px_0px_rgba(0,0,0,0.08),inset_1px_1px_1px_0px_rgba(255,255,255,0.55)]",
        elevated &&
          "shadow-[3px_4px_8px_-2px_rgba(0,0,0,0.18),1px_1px_1px_0px_rgba(0,0,0,0.1),inset_1px_1px_1px_0px_rgba(255,255,255,0.85)]",
        isDragging && !isDragOverlay && "opacity-40",
        isDragOverlay && "w-full cursor-grabbing shadow-md ring-1 ring-white/30"
      )}
    >
      {priorityDotClass && !isRepeat ? (
        <span
          className={cn(
            "pointer-events-none absolute left-1 rounded-full",
            compact ? "top-1/2 h-[4px] w-[4px] -translate-y-1/2" : "top-1.5 h-[5px] w-[5px]",
            priorityDotClass
          )}
          aria-hidden
        />
      ) : null}
      {compact ? (
        <span className="flex min-w-0 flex-1 items-center gap-0.5">
          {isRepeat ? (
            <Repeat
              className={cn(
                "h-2.5 w-2.5 shrink-0",
                isSeriesColor ? "text-ink/55" : "text-ink/35"
              )}
              style={isSeriesColor ? { color: baseColor } : undefined}
              aria-hidden
            />
          ) : null}
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
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
            className="min-h-0 flex-1 overflow-hidden font-medium leading-[11px] line-clamp-2 text-ink"
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

const HAND_CHIP_HEIGHT = 42;
const HAND_CHIP_COMPACT_HEIGHT = 22;
const HAND_EXPANDED_GAP = 2;

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
  onExpandedChange?: (expanded: boolean) => void;
};

/**
 * Same-period multi-event layout: opaque chips fanned horizontally inside the cell;
 * on hover, deal into a vertical stack centred on the rest height (may spill above/below).
 */
function CalendarEventHand({
  items,
  propertyMap,
  selectedTaskId,
  onTaskClick,
  isDragging,
  onExpandedChange,
}: CalendarEventHandProps) {
  const [expanded, setExpanded] = useState(false);
  const n = items.length;
  const restHeight = Math.max(...items.map(handChipHeight));
  // Keep every card inside the cell: total horizontal peek ≤ 36% of width.
  const peekFraction = Math.min(0.14, 0.36 / Math.max(n - 1, 1));
  const fanWidthPercent = 100 - (n - 1) * peekFraction * 100;

  const heights = items.map(handChipHeight);
  const stackTotal =
    heights.reduce((sum, h) => sum + h, 0) + HAND_EXPANDED_GAP * Math.max(n - 1, 0);
  const stackOrigin = (restHeight - stackTotal) / 2;

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

  return (
    <div
      className={cn(
        "relative w-full",
        expanded ? "z-40" : "z-[1]"
      )}
      style={{ height: restHeight }}
      onMouseEnter={() => setExpandedSafe(true)}
      onMouseLeave={() => setExpandedSafe(false)}
      onFocusCapture={() => setExpandedSafe(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setExpandedSafe(false);
        }
      }}
    >
      {items.map((placement, index) => {
        let top = 0;
        if (expanded) {
          top = stackOrigin;
          for (let i = 0; i < index; i++) {
            top += heights[i] + HAND_EXPANDED_GAP;
          }
        }
        return (
          <div
            key={placement.id}
            className="absolute transition-[top,left,width,transform,box-shadow] duration-200 ease-out"
            style={
              expanded
                ? {
                    top,
                    left: 0,
                    width: "100%",
                    zIndex: 20 + index,
                  }
                : {
                    top: 0,
                    left: `${index * peekFraction * 100}%`,
                    width: `${fanWidthPercent}%`,
                    zIndex: index + 1,
                  }
            }
          >
            <CalendarTaskChip
              placement={placement}
              propertyMap={propertyMap}
              selectedTaskId={selectedTaskId}
              onTaskClick={onTaskClick}
              opaque
              elevated={expanded}
              stackIndex={index}
              stackCount={n}
            />
          </div>
        );
      })}
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

  return (
    <div
      className={cn(
        "relative flex flex-col border-b border-r border-white/60 px-[3px] pt-[3px] text-left select-none",
        fillRow ? "h-full pb-1.5" : "h-auto pb-0.5",
        !inMonth && "bg-muted/10 text-muted-foreground/50",
        isDragging && "hover:bg-muted/20",
        isWeekendColumn && "opacity-50",
        // Let hover stacks paint above neighbouring days.
        handExpanded && "z-30 overflow-visible"
      )}
      style={{ minHeight: isDragging ? CALENDAR_ROW_EXPANDED_PX : rowMinHeight }}
      onDoubleClick={() => {
        if (!occupied) handleCreate();
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (occupied && onCreateForDate) {
            handleCreate();
            return;
          }
          onDateSelect?.(date);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!occupied) handleCreate();
        }}
        aria-label={
          occupied && onCreateForDate
            ? `Create task on ${dateLabel}`
            : `Select ${dateLabel}`
        }
        title={occupied && onCreateForDate ? "Create task" : undefined}
        className={cn(
          "relative -mx-px inline-flex shrink-0 items-center justify-center rounded-sharp font-mono text-caption font-medium",
          // Below expanded hands so stacked cards aren't clipped by the date badge.
          handExpanded ? "z-[1]" : "z-[2]",
          compact ? "h-5 w-5" : "h-6 w-6"
        )}
      >
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-sharp",
            compact ? "h-5 w-5" : "h-6 w-6",
            isSelected && "bg-white text-foreground",
            isTodayDate && !isSelected && "ring-1 ring-accent/60"
          )}
        >
          {date.getDate()}
        </span>
      </button>

      <div
        className={cn(
          "relative flex flex-col",
          fillRow ? "min-h-0 flex-1" : "min-h-[22px]",
          // Above the date numeral while a hand is dealt out on hover.
          handExpanded ? "z-20 overflow-visible" : "z-[1]"
        )}
      >
        <DayDropZone dateKey={dateKey} period="morning" isDragging={isDragging} />
        <DayDropZone dateKey={dateKey} period="afternoon" isDragging={isDragging} />
        <div
          className={cn(
            "relative flex flex-col gap-0.5",
            fillRow ? "min-h-0 flex-1" : "min-h-0",
            handExpanded ? "z-20 overflow-visible" : "z-[1] overflow-hidden",
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
      <div className="flex w-full flex-col rounded-xl border border-white/60 shadow-e1">
        <div className="grid shrink-0 grid-cols-7 border-b border-white/60 px-2 py-2">
          {WEEKDAY_LABELS.map((label, index) => (
            <div
              key={label}
              className={cn(
                "text-center font-mono text-2xs font-semibold uppercase tracking-wider",
                index < 5 ? "text-foreground" : "opacity-50"
              )}
            >
              {label}
            </div>
          ))}
        </div>
        <div
          className="grid shrink-0 grid-cols-7 overflow-visible"
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
