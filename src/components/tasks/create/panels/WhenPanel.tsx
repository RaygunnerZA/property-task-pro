/**
 * WhenPanel - Task Context Resolver for timing
 *
 * Layout: Two-column — horizontal date scroller (left, 110px) + vertical time wheels (right)
 *
 * Capsule = window. Selected item is sharp/clear inside a neumorphic capsule.
 * Items outside the capsule are progressively blurred + faded.
 * Day abbreviation stacks over date number inside each cell.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { RepeatRule } from "@/types/database";
import { cn } from "@/lib/utils";
import { format, parseISO, addDays, startOfDay, isSameDay } from "date-fns";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WhenPanelProps {
  dueDate: string;
  repeatRule?: RepeatRule;
  onDueDateChange: (date: string) => void;
  onRepeatRuleChange: (rule: RepeatRule | undefined) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const quickDates = [
  { label: "TODAY", days: 0 },
  { label: "TOM", days: 1 },
  { label: "+7D", days: 7 },
  { label: "+14D", days: 14 },
];

const months = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// Calendar
const DATE_CELL_W = 24;   // width of one date cell
const STRIP_W = 110;      // total calendar column width
const DATE_CAPSULE_W = 32; // capsule slightly wider than cell for padding
const LEFT_PAD = 32; // padding so item 0 can centre

// Time wheels
const TIME_CELL_H = 26;   // height of one time row
const TIME_VISIBLE = 3;   // rows visible (prev / selected / next)

/* ------------------------------------------------------------------ */
/*  Helpers: blur + opacity by distance from capsule centre            */
/*  distance 0 = inside capsule = CLEAR                                */
/*  distance 1+ = outside capsule = BLURRED + FADED                    */
/* ------------------------------------------------------------------ */

function itemStyle(distance: number): React.CSSProperties {
  if (distance === 0) return { opacity: 1, filter: "none" };
  if (distance === 1) return { opacity: 0.4, filter: "blur(1.5px)" };
  if (distance === 2) return { opacity: 0.15, filter: "blur(3px)" };
  return { opacity: 0, filter: "blur(4px)", pointerEvents: "none" };
}

/* ------------------------------------------------------------------ */
/*  ScrollWheel – vertical scroll-snap wheel (hours / minutes / ampm) */
/* ------------------------------------------------------------------ */

