/**
 * DashboardCalendarV2 — Continuous day scroller with scroll-synced month header
 *
 * Layout (all fixed except the scroll body):
 *   ┌─────────────────────────┐
 *   │  March  ²⁰/₂₆          │  ← animated header, syncs with scroll
 *   │  Mo Tu We Th Fr Sa Su   │  ← fixed weekday row
 *   ├─────────────────────────┤
 *   │  23 24 25 26 27 28 29   │  ← continuous day scroll, no month gaps
 *   │  30 31                  │
 *   │        1  2  3  4  5   │
 *   │   6  7  8  9 10 11 12  │
 *   └─────────────────────────┘
 *
 * Header flip: at 40% of next month visible → start; 70% → complete.
 * Animation is driven purely by scrollTop — no timers, no transitions.
 *
 * Original: DashboardCalendar.tsx (unchanged)
 */
import { useState, useRef, useMemo, useCallback, useEffect } from "react";
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
import { cn } from "@/lib/utils";

// ─── Layout ───────────────────────────────────────────────────────────────────
const HEADER_H  = 40;  // animated month/year row
const DOW_H     = 22;  // fixed weekday label row
const CELL_H    = 30;  // each week row
const ROWS_VIS  = 6;   // rows visible at once
const FRAME_H   = ROWS_VIS * CELL_H; // 180 px

// ─── Date range ───────────────────────────────────────────────────────────────
const MONTHS_BACK    = 4;
const MONTHS_FORWARD = 20;

// ─── Flip thresholds ─────────────────────────────────────────────────────────
const FLIP_START = 0.40; // entering month fraction at which title starts animating
const FLIP_END   = 0.70; // fraction at which title is fully changed

const WEEK_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// ─── Types ────────────────────────────────────────────────────────────────────
interface TaskDateData { total: number; high: number; urgent: number; overdue: number; }

export interface DashboardCalendarV2Props {
  tasks?: any[];
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
  className?: string;
  tasksByDate?: Map<string, TaskDateData>;
}

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
  if (hot >= 3) return "hsl(var(--destructive) / 0.6)";
  if (high >= 3) return "hsl(var(--accent) / 0.6)";
  if (hot >= 1 || high >= 1) return hot > 0 ? "hsl(var(--destructive) / 0.4)" : "hsl(var(--accent) / 0.4)";
  if (total >= 4) return "hsl(var(--primary) / 0.6)";
  if (total >= 2) return "hsl(var(--primary) / 0.5)";
  return "hsl(var(--primary) / 0.4)";
}

