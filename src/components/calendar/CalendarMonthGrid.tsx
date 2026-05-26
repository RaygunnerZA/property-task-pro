import { useMemo, useState, useCallback } from "react";
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
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  calendarTypeColorWithAlpha,
  getCalendarTypeColor,
  inferCalendarType,
  type CalendarTypeId,
} from "@/lib/calendarTypes";
import {
  buildCalendarPlacements,
  buildScheduleUpdate,
  groupPlacementsByDate,
  parseDropTargetId,
  parsePlacementDragId,
  type CalendarTaskPlacement,
} from "@/lib/calendarTaskSchedule";

const WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/** Fixed size for every task chip in the month grid (title + property rows). */
const CALENDAR_TASK_CHIP_CLASS =
  "relative flex h-[42px] min-h-[42px] shrink-0 w-full min-w-0 flex-col overflow-hidden cursor-grab touch-none rounded pt-[3px] pb-0.5 pl-3 pr-0.5 text-left text-[10px] leading-tight active:cursor-grabbing shadow-[2px_2px_2px_0px_rgba(0,0,0,0.2),inset_1px_1px_1px_0px_rgba(255,255,255,0.8)]";

type CalendarMonthGridProps = {
  month: Date;
  tasks: unknown[];
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
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
  if (normalized === "urgent") return "bg-red-500";
  if (normalized === "high") return "bg-[#FFB84D]";
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
};

function CalendarTaskChip({
  placement,
  propertyMap,
  selectedTaskId,
  onTaskClick,
  isDragOverlay,
}: CalendarTaskChipProps) {
  const task = placement.task as {
    id: string;
    title?: string;
    property_id?: string;
    property_name?: string;
    priority?: string | null;
  };
  const priorityDotClass = taskPriorityDotClass(task.priority);
  const propertyLabel = taskPropertyLabel(task, propertyMap);
  const calType = inferCalendarType(placement.task) as CalendarTypeId;
  const color = getCalendarTypeColor(calType);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: placement.id,
    data: { placement },
    disabled: isDragOverlay,
  });

  const chipBackground = calendarTypeColorWithAlpha(color, 0.35);

  const style = transform
    ? { transform: CSS.Translate.toString(transform), backgroundColor: chipBackground }
    : { backgroundColor: chipBackground };

  return (
    <button
      ref={isDragOverlay ? undefined : setNodeRef}
      type="button"
      style={style}
      {...(isDragOverlay ? {} : { ...listeners, ...attributes })}
      onClick={(e) => {
        e.stopPropagation();
        onTaskClick?.(task.id);
      }}
      className={cn(
        CALENDAR_TASK_CHIP_CLASS,
        isDragging && !isDragOverlay && "opacity-40",
        isDragOverlay && "cursor-grabbing shadow-md ring-1 ring-white/30"
      )}
    >
      {priorityDotClass ? (
        <span
          className={cn(
            "pointer-events-none absolute left-1 top-1.5 h-[5px] w-[5px] rounded-full",
            priorityDotClass
          )}
          aria-hidden
        />
      ) : null}
      <span
        className="min-h-0 flex-1 overflow-hidden font-medium leading-[11px] line-clamp-2 text-[#2A293E]"
        title={task.title || "Task"}
      >
        {task.title || "Task"}
      </span>
      {propertyLabel ? (
        <span className="shrink-0 truncate text-[9px] leading-none text-[#2A293E] opacity-90">
          {propertyLabel}
        </span>
      ) : null}
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
        "pointer-events-auto z-0",
        periodSlotClass(period),
        isDragging && isOver && "bg-primary/10 ring-1 ring-inset ring-primary/25"
      )}
      aria-hidden
    />
  );
}

type CalendarDayCellProps = {
  date: Date;
  month: Date;
  placements: CalendarTaskPlacement[];
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  onTaskClick?: (taskId: string) => void;
  selectedTaskId?: string | null;
  propertyMap: Map<string, { nickname?: string; name?: string; address?: string }>;
  isDragging: boolean;
};