function ScrollWheel({
  values,
  selectedIndex,
  onSelect,
  formatValue = (v: string | number) => String(v).padStart(2, "0"),
  width = 32,
  capsuleBg,
  capsuleStyle,
  textStyle,
}: {
  values: (string | number)[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  formatValue?: (v: string | number) => string;
  width?: number;
  capsuleBg?: string;
  capsuleStyle?: React.CSSProperties;
  textStyle?: React.CSSProperties;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScroll = useRef(true);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Programmatically scroll to selected item
  useEffect(() => {
    if (!scrollRef.current) return;
    isUserScroll.current = false;
    scrollRef.current.scrollTo({ top: selectedIndex * TIME_CELL_H, behavior: "auto" });
    const id = setTimeout(() => { isUserScroll.current = true; }, 100);
    return () => clearTimeout(id);
  }, [selectedIndex]);

  // Debounced scroll handler – only commit after user stops scrolling
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !isUserScroll.current) return;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      if (!scrollRef.current) return;
      const idx = Math.round(scrollRef.current.scrollTop / TIME_CELL_H);
      if (idx >= 0 && idx < values.length && idx !== selectedIndex) {
        onSelect(idx);
      }
      // Snap to exact position
      scrollRef.current.scrollTo({ top: idx * TIME_CELL_H, behavior: "smooth" });
    }, 120);
  }, [values.length, selectedIndex, onSelect]);

  const totalH = TIME_CELL_H * TIME_VISIBLE;
  const pad = TIME_CELL_H; // one row of padding top & bottom

  // Track visual center during scroll for live blur updates
  const [visualIdx, setVisualIdx] = useState(selectedIndex);
  useEffect(() => { setVisualIdx(selectedIndex); }, [selectedIndex]);

  const handleScrollVisual = useCallback(() => {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollTop / TIME_CELL_H);
    setVisualIdx(idx);
    handleScroll();
  }, [handleScroll]);

  return (
    <div className="relative" style={{ width }}>
      {/* Capsule – sits behind content (z-0) */}
      <div
        className={cn("absolute left-0 right-0 rounded-[8px] pointer-events-none shadow-[inset_2px_6.4px_4px_0px_rgba(0,0,0,0.15),inset_0px_-1px_1px_0px_rgba(255,255,255,1),inset_0px_3px_2px_-1px_rgba(0,0,0,0.2)]", capsuleBg || "bg-[rgba(233,230,226,1)]")}
        style={{ top: 21, height: 36, zIndex: 0, ...capsuleStyle }}
      />

      {/* Scrollable items – z-1, per-item blur based on distance from visual centre */}
      <div
        ref={scrollRef}
        onScroll={handleScrollVisual}
        className="relative overflow-y-auto no-scrollbar"
        style={{
          height: totalH,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          zIndex: 1,
        }}
      >
        <div style={{ height: pad }} />

        {values.map((value, idx) => {
          const dist = Math.abs(idx - visualIdx);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelect(idx)}
              className="w-full flex items-center justify-center font-mono text-xs select-none cursor-pointer text-foreground transition-[filter,opacity] duration-100"
              style={{
                height: TIME_CELL_H,
                ...itemStyle(dist),
                ...textStyle,
              }}
            >
              {formatValue(value)}
            </button>
          );
        })}

        <div style={{ height: pad }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  WhenPanel                                                          */
/* ------------------------------------------------------------------ */

export function WhenPanel({
  dueDate,
  repeatRule,
  onDueDateChange,
  onRepeatRuleChange,
}: WhenPanelProps) {
  const [enableRepeat, setEnableRepeat] = useState(!!repeatRule);
  const dateScrollRef = useRef<HTMLDivElement>(null);
  const dateScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------- date parsing ---------- */

  const selectedDate = useMemo(() => {
    if (!dueDate) return new Date();
    try { return parseISO(dueDate.split("T")[0]); }
    catch { return new Date(); }
  }, [dueDate]);

  const dueTime = dueDate.includes("T") ? dueDate.split("T")[1]?.slice(0, 5) : "09:00";
  const [hour, minute] = useMemo(() => {
    if (dueTime) { const [h, m] = dueTime.split(":").map(Number); return [h || 9, m || 0]; }
    return [9, 0];
  }, [dueTime]);

  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const isPM = hour >= 12;

  /* ---------- date strip ---------- */

  const dateOptions = useMemo(() => {
    const today = startOfDay(new Date());
    const dates: Date[] = [];
    for (let i = -7; i <= 28; i++) dates.push(addDays(today, i));
    return dates;
  }, []);

  const selectedDateIndex = useMemo(
    () => dateOptions.findIndex((d) => isSameDay(d, selectedDate)),
    [dateOptions, selectedDate],
  );

  // Centre the selected date in the scroll container
  useEffect(() => {
    if (!dateScrollRef.current) return;
    // Scroll position: the item at selectedDateIndex should be at the capsule centre.
    // Items start after LEFT_PAD of padding. Item N's left edge = LEFT_PAD + N * DATE_CELL_W.
    // We want that item's centre aligned with the container centre (STRIP_W / 2).
    // scrollLeft = LEFT_PAD + idx * CELL_W + CELL_W/2 - STRIP_W/2
    const scrollLeft = LEFT_PAD + selectedDateIndex * DATE_CELL_W + DATE_CELL_W / 2 - STRIP_W / 2;
    dateScrollRef.current.scrollTo({ left: Math.max(0, scrollLeft), behavior: "auto" });
  }, [selectedDateIndex]);

  // Track which item index is visually centred during scroll (for live blur)
  const [visualCenterIdx, setVisualCenterIdx] = useState(selectedDateIndex);
  useEffect(() => { setVisualCenterIdx(selectedDateIndex); }, [selectedDateIndex]);

  // Live visual tracking + debounced commit
  const handleDateScroll = useCallback(() => {
    if (!dateScrollRef.current) return;
    const scrollLeft = dateScrollRef.current.scrollLeft;
    // Reverse of the centering formula: idx = (scrollLeft - LEFT_PAD + STRIP_W/2 - CELL_W/2) / CELL_W
    const rawIdx = (scrollLeft - LEFT_PAD + STRIP_W / 2 - DATE_CELL_W / 2) / DATE_CELL_W;
    const idx = Math.round(rawIdx);
    setVisualCenterIdx(Math.max(0, Math.min(dateOptions.length - 1, idx)));

    // Debounced commit: select the date after scroll settles
    if (dateScrollTimer.current) clearTimeout(dateScrollTimer.current);
    dateScrollTimer.current = setTimeout(() => {
      if (!dateScrollRef.current) return;
      const finalIdx = Math.max(0, Math.min(dateOptions.length - 1, idx));
      if (finalIdx !== selectedDateIndex && dateOptions[finalIdx]) {
        handleDateSelect(dateOptions[finalIdx]);
      }
      // Snap to exact position
      const snapLeft = LEFT_PAD + finalIdx * DATE_CELL_W + DATE_CELL_W / 2 - STRIP_W / 2;
      dateScrollRef.current.scrollTo({ left: Math.max(0, snapLeft), behavior: "smooth" });
    }, 150);
  }, [dateOptions, selectedDateIndex]);

  const handleDateSelect = (date: Date) => {
    const d = format(date, "yyyy-MM-dd");
    const t = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    onDueDateChange(`${d}T${t}`);
  };

  /* ---------- time wheels ---------- */

  const hourValues = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const hourIndex = hour12 - 1;

  const minuteValues = useMemo(() => [0, 15, 30, 45], []);
  const minuteIndex = minuteValues.indexOf(minute) >= 0 ? minuteValues.indexOf(minute) : 0;

  const ampmValues = useMemo(() => ["AM", "PM"], []);
  const ampmIndex = isPM ? 1 : 0;

  const buildTime = (h24: number, m: number) =>
    `${h24.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  const getDateStr = () => dueDate.split("T")[0] || format(new Date(), "yyyy-MM-dd");

  const handleHourSelect = (i: number) => {
    const h12 = hourValues[i];
    const h24 = isPM ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12);
    onDueDateChange(`${getDateStr()}T${buildTime(h24, minute)}`);
  };
  const handleMinuteSelect = (i: number) =>
    onDueDateChange(`${getDateStr()}T${buildTime(hour, minuteValues[i])}`);
  const handleAmPmSelect = (i: number) => {
    const wantPM = i === 1;
    const h = wantPM ? (hour < 12 ? hour + 12 : hour) : (hour >= 12 ? hour - 12 : hour);
    onDueDateChange(`${getDateStr()}T${buildTime(h, minute)}`);
  };

  /* ---------- quick dates ---------- */

  const setQuickDate = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    onDueDateChange(`${format(d, "yyyy-MM-dd")}T${buildTime(hour, minute)}`);
  };

  /* ---------- repeat ---------- */

  const handleRepeatToggle = (on: boolean) => {
    setEnableRepeat(on);
    onRepeatRuleChange(on ? { type: "weekly", interval: 1 } : undefined);
  };
  const handleRepeatTypeChange = (t: "daily" | "weekly" | "monthly") =>
    onRepeatRuleChange({ ...repeatRule, type: t, interval: repeatRule?.interval || 1 });

  /* ---------- display ---------- */

  const displayMonth = months[selectedDate.getMonth()];
  const displayYear = selectedDate.getFullYear();

  // Capsule position (centred in 110px strip)
  const capsuleLeft = (STRIP_W - DATE_CAPSULE_W) / 2;

  // Capsule row offset for time wheels (capsule sits at row index 1 = pad from top)
  const timeCapsuleTop = TIME_CELL_H;

  return (
    <div className="space-y-3">
      {/* Quick Date Buttons */}
      <div className="flex flex-wrap gap-1 h-6">
        {quickDates.map(({ label, days }) => {
          const active = dueDate && (() => {
            const t = new Date(); t.setDate(t.getDate() + days);
            return dueDate.split("T")[0] === t.toISOString().split("T")[0];
          })();
          return (
            <button
              key={label}
              type="button"
              onClick={() => setQuickDate(days)}
              className={cn(
                "px-1.5 py-0.5 rounded-[4px] font-mono text-[9px] uppercase tracking-wide transition-all select-none cursor-pointer",
                active
                  ? "bg-card text-foreground shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                  : "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Two-column: Calendar (110px) + Time */}
      <div className="flex gap-3 items-start">
        {/* ── Left Column: Horizontal date scroller ── */}
        <div style={{ width: STRIP_W }} className="flex-shrink-0">
          {/* Month / Year header – centred */}
          <div className="flex items-center justify-center gap-1.5 mb-px" style={{ paddingTop: 1, paddingBottom: 7 }}>
            <span className="text-[14px] font-semibold text-foreground">{displayMonth.slice(0, 3)}</span>
            <span className="text-[9px] text-[rgba(133,186,188,1)] font-bold leading-[9px] text-center mb-[3px] tracking-[0.3px]">
              {String(displayYear).slice(0, 2)}<br/>{String(displayYear).slice(2)}
            </span>
          </div>

          {/* Scroller with centre capsule */}
          <div className="relative" style={{ width: STRIP_W, height: 46 }}>
            {/* Capsule background – sits behind content */}
            <div
              className="absolute rounded-[8px] pointer-events-none bg-[rgba(233,230,226,1)] shadow-[inset_2px_6.4px_4px_0px_rgba(0,0,0,0.18),inset_0px_-1px_1px_0px_rgba(255,255,255,1),inset_0px_4px_2px_-2px_rgba(0,0,0,0.2)]"
              style={{ left: capsuleLeft, width: DATE_CAPSULE_W, zIndex: 0, top: 4, height: 36 }}
            />

            {/* Horizontal scrolling date strip */}
            <div
              ref={dateScrollRef}
              onScroll={handleDateScroll}
              className="absolute inset-0 flex overflow-x-auto no-scrollbar"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
                zIndex: 1,
              }}
            >
              {/* Left padding so item 0 can sit in capsule centre */}
              <div className="flex-shrink-0" style={{ width: LEFT_PAD }} />

              {dateOptions.map((date, idx) => {
                const isToday = isSameDay(date, new Date());
                const dist = Math.abs(idx - visualCenterIdx);

                const dayName = format(date, "EEE").toUpperCase().slice(0, 2);
                const dayNum = date.getDate();

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleDateSelect(date)}
                    className={cn(
                      "flex-shrink-0 flex flex-col items-center justify-center select-none cursor-pointer text-foreground transition-[filter,opacity] duration-100",
                      isToday && dist !== 0 && "text-primary",
                    )}
                    style={{
                      width: DATE_CELL_W,
                      height: 45,
                      ...itemStyle(dist),
                    }}
                  >
                    <span className="text-[10px] font-mono font-medium leading-tight tracking-wide text-primary">{dayName}</span>
                    <span className="text-xs font-medium font-mono leading-tight mt-[-2px]">{dayNum}</span>
                  </button>
                );
              })}

              {/* Right padding */}
              <div className="flex-shrink-0" style={{ width: LEFT_PAD }} />
            </div>
          </div>
        </div>

        {/* ── Right Column: Vertical time wheels ── */}
        <div className="flex-shrink-0">
          {/* Time header – centred */}
          <div className="text-center mt-0 mb-[-7px] h-6 w-[75px]">
            <span className="text-[14px] font-semibold text-foreground">Time</span>
          </div>

          {/* All wheels + colon aligned at the capsule row */}
          <div className="flex items-start gap-0.5">
            <ScrollWheel values={hourValues} selectedIndex={hourIndex} onSelect={handleHourSelect} width={32} />

            {/* Colon: vertically centred on the capsule row */}
            <div
              className="flex items-center justify-center"
              style={{ height: TIME_CELL_H * TIME_VISIBLE, width: 6 }}
            >
              <span
                className="text-sm font-mono font-semibold text-muted-foreground"
                style={{
                  // Push colon down to align with capsule centre row
                  // Capsule is at pad (TIME_CELL_H) from top, centred at pad + CELL_H/2
                  // Container midpoint is totalH/2. Offset = capsuleCentre - containerMid
                  transform: `translateY(0px)`,
                }}
              >:</span>
            </div>

            <ScrollWheel values={minuteValues} selectedIndex={minuteIndex} onSelect={handleMinuteSelect} width={32} />

            <div style={{ width: 2 }} />

            <ScrollWheel values={ampmValues} selectedIndex={ampmIndex} onSelect={handleAmPmSelect} formatValue={(v) => String(v)} width={28} capsuleBg="bg-[rgba(142,201,206,1)]" capsuleStyle={{ marginLeft: 2, marginRight: 2, paddingLeft: 0 }} textStyle={{ fontSize: 10, color: "rgba(246,244,242,1)" }} />
          </div>
        </div>
      </div>

      {/* Repeat */}
      <div className="flex items-center gap-2 !mt-0">
        <span className="text-[10px] text-muted-foreground">Repeat</span>
        <Switch checked={enableRepeat} onCheckedChange={handleRepeatToggle} className="scale-75 origin-left" />
        {enableRepeat && (
          <Select
            value={repeatRule?.type || "weekly"}
            onValueChange={(v) => handleRepeatTypeChange(v as "daily" | "weekly" | "monthly")}
          >
            <SelectTrigger className="h-6 w-auto min-w-[60px] text-[9px] font-mono px-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
