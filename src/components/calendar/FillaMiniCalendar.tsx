import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  addDays,
  addWeeks,
  format,
  format as formatDate,
  isSameDay,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import {
  buildTasksByDate,
  dayCellBackground,
  dayDotColor,
  type DayUrgency,
  type TaskDateData,
} from "@/lib/calendarDayMeta";
import { CalendarMonthYearLabel } from "@/components/calendar/CalendarMonthYearLabel";

function resolveDayUrgency(data: TaskDateData | undefined): DayUrgency {
  if (!data || data.total === 0) return "none";
  if (data.maxUrgency && data.maxUrgency !== "none") return data.maxUrgency;
  if (data.overdue > 0) return "overdue";
  if (data.urgent > 0) return "urgent";
  if (data.high > 0) return "high";
  return "normal";
}

/** Neomorphic depth for mini-calendar day cells with task fill */
const MINI_CALENDAR_DAY_SHADOW =
  "1px 2px 1px 0px rgba(255, 255, 255, 0.8), inset 1.5px 2px 2.4px 0px rgba(0, 0, 0, 0.2), -1px -1px 1px 0px rgba(0, 0, 0, 0.1)";

const CALENDAR_WEEK_ROWS = 6;
const WEEK_STARTS_ON = 1 as const;
/** Settle duration for magnetic week realignment (Monday sliding into place). */
const WEEK_SLIDE_MS = 1000;
/** Brief hold after release before the magnetic slide starts. */
const WEEK_SETTLE_DELAY_MS = 1500;
/** Fraction of strip width that commits a week change on release. */
const WEEK_COMMIT_RATIO = 0.18;
/** Absolute px floor so small intentional flicks still commit. */
const WEEK_COMMIT_MIN_PX = 28;
/** Velocity (px/ms) that commits even below distance threshold. */
const WEEK_COMMIT_VELOCITY = 0.45;
/** Idle gap after last wheel event before we settle/commit. */
const WEEK_WHEEL_IDLE_MS = 90;
/** Slow magnetic pull — eases in, then settles without a snap. */
const WEEK_EASE = "cubic-bezier(0.4, 0.0, 0.2, 1)";

/** Row height = cell height + row top margin (mt-0.5) */
function miniCalendarRowMetrics(variant: "sidebar" | "embedded") {
  const cellHeight = variant === "embedded" ? 30 : 28;
  const rowHeight = cellHeight + 2;
  return {
    rowHeight,
    expandedHeight: rowHeight * CALENDAR_WEEK_ROWS,
  };
}

function buildWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function stripWidth(el: HTMLElement | null): number {
  return Math.max(el?.clientWidth ?? 0, 1);
}

function shouldCommitWeek(offsetPx: number, velocityPxPerMs: number, width: number): -1 | 1 | 0 {
  const distance = Math.abs(offsetPx);
  const threshold = Math.max(width * WEEK_COMMIT_RATIO, WEEK_COMMIT_MIN_PX);
  const byDistance = distance >= threshold;
  const byVelocity = Math.abs(velocityPxPerMs) >= WEEK_COMMIT_VELOCITY && distance >= 10;
  if (!byDistance && !byVelocity) return 0;
  // Finger/trackpad moved left (negative offset) → next week
  return offsetPx < 0 ? 1 : -1;
}

type MiniCalendarWeekStripHandle = {
  goWeek: (delta: -1 | 1) => void;
};

