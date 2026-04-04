/**
 * DashboardCalendarV2 — Three neumorphic spinners
 *
 * ┌──────────┐  ┌──────┐
 * │ February │  │ 2026 │   Month + year drums (top row)
 * │  March   │  │      │
 * └──────────┘  └──────┘
 *   Mo Tu We Th Fr Sa Su      weekday row (above card)
 * ┌─────────────────────────┐
 * │ 24 25 26 27 28  1  2   │   Dates spinner (neumorphic card)
 * │  …   (6 rows expanded, 2 when minimized) │
 * └─────────────────────────┘
 *
 * Scrolling the dates spinner drives the month/year drums via translateY.
 * Original: DashboardCalendar.tsx (unchanged)
 */
import { useState, useRef, useMemo, useCallback, useEffect, CSSProperties } from "react";
import {
  format,
  startOfMonth,
  addMonths,
  subMonths,
  startOfWeek,
  addDays,
  endOfMonth,
  isToday,
  isSameDay,
  isSameMonth,
} from "date-fns";
import { ArrowDownToDot, ChevronDown, ChevronUp, Expand, Shrink } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Layout ───────────────────────────────────────────────────────────────────
const DOW_H    = 29;                       // weekday header height (px)
const CELL_H   = 30;                       // each date row height (px)
const SEP_H    = 1;                        // month separator row height (px)
const ROWS_FULL = 6;                       // visible rows when expanded
const ROWS_MINIMIZED = 2;                  // visible rows when minimize control is active
/** Neumorphic date card: inner scroll viewport height */
const FRAME_PAD = 3;
const FRAME_H_FULL = ROWS_FULL * CELL_H + FRAME_PAD;
const FRAME_H_MIN = ROWS_MINIMIZED * CELL_H + FRAME_PAD;

const ITEM_H   = 32;                       // height of each drum item (month/year)
/** Viewport height for month/year drums (top row, above dates) */
const DRUM_VIEWPORT_H = 38;
// Centers selected drum item in DRUM_VIEWPORT_H
const DRUM_OFFSET = DRUM_VIEWPORT_H / 2 - ITEM_H / 2;

const DRUM_FADE_TOP_H = 12;
const DRUM_TICK_H = 26;

/** Inner track width: drum shell 102px − PRESSED_DRUM padding (11 + 3) under border-box */
const MONTH_W  = 88;
const YEAR_W   = 26;                       // year drum width (px)
const SPINNER_GAP = 6;                     // gap between month/year spinners (px)
const COL_GAP = 4;                         // gap between drums block and date panel (px)

/** <1 slightly dampens wheel/trackpad so rows don’t overshoot; higher = snappier. */
const DATE_SPINNER_WHEEL_DAMPING = 0.72;

/** Drum translate follows scroll; keep short so it doesn’t feel laggy behind the date strip. */
const DRUM_TRANS_MONTH = "transform 0.12s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const DRUM_TRANS_YEAR  = "transform 0.14s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// ─── Date range ───────────────────────────────────────────────────────────────
const MONTHS_BACK    = 1;
const MONTHS_FORWARD = 5;

const WEEK_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// ─── Types ────────────────────────────────────────────────────────────────────
interface TaskDateData { total: number; high: number; urgent: number; overdue: number; }

export interface DashboardCalendarV2Props {
  tasks?: any[];
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
  className?: string;
  tasksByDate?: Map<string, TaskDateData>;
}

