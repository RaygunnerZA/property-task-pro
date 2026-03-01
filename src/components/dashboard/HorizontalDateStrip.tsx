/**
 * HorizontalDateStrip - Minimised date picker with capsule window
 *
 * Days+dates scroll horizontally behind a fixed capsule; magnetic snap to centre.
 * Same capsule shape/size (70px) as When panel date strip.
 */

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { format, isToday, addDays, startOfDay, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";

const CAPSULE_WIDTH = 62;
const ITEM_WIDTH = 62;
const ITEM_GAP = 8;
const ITEM_PITCH = ITEM_WIDTH + ITEM_GAP;
const EXTEND_DAYS = 14;
const EDGE_TRIGGER_DISTANCE = ITEM_PITCH * 5;

export interface HorizontalDateStripProps {
  tasks?: Array<{
    due_date?: string | null;
    due_at?: string | null;
    status?: string | null;
    priority?: string | null;
    milestones?: Array<{ dateTime?: string | null }> | null;
  }>;
  selectedDate?: Date | undefined;
  onDateSelect?: (date: Date | undefined) => void;
  /** Number of days before today to show (default 3) */
  daysBack?: number;
  /** Number of days after today to show (default 17) */
  daysAhead?: number;
  className?: string;
}

function formatDateLabel(d: Date): string {
  if (isToday(d)) return "TODAY";
  return format(d, "EEE d");
}

export function HorizontalDateStrip({
  tasks = [],
  selectedDate,
  onDateSelect,
  daysBack = 3,
  daysAhead = 17,
  className,
}: HorizontalDateStripProps) {
  const dateStripRef = useRef<HTMLDivElement | null>(null);
  const dateItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [dateStripWidth, setDateStripWidth] = useState(0);
  const snapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rangeStart, setRangeStart] = useState(-daysBack);
  const [rangeEnd, setRangeEnd] = useState(daysAhead);
  const extendingLeftRef = useRef(false);
  const extendingRightRef = useRef(false);

  const dateOptions = useMemo(() => {
    const today = startOfDay(new Date());
    const total = rangeEnd - rangeStart + 1;
    return Array.from({ length: total }, (_, i) => addDays(today, rangeStart + i));
  }, [rangeStart, rangeEnd]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, { high: number; urgent: number; overdue: number; total: number }>();
    const today = startOfDay(new Date());

    const normalizePriority = (priority: string | null | undefined): string => {
      if (!priority) return "normal";
      const normalized = priority.toLowerCase();
      return normalized === "medium" ? "normal" : normalized;
    };

    const addDateEntry = (dateValue: string, priority: string | null | undefined) => {
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return;
      const key = format(startOfDay(date), "yyyy-MM-dd");
      const existing = map.get(key) ?? { high: 0, urgent: 0, overdue: 0, total: 0 };
      existing.total += 1;

      const normalized = normalizePriority(priority);
      if (normalized === "urgent") {
        existing.urgent += 1;
      } else if (normalized === "high") {
        existing.high += 1;
      }

      if (startOfDay(date) < today) {
        existing.overdue += 1;
      }

      map.set(key, existing);
    };

    tasks.forEach((task) => {
      if (task.status === "completed" || task.status === "archived") return;

      const dueDate = task.due_date || task.due_at;
      if (dueDate) addDateEntry(dueDate, task.priority);

      if (Array.isArray(task.milestones)) {
        task.milestones.forEach((milestone) => {
          if (milestone?.dateTime) addDateEntry(milestone.dateTime, task.priority);
        });
      }
    });

    return map;
  }, [tasks]);

  const selectedIndex = useMemo(() => {
    if (!selectedDate) return Math.max(0, -rangeStart);
    const key = format(startOfDay(selectedDate), "yyyy-MM-dd");
    const idx = dateOptions.findIndex((d) => format(d, "yyyy-MM-dd") === key);
    return idx >= 0 ? idx : Math.max(0, -rangeStart);
  }, [selectedDate, dateOptions, rangeStart]);

  const maybeExtendDateRange = useCallback(() => {
    const el = dateStripRef.current;
    if (!el) return;

    if (el.scrollLeft < EDGE_TRIGGER_DISTANCE && !extendingLeftRef.current) {
      extendingLeftRef.current = true;
      const previousScrollLeft = el.scrollLeft;
      setRangeStart((prev) => prev - EXTEND_DAYS);
      requestAnimationFrame(() => {
        const strip = dateStripRef.current;
        if (strip) {
          // Preserve current visible dates after prepending earlier dates.
          strip.scrollLeft = previousScrollLeft + EXTEND_DAYS * ITEM_PITCH;
        }
        extendingLeftRef.current = false;
      });
    }

    const rightDistance = el.scrollWidth - (el.scrollLeft + el.clientWidth);
    if (rightDistance < EDGE_TRIGGER_DISTANCE && !extendingRightRef.current) {
      extendingRightRef.current = true;
      setRangeEnd((prev) => prev + EXTEND_DAYS);
      requestAnimationFrame(() => {
        extendingRightRef.current = false;
      });
    }
  }, []);

  const snapToClosestDate = useCallback(() => {
    const el = dateStripRef.current;
    if (!el || dateStripWidth <= 0) return;
    const center = el.scrollLeft + dateStripWidth / 2;
    let closestIdx = 0;
    let minDist = Infinity;
    dateItemRefs.current.forEach((item, idx) => {
      if (!item) return;
      const itemCenter = item.offsetLeft + item.offsetWidth / 2;
      const dist = Math.abs(itemCenter - center);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });
    const target = dateItemRefs.current[closestIdx];
    if (target && onDateSelect) {
      target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      onDateSelect(dateOptions[closestIdx]);
    }
  }, [dateStripWidth, dateOptions, onDateSelect]);

  const handleDateStripScroll = useCallback(() => {
    if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
    const el = dateStripRef.current;
    if (el) setDateStripWidth(el.clientWidth);
    maybeExtendDateRange();
    snapTimeoutRef.current = setTimeout(snapToClosestDate, 120);
  }, [maybeExtendDateRange, snapToClosestDate]);

  useEffect(() => {
    const el = dateStripRef.current;
    if (!el) return;
    setDateStripWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setDateStripWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => {
    if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
  }, []);

  useEffect(() => {
    const target = selectedDate ? startOfDay(selectedDate) : startOfDay(new Date());
    const offsetFromToday = differenceInCalendarDays(target, startOfDay(new Date()));
    if (offsetFromToday < rangeStart) {
      setRangeStart(offsetFromToday - EXTEND_DAYS);
    } else if (offsetFromToday > rangeEnd) {
      setRangeEnd(offsetFromToday + EXTEND_DAYS);
    }
  }, [selectedDate, rangeStart, rangeEnd]);

  useEffect(() => {
    const el = dateStripRef.current;
    const item = dateItemRefs.current[selectedIndex];
    if (el && item) {
      item.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
    }
  }, [selectedIndex]);

  const paddingX = dateStripWidth > 0 ? Math.max(0, (dateStripWidth - CAPSULE_WIDTH) / 2) : 60;

  return (
    <div className={cn("relative mb-0 flex h-[40px] w-full items-center justify-start py-0", className)}>
      <div
        ref={dateStripRef}
        onScroll={handleDateStripScroll}
        className="overflow-x-auto no-scrollbar my-0 flex h-[50px] w-full items-center justify-start gap-2 py-0"
        style={{
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div className="shrink-0" style={{ width: paddingX, height: 1 }} aria-hidden />
        {dateOptions.map((d, idx) => {
          const isActive = selectedIndex === idx;
          const label = formatDateLabel(d);
          const dateKey = format(startOfDay(d), "yyyy-MM-dd");
          const dateData = tasksByDate.get(dateKey);
          const total = dateData?.total ?? 0;
          const high = dateData?.high ?? 0;
          const urgent = dateData?.urgent ?? 0;
          const overdue = dateData?.overdue ?? 0;
          const hasTasks = total > 0;

          let fillColor: string | undefined;
          if (hasTasks) {
            const urgentOrOverdue = urgent + overdue;
            if (urgentOrOverdue >= 1) {
              fillColor = "rgba(220, 38, 38, 0.45)";
            } else if (high >= 1) {
              fillColor = "rgba(245, 138, 48, 0.45)";
            } else {
              fillColor = "rgba(78, 179, 182, 0.42)";
            }
          }

          return (
            <button
              key={d.toISOString()}
              ref={(el) => { dateItemRefs.current[idx] = el; }}
              type="button"
              onClick={() => {
                onDateSelect?.(d);
                const item = dateItemRefs.current[idx];
                if (item) {
                  item.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                }
              }}
              style={{ scrollSnapAlign: "center", width: ITEM_WIDTH }}
              data-task-count={total}
              className={cn(
                "shrink-0 h-9 rounded-[12px] font-mono text-xs uppercase tracking-wide transition-all select-none cursor-pointer flex items-center justify-center",
                isActive
                  ? "bg-card text-foreground shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                  : "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
              )}
              aria-label={hasTasks ? `${label}, ${total} tasks` : label}
              title={hasTasks ? `${total} task${total === 1 ? "" : "s"}` : undefined}
            >
              <span
                className={cn(
                  "w-[62px] h-9 px-2 pt-[10px] pb-[10px] rounded-[12px] transition-colors transition-opacity",
                  hasTasks && !isActive && "text-foreground"
                )}
                style={{
                  backgroundColor: fillColor,
                  opacity: hasTasks && !isActive ? 0.5 : 1,
                  boxShadow: hasTasks
                    ? "inset -1px -1px 2px rgba(255,255,255,0.4), inset 1px 1px 2px rgba(0,0,0,0.15)"
                    : undefined,
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
        <div className="shrink-0" style={{ width: paddingX, height: 1 }} aria-hidden />
      </div>
      {/* Capsule window (centre) - dates scroll behind */}
      <div
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 pointer-events-none z-10 rounded-[12px]"
        style={{
          width: CAPSULE_WIDTH,
          height: "36px",
          marginTop: "2px",
          boxShadow: "inset 0px 12.5px 14.5px -7.8px rgba(0, 0, 0, 0.33), 0px -1px 1px 0px rgba(0, 0, 0, 0.25), 0px 1px 1px 0px rgba(255, 255, 255, 1)",
        }}
      />
    </div>
  );
}
