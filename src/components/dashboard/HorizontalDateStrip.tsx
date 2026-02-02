/**
 * HorizontalDateStrip - Minimised date picker with capsule window
 *
 * Days+dates scroll horizontally behind a fixed capsule; magnetic snap to centre.
 * Same capsule shape/size (100px) as When panel date strip.
 */

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { format, isToday, isTomorrow, addDays, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

const CAPSULE_WIDTH = 100;
const ITEM_WIDTH = 100;

export interface HorizontalDateStripProps {
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
  if (isTomorrow(d)) return "TOMORROW";
  return format(d, "EEE d");
}

export function HorizontalDateStrip({
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

  const dateOptions = useMemo(() => {
    const today = startOfDay(new Date());
    const total = daysBack + 1 + daysAhead;
    return Array.from({ length: total }, (_, i) => addDays(today, i - daysBack));
  }, [daysBack, daysAhead]);

  const selectedIndex = useMemo(() => {
    if (!selectedDate) return daysBack;
    const key = format(startOfDay(selectedDate), "yyyy-MM-dd");
    const idx = dateOptions.findIndex((d) => format(d, "yyyy-MM-dd") === key);
    return idx >= 0 ? idx : daysBack;
  }, [selectedDate, dateOptions, daysBack]);

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
    snapTimeoutRef.current = setTimeout(snapToClosestDate, 120);
  }, [snapToClosestDate]);

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
    const el = dateStripRef.current;
    const item = dateItemRefs.current[selectedIndex];
    if (el && item) {
      item.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
    }
  }, [selectedIndex]);

  const paddingX = dateStripWidth > 0 ? Math.max(0, (dateStripWidth - CAPSULE_WIDTH) / 2) : 60;

  return (
    <div className={cn("relative w-full", className)} style={{ minHeight: 44 }}>
      <div
        ref={dateStripRef}
        onScroll={handleDateStripScroll}
        className="overflow-x-auto no-scrollbar w-full flex items-center"
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
              className={cn(
                "shrink-0 h-10 rounded-full font-mono text-xs uppercase tracking-wide transition-all select-none cursor-pointer flex items-center justify-center",
                isActive
                  ? "bg-card text-foreground shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                  : "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
              )}
            >
              {label}
            </button>
          );
        })}
        <div className="shrink-0" style={{ width: paddingX, height: 1 }} aria-hidden />
      </div>
      {/* Capsule window (centre) - dates scroll behind */}
      <div
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 pointer-events-none z-10 rounded-full"
        style={{
          width: CAPSULE_WIDTH,
          boxShadow: "inset 0px 12.5px 14.5px -7.8px rgba(0, 0, 0, 0.33), 0px -1px 1px 0px rgba(0, 0, 0, 0.25), 0px 1px 1px 0px rgba(255, 255, 255, 1)",
        }}
      />
    </div>
  );
}