/** Small stacked year block — "20" over "26" */
function YearStack({ month }: { month: Date }) {
  const y = format(month, "yyyy");
  return (
    <div className="flex flex-col items-center leading-none shrink-0">
      <span className="text-[9px] font-mono font-medium text-muted-foreground/55 leading-none">
        {y.slice(0, 2)}
      </span>
      <span className="text-[9px] font-mono font-medium text-muted-foreground/55 leading-none mt-[1px]">
        {y.slice(2)}
      </span>
    </div>
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
  const scrollRef      = useRef<HTMLDivElement>(null);
  const lastScrollTop  = useRef(0);
  const baseMonth      = useMemo(() => startOfMonth(new Date()), []);

  // ── Title animation state ──────────────────────────────────────────────────
  // exitMonth  = month currently shown (or sliding out)
  // enterMonth = month sliding in
  // progress   = 0 (not started) → 1 (complete), driven by scrollTop
  // direction  = +1 entering from below (forward), -1 entering from above (backward)
  const [title, setTitle] = useState(() => ({
    exitMonth:  baseMonth,
    enterMonth: addMonths(baseMonth, 1),
    progress:   0,
    direction:  1 as 1 | -1,
  }));

  // ── Generate all week rows ─────────────────────────────────────────────────
  const weeks = useMemo(() => {
    const start    = addMonths(baseMonth, -MONTHS_BACK);
    const end      = addMonths(baseMonth, MONTHS_FORWARD);
    let   cursor   = startOfWeek(start, { weekStartsOn: 1 });
    const endDate  = endOfMonth(end);
    const rows: Date[][] = [];
    while (cursor <= endDate) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) { week.push(cursor); cursor = addDays(cursor, 1); }
      rows.push(week);
    }
    return rows;
  }, [baseMonth]);

  // ── Primary month for each row (majority-month of the 7 dates) ────────────
  const rowMonths = useMemo(() =>
    weeks.map(week => {
      const counts = new Map<string, number>();
      week.forEach(d => { const k = format(d, "yyyy-MM"); counts.set(k, (counts.get(k) ?? 0) + 1); });
      const [key] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      const [y, m] = key.split("-").map(Number);
      return new Date(y, m - 1, 1);
    }),
  [weeks]);

  // ── First row index for each calendar month (for navigation) ──────────────
  const monthFirstRow = useMemo(() => {
    const map = new Map<string, number>();
    rowMonths.forEach((m, i) => {
      const k = format(m, "yyyy-MM");
      if (!map.has(k)) map.set(k, i);
    });
    return map;
  }, [rowMonths]);

  // ── tasksByDate ────────────────────────────────────────────────────────────
  const tasksByDate = useMemo<Map<string, TaskDateData>>(() => {
    if (providedTasksByDate) return providedTasksByDate;
    const map   = new Map<string, TaskDateData>();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const add = (str: string, priority: string | null | undefined) => {
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
      if (Array.isArray(t.milestones)) t.milestones.forEach((m: any) => { if (m?.dateTime) add(m.dateTime, t.priority); });
    });
    return map;
  }, [providedTasksByDate, tasks]);

  // ── Scroll → title state ───────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollTop  = el.scrollTop;
    const direction  = (scrollTop >= lastScrollTop.current ? 1 : -1) as 1 | -1;
    lastScrollTop.current = scrollTop;

    const firstRow  = Math.max(0, Math.floor(scrollTop / CELL_H));
    const lastRow   = Math.min(Math.ceil((scrollTop + FRAME_H) / CELL_H) - 1, weeks.length - 1);
    const totalRows = Math.max(lastRow - firstRow + 1, 1);

    // Group consecutive rows into month blocks (top → bottom)
    const groups: { month: Date; rows: number }[] = [];
    for (let r = firstRow; r <= lastRow; r++) {
      const m = rowMonths[r];
      if (!m) continue;
      const prev = groups[groups.length - 1];
      if (prev && isSameMonth(prev.month, m)) { prev.rows++; }
      else { groups.push({ month: new Date(m.getTime()), rows: 1 }); }
    }
    if (groups.length === 0) return;

    if (groups.length === 1) {
      // Single month visible — no transition
      setTitle(prev => ({
        exitMonth:  groups[0].month,
        enterMonth: direction === 1 ? addMonths(groups[0].month, 1) : subMonths(groups[0].month, 1),
        progress:   0,
        direction,
      }));
      return;
    }

    // Multiple months visible
    // The "entering" month is at the bottom for forward scroll, top for backward scroll
    const enterGroup = direction === 1 ? groups[groups.length - 1] : groups[0];
    const exitGroup  = direction === 1 ? groups[0]                 : groups[groups.length - 1];

    const fraction   = enterGroup.rows / totalRows;
    const raw        = (fraction - FLIP_START) / (FLIP_END - FLIP_START);
    const progress   = Math.max(0, Math.min(1, raw));

    setTitle({ exitMonth: exitGroup.month, enterMonth: enterGroup.month, progress, direction });
  }, [weeks.length, rowMonths]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const scrollToMonth = useCallback((month: Date, smooth = true) => {
    const key = format(month, "yyyy-MM");
    const row = monthFirstRow.get(key);
    if (row !== undefined) {
      scrollRef.current?.scrollTo({ top: row * CELL_H, behavior: smooth ? "smooth" : "instant" });
    }
  }, [monthFirstRow]);

  useEffect(() => { scrollToMonth(baseMonth, false); }, [scrollToMonth, baseMonth]);

  // Shown month for nav button labels (switches at 50% progress)
  const shownMonth = title.progress >= 0.5 ? title.enterMonth : title.exitMonth;

  // ── Scroll-driven header translateY values ─────────────────────────────────
  // Exit  title: slides toward direction * -100% as progress → 1
  // Enter title: slides from direction * +100% toward 0      as progress → 1
  const exitY  = title.direction * -100 * title.progress;
  const enterY = title.direction * 100  * (1 - title.progress);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={cn("dashboard-calendar-v2 w-full", className)}>
      <div className="w-full max-w-[280px] mx-auto">

        {/* ── Animated month header ──────────────────────────────────────── */}
        <div className="relative overflow-hidden" style={{ height: HEADER_H }}>
          {/* Exiting month title */}
          <div
            className="absolute inset-0 flex items-center gap-1.5 px-[10px]"
            style={{ transform: `translateY(${exitY}%)`, willChange: "transform" }}
          >
            <span className="text-xl font-semibold text-foreground leading-none">
              {format(title.exitMonth, "MMMM")}
            </span>
            <YearStack month={title.exitMonth} />
          </div>

          {/* Entering month title — only rendered when transition is active */}
          {title.progress > 0 && (
            <div
              className="absolute inset-0 flex items-center gap-1.5 px-[10px]"
              style={{ transform: `translateY(${enterY}%)`, willChange: "transform" }}
            >
              <span className="text-xl font-semibold text-foreground leading-none">
                {format(title.enterMonth, "MMMM")}
              </span>
              <YearStack month={title.enterMonth} />
            </div>
          )}
        </div>

        {/* ── Fixed weekday row ──────────────────────────────────────────── */}
        <div
          className="flex justify-around items-center px-[2px]"
          style={{ height: DOW_H }}
        >
          {WEEK_DAYS.map(d => (
            <div
              key={d}
              className="flex-1 max-w-[32px] text-center text-xs font-mono font-normal text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* ── Continuous day scroll ──────────────────────────────────────── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            height: FRAME_H,
            overflowY: "scroll",
            scrollSnapType: "y mandatory",
            scrollbarWidth: "none",
          }}
        >
          {weeks.map((week, rowIdx) => (
            <div
              key={rowIdx}
              className="flex justify-around items-center px-[2px]"
              style={{ height: CELL_H, scrollSnapAlign: "start", flexShrink: 0 }}
            >
              {week.map(date => {
                const key      = format(date, "yyyy-MM-dd");
                const data     = tasksByDate.get(key);
                const hasTasks = (data?.total ?? 0) > 0;
                const todayDate = isToday(date);
                const selected  = selectedDate ? isSameDay(date, selectedDate) : false;
                const weekend   = date.getDay() === 0 || date.getDay() === 6;
                const fill      = selected ? "" : getFillColor(data);

                return (
                  <div key={key} className="flex-1 max-w-[32px] flex items-center justify-center">
                    <button
                      onClick={() => onDateSelect?.(date)}
                      className={cn(
                        "relative font-mono font-normal grid items-center justify-center text-xs p-0",
                        selected && "text-white font-semibold",
                        !selected && todayDate && "font-semibold text-foreground",
                      )}
                      style={{
                        width:  "28px",
                        height: "28px",
                        backgroundColor: selected ? "hsl(var(--primary))" : fill || undefined,
                        borderRadius: todayDate ? "8px" : hasTasks ? "10px" : "9999px",
                        boxShadow: hasTasks && !selected
                          ? "inset -1px -2px 2px 0px rgba(255,255,255,0.41), inset 3px 3px 4px 0px rgba(0,0,0,0.17)"
                          : undefined,
                      }}
                    >
                      {/* Weekend opacity matches original — on inner span */}
                      <span className={weekend && !selected ? "opacity-50" : undefined}>
                        {date.getDate()}
                      </span>
                      {todayDate && !selected && (
                        <span
                          aria-hidden
                          className="absolute w-8 h-8 rounded-[12px] border-2 border-white bg-white/90 -z-[1] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
          {/* Trailing spacer — lets the last week row snap to the top */}
          <div style={{ height: FRAME_H, flexShrink: 0 }} />
        </div>

        {/* ── Navigation strip ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-1 mt-2">
          <button
            onClick={() => scrollToMonth(subMonths(shownMonth, 1))}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#EB6834]">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs font-mono">{format(subMonths(shownMonth, 1), "MMM")}</span>
          </button>

          <button
            onClick={() => scrollToMonth(baseMonth)}
            className="text-[11px] font-mono text-muted-foreground hover:text-primary transition-colors px-2 py-1.5 rounded-lg hover:bg-muted/40"
          >
            today
          </button>

          <button
            onClick={() => scrollToMonth(addMonths(shownMonth, 1))}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <span className="text-xs font-mono">{format(addMonths(shownMonth, 1), "MMM")}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#EB6834]">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

      </div>
    </div>
  );
}