type DateRow =
  | { type: "week"; dates: Date[]; month: Date; isFirst: boolean }
  | { type: "sep";  id: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizePriority(p: string | null | undefined): string {
  if (!p) return "normal";
  const n = p.toLowerCase();
  return n === "medium" ? "normal" : n;
}

function getFillColor(data: TaskDateData | undefined): string {
  if (!data || data.total === 0) return "";
  const { total, high, urgent, overdue } = data;
  const hot = urgent + overdue;
  if (hot >= 3)           return "hsl(var(--destructive) / 0.6)";
  if (high >= 3)          return "hsl(var(--accent) / 0.6)";
  if (hot >= 1 || high >= 1) return hot > 0 ? "hsl(var(--destructive) / 0.4)" : "hsl(var(--accent) / 0.4)";
  if (total >= 4)         return "hsl(var(--primary) / 0.6)";
  if (total >= 2)         return "hsl(var(--primary) / 0.5)";
  return "hsl(var(--primary) / 0.4)";
}

// Dates panel — neumorphic card surface
const PRESSED: CSSProperties = {
  background: "linear-gradient(0deg, rgba(204, 204, 204, 0.26) 0%, rgba(255, 255, 255, 0.5) 33%)",
  backgroundColor: "rgba(255, 255, 255, 0.5)",
  borderRadius: 12,
  boxShadow:
    "inset 4.4px 19.4px 16.7px -12.4px rgba(0, 0, 0, 0.39), 1px 1px 1px 0px rgba(255, 255, 255, 1), -1px -1px 1px 0px rgba(0, 0, 0, 0.09)",
};

// Month/year drums — flush transparent (no card fill)
const PRESSED_DRUM: CSSProperties = {
  background:   "unset",
  backgroundImage: "none",
  backgroundColor: "rgba(255, 255, 255, 0.4)",
  borderRadius: 12,
  paddingLeft: 3,
  paddingRight: 3,
  paddingTop: 1,
  boxShadow:
    "inset 4.4px 19.4px 16.7px -12.4px rgba(0, 0, 0, 0.39), 1px 1px 1px 0px rgba(255, 255, 255, 1), -1px -1px 1px 0px rgba(0, 0, 0, 0.09)",
};

// Gradient overlays fade out the non-selected drum items
function DrumFade({ position }: { position: "top" | "bottom" }) {
  const h = position === "top" ? DRUM_FADE_TOP_H : ITEM_H * 1.4;
  return (
    <div
      aria-hidden
      className="absolute inset-x-0 pointer-events-none z-10"
      style={{
        [position]: 0,
        height: h,
        ...(position === "top"
          ? { backgroundColor: "unset", backgroundImage: "none" }
          : { background: "unset" }),
      }}
    />
  );
}

// Thin selection band in the center of each drum
function DrumTick() {
  const tickTop = DRUM_OFFSET + (ITEM_H - DRUM_TICK_H) / 2;
  return (
    <div
      aria-hidden
      className="absolute inset-x-0 pointer-events-none z-20"
      style={{ top: tickTop, height: DRUM_TICK_H }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DashboardCalendarV2({
  tasks = [],
  selectedDate,
  onDateSelect,
  className,
  tasksByDate: providedTasksByDate,
}: DashboardCalendarV2Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const baseMonth = useMemo(() => startOfMonth(new Date()), []);

  // ── All months in range ────────────────────────────────────────────────────
  const allMonths = useMemo<Date[]>(() => {
    const list: Date[] = [];
    let c = startOfMonth(addMonths(baseMonth, -MONTHS_BACK));
    const end = endOfMonth(addMonths(baseMonth, MONTHS_FORWARD));
    while (c <= end) { list.push(c); c = addMonths(c, 1); }
    return list;
  }, [baseMonth]);

  // ── All years in range ─────────────────────────────────────────────────────
  const allYears = useMemo<number[]>(() => {
    const set = new Set<number>();
    allMonths.forEach(m => set.add(m.getFullYear()));
    return [...set].sort();
  }, [allMonths]);

  // ── Flat date rows: week rows + blank separators between months ───────────
  const dateRows = useMemo<DateRow[]>(() => {
    const result: DateRow[] = [];
    let first = true;
    for (const monthDate of allMonths) {
      const monthEnd = endOfMonth(monthDate);
      let wc = startOfWeek(monthDate, { weekStartsOn: 1 });
      const weeks: Date[][] = [];
      while (wc <= monthEnd) {
        weeks.push(Array.from({ length: 7 }, (_, i) => addDays(wc, i)));
        wc = addDays(wc, 7);
      }
      if (weeks.length === 0) continue;
      if (!first) result.push({ type: "sep", id: format(monthDate, "yyyy-MM-sep") });
      weeks.forEach((week, wi) =>
        result.push({ type: "week", dates: week, month: monthDate, isFirst: wi === 0 })
      );
      first = false;
    }
    return result;
  }, [allMonths]);

  // ── First row index for each month (for navigation) ───────────────────────
  const monthFirstRow = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    dateRows.forEach((row, i) => {
      if (row.type === "week" && row.isFirst) {
        const k = format(row.month, "yyyy-MM");
        if (!map.has(k)) map.set(k, i);
      }
    });
    return map;
  }, [dateRows]);

  // ── tasksByDate ────────────────────────────────────────────────────────────
  const tasksByDate = useMemo<Map<string, TaskDateData>>(() => {
    if (providedTasksByDate) return providedTasksByDate;
    const map   = new Map<string, TaskDateData>();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const add   = (str: string, priority?: string | null) => {
      try {
        const d = new Date(str); if (isNaN(d.getTime())) return;
        const k = format(d, "yyyy-MM-dd");
        const c = map.get(k) ?? { total: 0, high: 0, urgent: 0, overdue: 0 };
        c.total++;
        const norm = normalizePriority(priority);
        if (norm === "high") c.high++; else if (norm === "urgent") c.urgent++;
        const dm = new Date(d); dm.setHours(0, 0, 0, 0); if (dm < today) c.overdue++;
        map.set(k, c);
      } catch { /* skip */ }
    };
    tasks.forEach(t => {
      if (t.status === "completed" || t.status === "archived") return;
      const due = t.due_date || t.due_at; if (due) add(due, t.priority);
      if (Array.isArray(t.milestones))
        t.milestones.forEach((m: any) => { if (m?.dateTime) add(m.dateTime, t.priority); });
    });
    return map;
  }, [providedTasksByDate, tasks]);

  // ── Current visible month key (drives drum positions) ─────────────────────
  const [currentMonthKey, setCurrentMonthKey] = useState(() => format(baseMonth, "yyyy-MM"));
  /** Minimize: shrink date card to two visible rows (still scrollable); does not hide the panel. */
  const [calendarCollapsed, setCalendarCollapsed] = useState(false);
  const visibleFrameH = calendarCollapsed ? FRAME_H_MIN : FRAME_H_FULL;

  // Derived indices for drum animation
  const currentMonthIdx = useMemo(() => {
    const i = allMonths.findIndex(m => format(m, "yyyy-MM") === currentMonthKey);
    return i === -1 ? 0 : i;
  }, [allMonths, currentMonthKey]);

  const currentYearIdx = useMemo(() => {
    const year = allMonths[currentMonthIdx]?.getFullYear() ?? new Date().getFullYear();
    return Math.max(0, allYears.indexOf(year));
  }, [allMonths, allYears, currentMonthIdx]);

  const scrollOffsetForRowIndex = useCallback(
    (idx: number) => {
      let top = 0;
      for (let i = 0; i < idx && i < dateRows.length; i++) {
        top += dateRows[i].type === "sep" ? SEP_H : CELL_H;
      }
      return top;
    },
    [dateRows],
  );

  // ── Scroll handler — updates current month from center of viewport ─────────
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const centerY = el.scrollTop + visibleFrameH / 2;
    let acc = 0;
    for (let i = 0; i < dateRows.length; i++) {
      const row = dateRows[i];
      const h = row.type === "sep" ? SEP_H : CELL_H;
      if (centerY >= acc && centerY < acc + h) {
        if (row.type === "week") {
          const k = format(row.month, "yyyy-MM");
          setCurrentMonthKey(prev => (prev === k ? prev : k));
        }
        return;
      }
      acc += h;
    }
    const last = dateRows[dateRows.length - 1];
    if (last?.type === "week") {
      const k = format(last.month, "yyyy-MM");
      setCurrentMonthKey(prev => (prev === k ? prev : k));
    }
  }, [dateRows, visibleFrameH]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const scrollToMonth = useCallback(
    (month: Date, smooth = false) => {
      const key = format(month, "yyyy-MM");
      const rowIdx = monthFirstRow.get(key);
      if (rowIdx !== undefined) {
        scrollRef.current?.scrollTo({
          top: scrollOffsetForRowIndex(rowIdx),
          behavior: smooth ? "smooth" : "instant",
        });
      }
    },
    [monthFirstRow, scrollOffsetForRowIndex],
  );

  const goToToday = useCallback(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    scrollToMonth(startOfMonth(t));
    onDateSelect?.(t);
  }, [scrollToMonth, onDateSelect]);

  useEffect(() => { scrollToMonth(baseMonth, false); }, [scrollToMonth, baseMonth]);

  // Keep month drums aligned with the visible center when toggling two-row / six-row height.
  useEffect(() => {
    handleScroll();
  }, [calendarCollapsed, visibleFrameH, handleScroll]);

  // Dampen wheel/trackpad on the date spinner so month rows don’t fly past.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // let pinch-to-zoom pass through
      e.preventDefault();
      el.scrollTop += e.deltaY * DATE_SPINNER_WHEEL_DAMPING;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── Drum translateY — centers the selected item inside DRUM_VIEWPORT_H ─────
  // translateY = DRUM_OFFSET - selectedIdx * ITEM_H
  const monthDrumY = DRUM_OFFSET - currentMonthIdx * ITEM_H;
  const yearDrumY  = DRUM_OFFSET - currentYearIdx  * ITEM_H;

  const shownMonth = allMonths[currentMonthIdx] ?? baseMonth;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "dashboard-calendar-v2 w-full max-w-full min-w-0 overflow-x-hidden touch-pan-y",
        className,
      )}
    >
      <div
        className="flex flex-col mx-auto w-full min-w-0 max-w-full"
        style={{ gap: COL_GAP, width: 265, maxWidth: "100%", marginLeft: 0, marginRight: 0 }}
      >
        {/* ═══════════════ Month + year drums (above dates) ═════════════════ */}
        <div
          className="flex justify-start items-center shrink-0 w-full min-w-0 h-[46px] overflow-x-hidden"
          style={{ gap: SPINNER_GAP, paddingTop: 0, paddingBottom: 5, paddingLeft: 0, paddingRight: 4 }}
        >
          {/* Month drum */}
          <div
            className="relative overflow-hidden shrink-0"
            style={{
              ...PRESSED_DRUM,
              paddingLeft: 11,
              width: 102,
              height: DRUM_VIEWPORT_H,
              display: "flex",
              flexWrap: "wrap",
              boxShadow:
                "inset 4.4px 19.4px 16.7px -12.4px rgba(0, 0, 0, 0.39), 1px 1px 1px 0px rgba(255, 255, 255, 1), -1px -1px 1px 0px rgba(0, 0, 0, 0.09)",
            }}
          >
            <DrumFade position="top" />
            <DrumTick />
            <DrumFade position="bottom" />

            <div
              style={{
                transform:  `translateY(${monthDrumY}px)`,
                transition: DRUM_TRANS_MONTH,
                willChange: "transform",
              }}
            >
              {allMonths.map((m, mi) => (
                <div
                  key={format(m, "yyyy-MM")}
                  style={{
                    height: ITEM_H,
                    width: MONTH_W,
                    marginLeft: 0,
                    marginRight: 0,
                    paddingLeft: 4,
                    paddingRight: 4,
                  }}
                  className="flex items-center justify-start cursor-pointer select-none"
                  onClick={() => scrollToMonth(m)}
                >
                  <span
                    className={cn(
                      "text-[16px] font-semibold leading-none transition-opacity duration-200 text-center px-1",
                      mi === currentMonthIdx
                        ? "text-foreground opacity-100"
                        : "text-muted-foreground opacity-35",
                    )}
                  >
                    {format(m, "MMMM")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Year drum */}
          <div
            className="relative overflow-hidden shrink-0"
            style={{ ...PRESSED_DRUM, width: YEAR_W, height: DRUM_VIEWPORT_H }}
          >
            <DrumFade position="top" />
            <DrumTick />
            <DrumFade position="bottom" />

            <div
              style={{
                transform:  `translateY(${yearDrumY}px)`,
                transition: DRUM_TRANS_YEAR,
                willChange: "transform",
              }}
            >
              {allYears.map((y, yi) => (
                <div
                  key={y}
                  style={{ height: ITEM_H }}
                  className="flex items-center justify-center select-none"
                >
                  <div
                    className={cn(
                      "text-[11px] font-mono font-semibold leading-none transition-opacity duration-200 flex flex-col items-center",
                      yi === currentYearIdx
                        ? "text-foreground opacity-100"
                        : "text-muted-foreground opacity-35",
                    )}
                  >
                    <span>{String(y).slice(0, 2)}</span>
                    <span>{String(y).slice(2, 4)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Month nav chevrons — right of year */}
          <div className="flex flex-col gap-[1px] justify-center items-center shrink-0">
            <button
              onClick={() => scrollToMonth(addMonths(shownMonth, 1))}
              className="grid place-items-center text-transparent hover:bg-muted/40 transition-colors"
              style={{
                width: 24,
                height: 20,
                borderRadius: "8px 8px 0 0",
                color: "rgba(143, 141, 138, 0)",
                boxShadow:
                  "3.4px 1.4px 2px -1.5px rgba(0, 0, 0, 0.15), inset 1px 1px 2px 0px rgba(255, 255, 255, 1)",
              }}
              aria-label="Next month"
            >
              <ChevronUp size={15} className="text-[#EB6834]" style={{ height: 13, fontSize: 20 }} />
            </button>
            <button
              onClick={() => scrollToMonth(subMonths(shownMonth, 1))}
              className="grid place-items-center text-transparent hover:bg-muted/40 transition-colors"
              style={{
                width: 24,
                height: 20,
                borderRadius: "0 0 8px 8px",
                color: "rgba(143, 141, 138, 0)",
                boxShadow:
                  "3.4px 1.4px 2px -1.5px rgba(0, 0, 0, 0.15), inset 1px 1px 2px 0px rgba(255, 255, 255, 1)",
              }}
              aria-label="Previous month"
            >
              <ChevronDown size={15} className="text-[#EB6834]" style={{ height: 13, fontSize: 20 }} />
            </button>
          </div>

          {/* Today + collapse — stacked, row end */}
          <div className="ml-auto flex h-[42px] flex-col gap-[1px] justify-start items-center shrink-0">
            <button
              type="button"
              onClick={goToToday}
              className="flex flex-col justify-center items-center rounded-t-[10px] rounded-b-none text-muted-foreground hover:text-primary hover:bg-muted/40 transition-colors shrink-0"
              style={{
                width: 26,
                height: 20,
                boxShadow:
                  "2px 3px 2px -1.5px rgba(0, 0, 0, 0.15), inset 1px 1px 1px 0px rgba(255, 255, 255, 1)",
              }}
              aria-label="Go to today"
            >
              <ArrowDownToDot
                className="text-[hsl(var(--primary))]"
                size={14}
                strokeWidth={1.75}
                style={{ marginBottom: -5 }}
              />
            </button>
            <button
              type="button"
              onClick={() => setCalendarCollapsed(c => !c)}
              className="flex flex-col justify-center items-center text-muted-foreground hover:text-primary hover:bg-muted/40 transition-colors shrink-0 rounded-t-none rounded-b-[10px]"
              style={{
                width: 26,
                height: 20,
                boxShadow:
                  "2px 3px 2px -1.5px rgba(0, 0, 0, 0.15), inset 1px 1px 1px 0px rgba(255, 255, 255, 1)",
              }}
              aria-expanded={!calendarCollapsed}
              aria-label={
                calendarCollapsed
                  ? "Expand date grid to six rows"
                  : "Minimize date grid to two rows"
              }
            >
              {calendarCollapsed ? (
                <Expand
                  size={14}
                  strokeWidth={2}
                  className="text-[#8EC9CE]"
                />
              ) : (
                <Shrink
                  size={14}
                  strokeWidth={2}
                  className="text-[#8EC9CE]"
                />
              )}
            </button>
          </div>
        </div>

        <div
          className="flex flex-col w-full min-w-0 pt-0 pb-[4px] px-[3px]"
          style={{ gap: 0 }}
        >
            {/* Weekday labels sit above the neumorphic date card (not inside it) */}
            <div
              className="flex justify-around items-center shrink-0 w-full min-w-0 font-mono"
              style={{ height: DOW_H, paddingLeft: 15, paddingRight: 13 }}
            >
              {WEEK_DAYS.map(d => (
                <div
                  key={d}
                  className="flex-1 text-center text-[10px] font-mono text-muted-foreground"
                  style={{ maxWidth: 28 }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* ═══════════════ Dates spinner (full width, card surface) ═══════════ */}
            <div
              className="w-full min-w-0 flex flex-col overflow-hidden transition-[height] duration-300 ease-out"
              style={{ ...PRESSED, height: visibleFrameH, paddingLeft: 10, paddingRight: 10 }}
            >
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                style={{
                  height:                visibleFrameH,
                  overflowY:             "scroll",
                  overflowX:             "hidden",
                  scrollSnapType:        "y mandatory",
                  scrollbarWidth:        "none",
                  flexShrink:            0,
                  transition:            "height 300ms ease-out",
                  touchAction:           "pan-y",
                  overscrollBehaviorX:   "contain",
                }}
              >
                {dateRows.map((row, rowIdx) => {
              if (row.type === "sep") {
                return (
                  <div
                    key={row.id}
                    style={{
                      height: 5,
                      flexShrink: 0,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      paddingInline: 4,
                      padding: "2px 0px",
                      borderWidth: "1px 0px 0px",
                      borderColor: "rgba(0, 0, 0, 0.05) rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)",
                      boxShadow: "inset 1px 1px 1px 0px rgba(255, 255, 255, 0.51)",
                    }}
                  >
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1"
                        style={{ maxWidth: 28, backgroundColor: "unset", background: "unset", height: 2 }}
                      />
                    ))}
                  </div>
                );
              }

              const { dates, month } = row;
              return (
                <div
                  key={rowIdx}
                  style={{
                    height:          CELL_H,
                    display:         "flex",
                    justifyContent:  "space-around",
                    alignItems:      "center",
                    paddingInline:   4,
                    flexShrink:      0,
                    scrollSnapAlign: "start",
                  }}
                >
                  {dates.map(date => {
                    const key       = format(date, "yyyy-MM-dd");
                    const data      = tasksByDate.get(key);
                    const hasTasks  = (data?.total ?? 0) > 0;
                    const weekend   = date.getDay() === 0 || date.getDay() === 6;
                    const outside   = !isSameMonth(date, month);
                    const todayDate = !outside && isToday(date);
                    const selected  = !outside && selectedDate ? isSameDay(date, selectedDate) : false;
                    const showMarkers = !outside;
                    const fill      = selected || !showMarkers ? "" : getFillColor(data);

                    return (
                      <div
                        key={key}
                        className="flex-1 flex items-center justify-center"
                        style={{ maxWidth: 28 }}
                      >
                        <button
                          onClick={() => onDateSelect?.(date)}
                          className={cn(
                            "relative font-mono font-normal grid place-items-center text-[11px] p-0 shrink-0",
                            selected  && "font-semibold",
                            outside   && !selected && "text-transparent",
                          )}
                          style={{
                            width:           24,
                            height:          24,
                            marginTop:       0,
                            marginBottom:    0,
                            paddingLeft:     0,
                            paddingRight:    0,
                            paddingTop:      0,
                            paddingBottom:   0,
                            borderWidth:     0,
                            borderStyle:     "none",
                            borderColor:     "transparent",
                            borderTopColor:  "rgba(255, 255, 255, 1)",
                            borderTopWidth:  0,
                            borderImage:     "none",
                            backgroundColor: selected ? "rgba(255, 255, 255, 0.66)" : fill || undefined,
                            borderRadius:    showMarkers && todayDate ? 7 : hasTasks ? 8 : 9999,
                            boxShadow:       showMarkers && hasTasks && !selected
                              ? "1px 1px 1px 0px rgba(255, 255, 255, 1), inset 3px 5px 3px -1.5px rgba(0, 0, 0, 0.2), -1px -1px 1px 0px rgba(0, 0, 0, 0.15)"
                              : undefined,
                            color:
                              !outside
                                ? "rgba(42, 41, 62, 1)"
                                : undefined,
                          }}
                        >
                          <span
                            className={weekend && !selected ? "opacity-50" : undefined}
                          >
                            {date.getDate()}
                          </span>
                          {showMarkers && todayDate && !selected && (
                            <span
                              aria-hidden
                              className="absolute rounded-[12px] bg-white/90 border-[3px] border-white -z-[1] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                              style={{ width: 24, height: 24, pointerEvents: "none" }}
                            />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}

                <div style={{ height: visibleFrameH, flexShrink: 0 }} />
              </div>
            </div>
          </div>
      </div>

    </div>
  );
}