function CalendarDayCell({
  date,
  month,
  placements,
  selectedDate,
  onDateSelect,
  onTaskClick,
  selectedTaskId,
  propertyMap,
  isDragging,
}: CalendarDayCellProps) {
  const dateKey = format(date, "yyyy-MM-dd");
  const inMonth = isSameMonth(date, month);
  const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
  const isTodayDate = isToday(date);

  const visiblePlacements = placements.slice(0, 3);
  const overflow = placements.length - visiblePlacements.length;

  return (
    <div
      className={cn(
        "relative flex h-full min-h-[118px] flex-col border-b border-r border-white/60 px-[3px] pt-[3px] pb-1.5 text-left",
        !inMonth && "bg-muted/10 text-muted-foreground/50",
        isDragging && "hover:bg-muted/20"
      )}
    >
      <button
        type="button"
        onClick={() => onDateSelect?.(date)}
        className="relative z-[2] -mx-px inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] font-mono text-[11px] font-medium"
      >
        <span
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-[5px]",
            isSelected && "bg-white text-foreground",
            isTodayDate && !isSelected && "ring-1 ring-[#FF9B82]/60"
          )}
        >
          {date.getDate()}
        </span>
      </button>

      <div className="relative min-h-0 flex-1">
        <DayDropZone dateKey={dateKey} period="morning" isDragging={isDragging} />
        <DayDropZone dateKey={dateKey} period="afternoon" isDragging={isDragging} />
        <div className="relative z-[1] flex flex-col gap-0.5">
          {visiblePlacements.map((placement) => (
            <CalendarTaskChip
              key={placement.id}
              placement={placement}
              propertyMap={propertyMap}
              selectedTaskId={selectedTaskId}
              onTaskClick={onTaskClick}
            />
          ))}
        </div>
        {overflow > 0 ? (
          <span className="absolute bottom-0 right-0 z-[2] text-[9px] text-muted-foreground">
            +{overflow} more
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function CalendarMonthGrid({
  month,
  tasks,
  selectedDate,
  onDateSelect,
  onTaskClick,
  onTaskReschedule,
  selectedTaskId,
  propertyMap,
}: CalendarMonthGridProps) {
  const [activePlacement, setActivePlacement] = useState<CalendarTaskPlacement | null>(null);

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

  const flatDays = useMemo(() => weeks.flat(), [weeks]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const placement = event.active.data.current?.placement as CalendarTaskPlacement | undefined;
    setActivePlacement(placement ?? null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActivePlacement(null);
      const { active, over } = event;
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
  }, []);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex min-h-0 max-h-[718px] flex-1 flex-col rounded-xl border border-white/60 shadow-e1">
        <div className="grid shrink-0 grid-cols-7 border-b border-white/60 px-2 py-2">
          {WEEKDAY_LABELS.map((label, index) => (
            <div
              key={label}
              className={cn(
                "text-center font-mono text-[10px] font-semibold uppercase tracking-wide",
                index < 5 ? "text-foreground" : "text-muted-foreground/50"
              )}
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid shrink-0 grid-cols-7 [grid-template-rows:repeat(6,118px)]">
          {flatDays.map((date) => {
            const key = format(date, "yyyy-MM-dd");
            return (
              <CalendarDayCell
                key={key}
                date={date}
                month={month}
                placements={placementsByDate.get(key) ?? []}
                selectedDate={selectedDate}
                onDateSelect={onDateSelect}
                onTaskClick={onTaskClick}
                selectedTaskId={selectedTaskId}
                propertyMap={propertyMap}
                isDragging={activePlacement != null}
              />
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activePlacement ? (
          <CalendarTaskChip
            placement={activePlacement}
            propertyMap={propertyMap}
            selectedTaskId={selectedTaskId}
            isDragOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
