/**
 * Neumorphic vertical time scroller (hour / minute / AM-PM) extracted from WhenPanel.
 * Pair with FillaMiniCalendar for Create Task custom due.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { format, parseISO, setHours, setMinutes } from "date-fns";

const TIME_CELL_H = 26;
const TIME_VISIBLE = 3;

function itemStyle(distance: number): React.CSSProperties {
  if (distance === 0) return { opacity: 1, filter: "none" };
  if (distance === 1) return { opacity: 0.4, filter: "blur(1.5px)" };
  if (distance === 2) return { opacity: 0.15, filter: "blur(3px)" };
  return { opacity: 0, filter: "blur(4px)", pointerEvents: "none" };
}

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
  const [visualIdx, setVisualIdx] = useState(selectedIndex);

  useEffect(() => {
    if (!scrollRef.current) return;
    isUserScroll.current = false;
    scrollRef.current.scrollTo({ top: selectedIndex * TIME_CELL_H, behavior: "auto" });
    const id = setTimeout(() => {
      isUserScroll.current = true;
    }, 100);
    return () => clearTimeout(id);
  }, [selectedIndex]);

  useEffect(() => {
    setVisualIdx(selectedIndex);
  }, [selectedIndex]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !isUserScroll.current) return;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      if (!scrollRef.current) return;
      const idx = Math.round(scrollRef.current.scrollTop / TIME_CELL_H);
      if (idx >= 0 && idx < values.length && idx !== selectedIndex) {
        onSelect(idx);
      }
      scrollRef.current.scrollTo({ top: idx * TIME_CELL_H, behavior: "smooth" });
    }, 120);
  }, [values.length, selectedIndex, onSelect]);

  const handleScrollVisual = useCallback(() => {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollTop / TIME_CELL_H);
    setVisualIdx(idx);
    handleScroll();
  }, [handleScroll]);

  const totalH = TIME_CELL_H * TIME_VISIBLE;
  const pad = TIME_CELL_H;

  return (
    <div className="relative" style={{ width }}>
      <div
        className={cn(
          "absolute left-0 right-0 rounded-card pointer-events-none shadow-[inset_2px_6.4px_4px_0px_rgba(0,0,0,0.15),inset_0px_-1px_1px_0px_rgba(255,255,255,1),inset_0px_3px_2px_-1px_rgba(0,0,0,0.2)]",
          capsuleBg || "bg-[rgba(233,230,226,1)]"
        )}
        style={{ top: 21, height: 36, zIndex: 0, ...capsuleStyle }}
      />
      <div
        ref={scrollRef}
        onScroll={handleScrollVisual}
        className="relative overflow-y-auto no-scrollbar"
        style={{ height: totalH, scrollbarWidth: "none", msOverflowStyle: "none", zIndex: 1 }}
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
              style={{ height: TIME_CELL_H, ...itemStyle(dist), ...textStyle }}
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

export type DueTimeScrollerProps = {
  /** ISO date or yyyy-MM-dd (time portion optional). */
  dueDate: string;
  onDueDateChange: (isoLocal: string) => void;
  className?: string;
};

/** Returns `yyyy-MM-dd'T'HH:mm:00` local-ish string for task due_at building. */
export function DueTimeScroller({ dueDate, onDueDateChange, className }: DueTimeScrollerProps) {
  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i)), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  const ampm = ["AM", "PM"] as const;

  const parsed = useMemo(() => {
    if (!dueDate) return new Date();
    try {
      if (dueDate.includes("T")) return parseISO(dueDate);
      return parseISO(`${dueDate}T09:00:00`);
    } catch {
      return new Date();
    }
  }, [dueDate]);

  const hour24 = parsed.getHours();
  const minute = parsed.getMinutes();
  const isPm = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const commit = (next: Date) => {
    const datePart = format(next, "yyyy-MM-dd");
    const timePart = format(next, "HH:mm");
    onDueDateChange(`${datePart}T${timePart}:00`);
  };

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="text-center mt-0 mb-[-7px] h-6 w-[75px] text-[14px] font-semibold text-foreground">
        Time
      </div>
      <div className="flex items-start gap-0.5 pt-1">
        <ScrollWheel
          values={hours}
          selectedIndex={hours.indexOf(hour12)}
          onSelect={(idx) => {
            const h12 = hours[idx];
            let h24 = h12 % 12;
            if (isPm) h24 += 12;
            commit(setMinutes(setHours(parsed, h24), minute));
          }}
          formatValue={(v) => String(v)}
        />
        <span className="text-sm font-mono font-semibold text-muted-foreground w-1.5 pt-7">:</span>
        <ScrollWheel
          values={minutes}
          selectedIndex={minute}
          onSelect={(idx) => commit(setMinutes(setHours(parsed, hour24), idx))}
        />
        <ScrollWheel
          values={[...ampm]}
          selectedIndex={isPm ? 1 : 0}
          onSelect={(idx) => {
            const wantPm = idx === 1;
            let h24 = hour12 % 12;
            if (wantPm) h24 += 12;
            commit(setMinutes(setHours(parsed, h24), minute));
          }}
          formatValue={(v) => String(v)}
          width={28}
          capsuleBg="bg-[rgba(142,201,206,1)]"
          capsuleStyle={{ marginLeft: 2, marginRight: 2 }}
          textStyle={{ fontSize: 10, color: "rgba(246,244,242,1)" }}
        />
      </div>
    </div>
  );
}