function WeekStripRow({
  weekStart,
  tasksByDate,
  selectedDate,
  onDateSelect,
  isEmbedded,
}: {
  weekStart: Date;
  tasksByDate: Map<string, TaskDateData>;
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
  isEmbedded: boolean;
}) {
  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const daySizeClass = isEmbedded ? "h-7 w-7" : "h-[30px] w-[30px]";
  const dayTextClass = isEmbedded ? "text-caption" : "text-sm";

  return (
    <div className="w-full shrink-0">
      <div className="mb-1.5 flex w-full justify-between px-0.5">
        {weekDays.map((date) => {
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          return (
            <div
              key={format(date, "yyyy-MM-dd-dow")}
              className={cn(
                "min-w-0 flex-1 text-center font-mono font-medium uppercase",
                isEmbedded ? "text-[0.65rem]" : "text-2xs",
                isWeekend ? "text-muted-foreground/50" : "text-muted-foreground"
              )}
            >
              {formatDate(date, "EEE").toUpperCase()}
            </div>
          );
        })}
      </div>
      <div className="flex w-full justify-between px-0.5">
        {weekDays.map((date) => {
          const dateKey = format(date, "yyyy-MM-dd");
          const dateData = tasksByDate.get(dateKey);
          const maxUrgency = resolveDayUrgency(dateData);
          const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
          const isTodayDate = isToday(date);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const fill = dayCellBackground(maxUrgency, isSelected);
          const dot = dayDotColor(maxUrgency);

          return (
            <div key={dateKey} className="flex min-w-0 flex-1 items-center justify-center">
              <button
                type="button"
                onClick={() => onDateSelect?.(date)}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-card font-mono font-medium",
                  "transition-[background-color,transform] duration-150 ease-out hover:bg-white/60 active:scale-90",
                  daySizeClass,
                  isWeekend && !isSelected && "text-muted-foreground/50",
                  isTodayDate && !isSelected && "ring-1 ring-primary/40"
                )}
                style={{
                  backgroundColor: fill,
                  ...(fill ? { boxShadow: MINI_CALENDAR_DAY_SHADOW } : undefined),
                }}
              >
                <span className={cn(dayTextClass, isTodayDate && !isSelected && "font-semibold")}>
                  {date.getDate()}
                </span>
                {dot ? (
                  <span
                    className="absolute left-[3px] top-[3px] h-1 w-1 rounded-full"
                    style={{ backgroundColor: dot }}
                    aria-hidden
                  />
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MiniCalendarWeekStrip = forwardRef<
  MiniCalendarWeekStripHandle,
  {
    weekStart: Date;
    tasksByDate: Map<string, TaskDateData>;
    selectedDate?: Date;
    onDateSelect?: (date: Date | undefined) => void;
    onWeekChange: (nextWeekStart: Date) => void;
    isEmbedded: boolean;
  }
>(function MiniCalendarWeekStrip(
  { weekStart, tasksByDate, selectedDate, onDateSelect, onWeekChange, isEmbedded },
  ref
) {
  const [displayWeekStart, setDisplayWeekStart] = useState(weekStart);
  const [incomingWeekStart, setIncomingWeekStart] = useState<Date | null>(null);
  const [slideDirection, setSlideDirection] = useState<"next" | "prev" | null>(null);
  /** Live finger/trackpad follow (px). */
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  /** Settling animation offset on the dual-week track (px). */
  const [trackOffsetPx, setTrackOffsetPx] = useState(0);
  const [isSettling, setIsSettling] = useState(false);

  const stripRef = useRef<HTMLDivElement>(null);
  const trackElRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(280);
  const pointerIdRef = useRef<number | null>(null);
  const dragOriginXRef = useRef(0);
  const dragOriginYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const lastSampleRef = useRef<{ x: number; t: number } | null>(null);
  const velocityRef = useRef(0);
  const dragOffsetRef = useRef(0);
  const trackOffsetRef = useRef(0);
  const slideDirectionRef = useRef<"next" | "prev" | null>(null);
  const incomingWeekRef = useRef<Date | null>(null);
  const animatingRef = useRef(false);
  const settleTimerRef = useRef<number | null>(null);
  const settleDelayTimerRef = useRef<number | null>(null);
  const wheelIdleTimerRef = useRef<number | null>(null);
  const pendingSettleRef = useRef<
    | { kind: "commit"; delta: -1 | 1; from: number }
    | { kind: "snap"; from: number }
    | null
  >(null);
  const displayWeekRef = useRef(displayWeekStart);
  const onWeekChangeRef = useRef(onWeekChange);
  displayWeekRef.current = displayWeekStart;
  onWeekChangeRef.current = onWeekChange;
  slideDirectionRef.current = slideDirection;
  incomingWeekRef.current = incomingWeekStart;

  useEffect(() => {
    if (!animatingRef.current) setDisplayWeekStart(weekStart);
  }, [weekStart]);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const measure = () => {
      widthRef.current = stripWidth(el);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current != null) window.clearTimeout(settleTimerRef.current);
      if (settleDelayTimerRef.current != null) window.clearTimeout(settleDelayTimerRef.current);
      if (wheelIdleTimerRef.current != null) window.clearTimeout(wheelIdleTimerRef.current);
    };
  }, []);

  const clearSettleTimers = () => {
    if (settleTimerRef.current != null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    if (settleDelayTimerRef.current != null) {
      window.clearTimeout(settleDelayTimerRef.current);
      settleDelayTimerRef.current = null;
    }
  };

  const clearWheelIdle = () => {
    if (wheelIdleTimerRef.current != null) {
      window.clearTimeout(wheelIdleTimerRef.current);
      wheelIdleTimerRef.current = null;
    }
  };

  const commitWeekLive = useCallback((delta: -1 | 1) => {
    const next = addWeeks(displayWeekRef.current, delta);
    displayWeekRef.current = next;
    setDisplayWeekStart(next);
    onWeekChangeRef.current(next);
  }, []);

  const setDragVisual = useCallback((offset: number) => {
    dragOffsetRef.current = offset;
    setDragOffsetPx(offset);
  }, []);

  const setTrackVisual = useCallback((offset: number) => {
    trackOffsetRef.current = offset;
    setTrackOffsetPx(offset);
  }, []);

  const finishSettle = useCallback((nextWeekStart: Date | null) => {
    if (nextWeekStart) {
      displayWeekRef.current = nextWeekStart;
      setDisplayWeekStart(nextWeekStart);
      onWeekChangeRef.current(nextWeekStart);
    }
    incomingWeekRef.current = null;
    slideDirectionRef.current = null;
    setIncomingWeekStart(null);
    setSlideDirection(null);
    setTrackVisual(0);
    setDragVisual(0);
    setIsSettling(false);
    animatingRef.current = false;
    pendingSettleRef.current = null;
  }, [setDragVisual, setTrackVisual]);

  const readLiveTrackPx = () => {
    const el = trackElRef.current;
    if (!el) return trackOffsetRef.current;
    const style = window.getComputedStyle(el);
    const transform = style.transform;
    if (!transform || transform === "none") return trackOffsetRef.current;
    // matrix(a,b,c,d,tx,ty) or matrix3d(..., tx, ty, tz)
    const parts = transform.match(/matrix(?:3d)?\(([^)]+)\)/);
    if (!parts) return trackOffsetRef.current;
    const nums = parts[1].split(",").map((v) => Number.parseFloat(v.trim()));
    if (transform.startsWith("matrix3d")) {
      return Number.isFinite(nums[12]) ? nums[12] : trackOffsetRef.current;
    }
    return Number.isFinite(nums[4]) ? nums[4] : trackOffsetRef.current;
  };

  /** Cancel delayed settle or mid-slide so the user can keep dragging freely. */
  const interruptMotion = useCallback(() => {
    clearSettleTimers();
    clearWheelIdle();
    pendingSettleRef.current = null;

    if (!animatingRef.current && incomingWeekRef.current == null) {
      return;
    }

    const width = widthRef.current;
    const wasAnimating = animatingRef.current;
    // Prefer live CSS transform so interrupting mid-ease doesn't jump to the end target.
    const track = wasAnimating ? readLiveTrackPx() : trackOffsetRef.current;
    const dir = slideDirectionRef.current;
    const incoming = incomingWeekRef.current;

    // Freeze the painted position before killing the transition (avoids end-target snap).
    const trackEl = trackElRef.current;
    if (trackEl && wasAnimating) {
      trackEl.style.transition = "none";
      trackEl.style.transform = `translate3d(${track}px, 0, 0)`;
    }

    animatingRef.current = false;
    setIsSettling(false);

    if (incoming && dir === "next") {
      if (track <= -width * 0.5) {
        displayWeekRef.current = incoming;
        setDisplayWeekStart(incoming);
        onWeekChangeRef.current(incoming);
        setDragVisual(track + width);
      } else {
        setDragVisual(track);
      }
    } else if (incoming && dir === "prev") {
      if (track >= -width * 0.5) {
        displayWeekRef.current = incoming;
        setDisplayWeekStart(incoming);
        onWeekChangeRef.current(incoming);
        setDragVisual(track);
      } else {
        setDragVisual(track + width);
      }
    }

    incomingWeekRef.current = null;
    slideDirectionRef.current = null;
    setIncomingWeekStart(null);
    setSlideDirection(null);
    setTrackVisual(0);
  }, [setDragVisual, setTrackVisual]);

  const applyDragOffset = useCallback(
    (dx: number) => {
      const width = widthRef.current;
      let offset = dx;

      // Chain full weeks while the finger/trackpad keeps moving.
      while (offset <= -width) {
        commitWeekLive(1);
        offset += width;
        dragOriginXRef.current -= width;
      }
      while (offset >= width) {
        commitWeekLive(-1);
        offset -= width;
        dragOriginXRef.current += width;
      }

      const maxDrag = width * 0.92;
      const abs = Math.abs(offset);
      const clamped =
        abs <= maxDrag ? offset : Math.sign(offset) * (maxDrag + (abs - maxDrag) * 0.12);
      setDragVisual(clamped);
    },
    [commitWeekLive, setDragVisual]
  );

  const goWeek = useCallback(
    (delta: -1 | 1, fromOffsetPx = 0) => {
      clearSettleTimers();
      clearWheelIdle();
      pendingSettleRef.current = null;

      const width = widthRef.current;
      const nextWeekStart = addWeeks(displayWeekRef.current, delta);
      const direction = delta === 1 ? "next" : "prev";
      const startPx = delta === 1 ? fromOffsetPx : -width + fromOffsetPx;
      const endPx = delta === 1 ? -width : 0;

      incomingWeekRef.current = nextWeekStart;
      slideDirectionRef.current = direction;
      setIncomingWeekStart(nextWeekStart);
      setSlideDirection(direction);
      setDragVisual(0);
      setIsSettling(false);
      setTrackVisual(startPx);

      // Delay is idle hold — not locked. Slide itself marks animating.
      settleDelayTimerRef.current = window.setTimeout(() => {
        settleDelayTimerRef.current = null;
        animatingRef.current = true;
        setIsSettling(true);
        setTrackVisual(endPx);

        settleTimerRef.current = window.setTimeout(() => {
          settleTimerRef.current = null;
          finishSettle(nextWeekStart);
        }, WEEK_SLIDE_MS);
      }, WEEK_SETTLE_DELAY_MS);
    },
    [finishSettle, setDragVisual, setTrackVisual]
  );

  useImperativeHandle(ref, () => ({ goWeek: (delta) => goWeek(delta, 0) }), [goWeek]);

  const snapBack = useCallback(
    (fromOffsetPx: number) => {
      clearSettleTimers();
      clearWheelIdle();
      pendingSettleRef.current = null;

      const width = widthRef.current;
      const from = fromOffsetPx;

      setDragVisual(0);
      setIsSettling(false);

      if (from < 0) {
        const incoming = addWeeks(displayWeekRef.current, 1);
        incomingWeekRef.current = incoming;
        slideDirectionRef.current = "next";
        setIncomingWeekStart(incoming);
        setSlideDirection("next");
        setTrackVisual(from);

        settleDelayTimerRef.current = window.setTimeout(() => {
          settleDelayTimerRef.current = null;
          animatingRef.current = true;
          setIsSettling(true);
          setTrackVisual(0);
          settleTimerRef.current = window.setTimeout(() => {
            settleTimerRef.current = null;
            finishSettle(null);
          }, WEEK_SLIDE_MS);
        }, WEEK_SETTLE_DELAY_MS);
      } else {
        const incoming = addWeeks(displayWeekRef.current, -1);
        incomingWeekRef.current = incoming;
        slideDirectionRef.current = "prev";
        setIncomingWeekStart(incoming);
        setSlideDirection("prev");
        setTrackVisual(-width + from);

        settleDelayTimerRef.current = window.setTimeout(() => {
          settleDelayTimerRef.current = null;
          animatingRef.current = true;
          setIsSettling(true);
          setTrackVisual(-width);
          settleTimerRef.current = window.setTimeout(() => {
            settleTimerRef.current = null;
            finishSettle(null);
          }, WEEK_SLIDE_MS);
        }, WEEK_SETTLE_DELAY_MS);
      }
    },
    [finishSettle, setDragVisual, setTrackVisual]
  );

  const settleFromOffset = useCallback(
    (offsetPx: number, velocityPxPerMs: number) => {
      const commit = shouldCommitWeek(offsetPx, velocityPxPerMs, widthRef.current);
      if (commit !== 0) {
        // Hold at release offset (still interactive) until magnetic slide starts.
        pendingSettleRef.current = { kind: "commit", delta: commit, from: offsetPx };
        setDragVisual(offsetPx);
        goWeek(commit, offsetPx);
        return;
      }
      if (Math.abs(offsetPx) < 0.5) {
        setDragVisual(0);
        return;
      }
      pendingSettleRef.current = { kind: "snap", from: offsetPx };
      snapBack(offsetPx);
    },
    [goWeek, setDragVisual, snapBack]
  );

  const sampleVelocity = (clientX: number) => {
    const now = performance.now();
    const prev = lastSampleRef.current;
    if (prev) {
      const dt = now - prev.t;
      if (dt > 0) velocityRef.current = (clientX - prev.x) / dt;
    }
    lastSampleRef.current = { x: clientX, t: now };
  };

  const beginGestureAt = (clientX: number, clientY: number, target: HTMLElement, pointerId: number) => {
    interruptMotion();
    clearWheelIdle();

    pointerIdRef.current = pointerId;
    // Continue from current visual offset so reverse/forward stays continuous.
    dragOriginXRef.current = clientX - dragOffsetRef.current;
    dragOriginYRef.current = clientY;
    isDraggingRef.current = false;
    velocityRef.current = 0;
    lastSampleRef.current = { x: clientX, t: performance.now() };
    target.setPointerCapture?.(pointerId);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    beginGestureAt(event.clientX, event.clientY, event.currentTarget as HTMLElement, event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (pointerIdRef.current !== event.pointerId) return;

    const dx = event.clientX - dragOriginXRef.current;
    const dy = event.clientY - dragOriginYRef.current;

    if (!isDraggingRef.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dx) <= Math.abs(dy) * 1.05) {
        try {
          (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
        } catch {
          /* ignore */
        }
        pointerIdRef.current = null;
        return;
      }
      isDraggingRef.current = true;
    }

    event.preventDefault();
    sampleVelocity(event.clientX);
    applyDragOffset(dx);
  };

  const endPointerGesture = (event: React.PointerEvent) => {
    if (pointerIdRef.current !== event.pointerId) return;
    pointerIdRef.current = null;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    } catch {
      /* already released */
    }

    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    suppressClickRef.current = true;
    sampleVelocity(event.clientX);
    settleFromOffset(dragOffsetRef.current, velocityRef.current);
  };

  const onClickCapture = (event: React.MouseEvent) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;

      const width = stripWidth(el);
      const deltaX =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? event.deltaX * 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? event.deltaX * width
            : event.deltaX;
      const deltaY =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? event.deltaY * 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? event.deltaY * el.clientHeight
            : event.deltaY;

      if (Math.abs(deltaX) <= Math.abs(deltaY) * 0.85) return;
      if (Math.abs(deltaX) < 0.4) return;

      event.preventDefault();
      event.stopPropagation();

      interruptMotion();

      // Trackpad: positive deltaX → content moves left → next week (negative offset)
      applyDragOffset(dragOffsetRef.current - deltaX);
      velocityRef.current = -deltaX / 16;

      clearWheelIdle();
      wheelIdleTimerRef.current = window.setTimeout(() => {
        wheelIdleTimerRef.current = null;
        if (isDraggingRef.current) return;
        settleFromOffset(dragOffsetRef.current, velocityRef.current);
      }, WEEK_WHEEL_IDLE_MS);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyDragOffset, interruptMotion, settleFromOffset]);

  const width = widthRef.current;
  const isDualTrack = incomingWeekStart != null || dragOffsetPx !== 0;
  const peekNext = dragOffsetPx < 0 && !incomingWeekStart;
  const peekPrev = dragOffsetPx > 0 && !incomingWeekStart;

  const leftWeekStart = incomingWeekStart
    ? slideDirection === "prev"
      ? incomingWeekStart
      : displayWeekStart
    : peekPrev
      ? addWeeks(displayWeekStart, -1)
      : displayWeekStart;

  const rightWeekStart = incomingWeekStart
    ? slideDirection === "next"
      ? incomingWeekStart
      : displayWeekStart
    : peekNext
      ? addWeeks(displayWeekStart, 1)
      : displayWeekStart;

  let transformPx = 0;
  if (incomingWeekStart) {
    transformPx = trackOffsetPx;
  } else if (peekNext) {
    transformPx = dragOffsetPx;
  } else if (peekPrev) {
    transformPx = -width + dragOffsetPx;
  }

  return (
    <div
      ref={stripRef}
      className="w-full min-w-0 select-none overscroll-x-contain"
      style={{ touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointerGesture}
      onPointerCancel={endPointerGesture}
      onClickCapture={onClickCapture}
    >
      <div className="w-full overflow-hidden">
        <div
          ref={trackElRef}
          className={cn("flex will-change-transform", isDualTrack ? "w-[200%]" : "w-full")}
          style={{
            transform: isDualTrack ? `translate3d(${transformPx}px, 0, 0)` : undefined,
            transition: isSettling ? `transform ${WEEK_SLIDE_MS}ms ${WEEK_EASE}` : "none",
          }}
        >
          <div className={isDualTrack ? "w-1/2 shrink-0" : "w-full shrink-0"}>
            <WeekStripRow
              weekStart={leftWeekStart}
              tasksByDate={tasksByDate}
              selectedDate={selectedDate}
              onDateSelect={onDateSelect}
              isEmbedded={isEmbedded}
            />
          </div>
          {isDualTrack ? (
            <div className="w-1/2 shrink-0">
              <WeekStripRow
                weekStart={rightWeekStart}
                tasksByDate={tasksByDate}
                selectedDate={selectedDate}
                onDateSelect={onDateSelect}
                isEmbedded={isEmbedded}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});

export type { TaskDateData };

export interface FillaMiniCalendarProps {
  tasks?: any[];
  tasksByDate?: Map<string, TaskDateData>;
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
  month?: Date;
  onMonthChange?: (month: Date) => void;
  className?: string;
  /** Slightly tighter padding for intake modals */
  variant?: "sidebar" | "embedded";
  /** Initial expand state for collapsible sidebar calendar (default expanded). */
  defaultExpanded?: boolean;
  /** When true, selecting a date collapses to the week strip (schedule mobile). */
  collapseOnDateSelect?: boolean;
}

/**
 * Unified mini calendar — sidebar, calendar page, and intake modals.
 * Day fill reflects greatest task urgency on that date; dot reinforces urgency.
 */
export function FillaMiniCalendar({
  tasks = [],
  selectedDate,
  onDateSelect,
  month,
  onMonthChange,
  className,
  tasksByDate: providedTasksByDate,
  variant = "sidebar",
  defaultExpanded = true,
  collapseOnDateSelect = false,
}: FillaMiniCalendarProps) {
  const tasksByDate = useMemo(() => {
    if (providedTasksByDate) return providedTasksByDate;
    return buildTasksByDate(tasks);
  }, [providedTasksByDate, tasks]);

  const datesWithTasks = useMemo(() => {
    return Array.from(tasksByDate.keys())
      .map((key) => {
        try {
          const [y, m, d] = key.split("-").map(Number);
          return new Date(y, m - 1, d);
        } catch {
          return null;
        }
      })
      .filter((d): d is Date => d != null);
  }, [tasksByDate]);

  const isEmbedded = variant === "embedded";
  const isCollapsible = !isEmbedded;
  const [isExpanded, setIsExpanded] = useState(() => {
    if (!defaultExpanded) return false;
    if (collapseOnDateSelect && selectedDate) return false;
    return true;
  });
  const [internalMonth, setInternalMonth] = useState(
    () => month ?? selectedDate ?? new Date()
  );
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(selectedDate ?? new Date(), { weekStartsOn: WEEK_STARTS_ON })
  );
  const { expandedHeight } = miniCalendarRowMetrics(variant);
  const gridMaxHeight = expandedHeight;

  const containerRef = useRef<HTMLDivElement>(null);
  const weekStripRef = useRef<MiniCalendarWeekStripHandle>(null);
  const collapsedWeekRef = useRef<HTMLDivElement>(null);

  const displayMonth = month ?? internalMonth;

  useEffect(() => {
    if (month) setInternalMonth(month);
  }, [month]);

  useEffect(() => {
    if (!selectedDate) return;
    setWeekStart(startOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON }));
  }, [selectedDate]);

  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (collapseOnDateSelect && date && isExpanded) {
        setIsExpanded(false);
      }
      onDateSelect?.(date);
    },
    [collapseOnDateSelect, isExpanded, onDateSelect]
  );

  const handleMonthChange = useCallback(
    (newMonth: Date) => {
      if (month === undefined) setInternalMonth(newMonth);
      onMonthChange?.(newMonth);
    },
    [month, onMonthChange]
  );

  const handleWeekChange = useCallback(
    (nextWeekStart: Date) => {
      setWeekStart(nextWeekStart);
      handleMonthChange(startOfMonth(nextWeekStart));
    },
    [handleMonthChange]
  );

  const navigateWeek = useCallback((delta: -1 | 1) => {
    weekStripRef.current?.goWeek(delta);
  }, []);

  const handleToggleExpanded = () => {
    setIsExpanded((expanded) => !expanded);
  };

  const showWeekStrip = isCollapsible && !isExpanded;

  const renderDayButton = (props: {
    date: Date;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    className?: string;
  }) => {
    const { date, onClick, className: propClassName } = props;
    const dateKey = format(date, "yyyy-MM-dd");
    const dateData = tasksByDate.get(dateKey);
    const maxUrgency = resolveDayUrgency(dateData);
    const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
    const isTodayDate = isToday(date);
    const fill = dayCellBackground(maxUrgency, isSelected);
    const dot = dayDotColor(maxUrgency);

    return (
      <button
        type="button"
        onClick={(e) => {
          onClick?.(e);
          handleDateSelect(date);
        }}
        className={cn(
          propClassName,
          "relative font-mono rounded-card",
          "transition-[background-color,transform] duration-150 ease-out hover:bg-white/60 active:scale-90",
          isEmbedded ? "h-6 w-6" : "h-[26px] w-[26px]",
          isTodayDate && !isSelected && "ring-1 ring-primary/40"
        )}
        style={{
          backgroundColor: fill,
          ...(fill ? { boxShadow: MINI_CALENDAR_DAY_SHADOW } : undefined),
        }}
      >
        <span
          className={cn(
            isEmbedded ? "text-caption" : "text-sm",
            "font-medium",
            isTodayDate && !isSelected && "font-semibold"
          )}
        >
          {date.getDate()}
        </span>
        {dot ? (
          <span
            className="absolute top-[3px] left-[3px] h-1 w-1 rounded-full"
            style={{ backgroundColor: dot }}
            aria-hidden
          />
        ) : null}
      </button>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "filla-mini-calendar w-full",
        variant === "sidebar" &&
          "w-full max-w-full sm:max-w-[311px] rounded-xl border border-border/40 bg-card/60 p-3",
        className
      )}
      data-collapsed={showWeekStrip ? "true" : "false"}
    >
      {isCollapsible ? (
        <>
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
              isExpanded
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0 pointer-events-none"
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                month={displayMonth}
                onMonthChange={handleMonthChange}
                className={cn(
                  isEmbedded ? "max-w-[247px]" : "w-full max-w-full sm:max-w-[311px]"
                )}
                classNames={{
                  months: "flex flex-col w-full",
                  month: "space-y-3 w-full",
                  caption: "flex justify-between items-center px-0.5 mb-1",
                  caption_label: cn(
                    "font-semibold text-foreground",
                    isEmbedded ? "text-base" : "text-sm"
                  ),
                  nav: "flex h-[26px] items-center gap-[17px] pt-[3px]",
                  nav_button: cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,transform] duration-150 ease-out hover:bg-muted/50 active:scale-90"
                  ),
                  nav_button_previous: "",
                  nav_button_next: "",
                  table: "w-full border-collapse",
                  head: isEmbedded ? undefined : "h-6",
                  head_row: "flex w-full justify-between mb-0",
                  head_cell: cn(
                    "flex-1 text-center font-mono font-medium uppercase text-foreground",
                    "[&:nth-child(6)]:opacity-50 [&:nth-child(7)]:opacity-50",
                    isEmbedded ? "text-[0.65rem]" : "text-caption"
                  ),
                  row: "flex w-full justify-between mt-0.5",
                  tbody: cn(
                    "block overflow-hidden transition-[max-height] duration-300 ease-in-out",
                    isEmbedded ? "max-h-[192px]" : undefined
                  ),
                  cell: cn(
                    "relative flex flex-1 items-center justify-center p-0 text-center",
                    "[&:nth-child(6)]:opacity-50 [&:nth-child(7)]:opacity-50",
                    isEmbedded ? "h-[30px]" : "h-[28px]"
                  ),
                  day: cn(
                    "relative flex flex-col items-center justify-center rounded-sharp font-medium transition-colors",
                    isEmbedded ? "h-6 w-6 text-xs" : "h-[26px] w-[26px] text-sm"
                  ),
                  day_selected: "",
                  day_today: "",
                  day_outside: "text-muted-foreground/40",
                  day_disabled: "text-muted-foreground/30",
                  day_hidden: "invisible",
                }}
                modifiers={{ hasTasks: datesWithTasks }}
                formatters={{
                  formatWeekdayName: (date) => formatDate(date, "EEE").toUpperCase(),
                }}
                components={{
                  IconLeft: () => (
                    <ChevronLeft className="h-6 w-6 text-accent" strokeWidth={2.2} />
                  ),
                  IconRight: () => (
                    <ChevronRight className="h-6 w-6 text-accent" strokeWidth={2.2} />
                  ),
                  CaptionLabel: ({ displayMonth: captionMonth }) => (
                    <CalendarMonthYearLabel
                      date={captionMonth}
                      monthClassName={cn(
                        "font-semibold text-ink pl-[7px]",
                        isEmbedded ? "text-base" : "text-xl"
                      )}
                    />
                  ),
                  Day: renderDayButton,
                }}
                styles={{
                  tbody: { maxHeight: gridMaxHeight },
                }}
              />
            </div>
          </div>
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
              showWeekStrip
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0 pointer-events-none"
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div ref={collapsedWeekRef} className="w-full">
                <div className="mb-2 flex items-center justify-between px-0.5">
                  <CalendarMonthYearLabel
                    date={displayMonth}
                    monthClassName={cn(
                      "font-semibold text-ink pl-[7px]",
                      isEmbedded ? "text-base" : "text-xl"
                    )}
                  />
                  <div className="flex h-[26px] items-center gap-[17px] pt-[3px]">
                    <button
                      type="button"
                      onClick={() => navigateWeek(-1)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,transform] duration-150 ease-out hover:bg-muted/50 active:scale-90"
                      aria-label="Previous week"
                    >
                      <ChevronLeft className="h-6 w-6 text-accent" strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateWeek(1)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,transform] duration-150 ease-out hover:bg-muted/50 active:scale-90"
                      aria-label="Next week"
                    >
                      <ChevronRight className="h-6 w-6 text-accent" strokeWidth={2.2} />
                    </button>
                  </div>
                </div>
                <MiniCalendarWeekStrip
                  ref={weekStripRef}
                  weekStart={weekStart}
                  tasksByDate={tasksByDate}
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  onWeekChange={handleWeekChange}
                  isEmbedded={isEmbedded}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          month={displayMonth}
          onMonthChange={handleMonthChange}
          className={cn(isEmbedded ? "max-w-[247px]" : "w-full max-w-full sm:max-w-[311px]")}
          classNames={{
            months: "flex flex-col w-full",
            month: "space-y-3 w-full",
            caption: "flex justify-between items-center px-0.5 mb-1",
            caption_label: cn(
              "font-semibold text-foreground",
              isEmbedded ? "text-base" : "text-sm"
            ),
            nav: "flex h-[26px] items-center gap-[17px] pt-[3px]",
            nav_button: cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,transform] duration-150 ease-out hover:bg-muted/50 active:scale-90"
            ),
            nav_button_previous: "",
            nav_button_next: "",
            table: "w-full border-collapse",
            head: isEmbedded ? undefined : "h-6",
            head_row: "flex w-full justify-between mb-0",
            head_cell: cn(
              "flex-1 text-center font-mono font-medium uppercase text-foreground",
              "[&:nth-child(6)]:opacity-50 [&:nth-child(7)]:opacity-50",
              isEmbedded ? "text-[0.65rem]" : "text-caption"
            ),
            row: "flex w-full justify-between mt-0.5",
            tbody: cn(
              "block overflow-hidden transition-[max-height] duration-300 ease-in-out",
              isEmbedded ? "max-h-[192px]" : undefined
            ),
            cell: cn(
              "relative flex flex-1 items-center justify-center p-0 text-center",
              "[&:nth-child(6)]:opacity-50 [&:nth-child(7)]:opacity-50",
              isEmbedded ? "h-[30px]" : "h-[28px]"
            ),
            day: cn(
              "relative flex flex-col items-center justify-center rounded-sharp font-medium transition-colors",
              isEmbedded ? "h-6 w-6 text-xs" : "h-[26px] w-[26px] text-sm"
            ),
            day_selected: "",
            day_today: "",
            day_outside: "text-muted-foreground/40",
            day_disabled: "text-muted-foreground/30",
            day_hidden: "invisible",
          }}
          modifiers={{ hasTasks: datesWithTasks }}
          formatters={{
            formatWeekdayName: (date) => formatDate(date, "EEE").toUpperCase(),
          }}
          components={{
            IconLeft: () => <ChevronLeft className="h-6 w-6 text-accent" strokeWidth={2.2} />,
            IconRight: () => <ChevronRight className="h-6 w-6 text-accent" strokeWidth={2.2} />,
            CaptionLabel: ({ displayMonth: captionMonth }) => (
              <CalendarMonthYearLabel
                date={captionMonth}
                monthClassName={cn(
                  "font-semibold text-ink pl-[7px]",
                  isEmbedded ? "text-base" : "text-xl"
                )}
              />
            ),
            Day: renderDayButton,
          }}
        />
      )}
      {isCollapsible ? (
        <button
          type="button"
          onClick={handleToggleExpanded}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse calendar" : "Expand calendar"}
          className="mt-1 flex w-full items-center justify-center rounded-lg py-1 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
        >
          <ChevronUp
            className={cn(
              "h-4 w-4 transition-transform duration-300 ease-in-out",
              !isExpanded && "rotate-180"
            )}
            strokeWidth={2.2}
          />
        </button>
      ) : null}
      <style>{`
        .filla-mini-calendar .rdp-tbody {
          display: block;
        }
        .filla-mini-calendar .rdp-tbody .rdp-row {
          display: flex;
          width: 100%;
        }
      `}</style>
    </div>
  );
}
