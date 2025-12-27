/**
 * MiniCalendar - Filla Design System v3.3 "Dimensional Paper Edition"
 * Reusable calendar component with neomorphic paper aesthetic
 * Features: month navigation, event markers, compliance flags
 */

import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MiniCalendarDayTile, type DayData, type TaskEvent, type ComplianceEvent } from "./MiniCalendarDayTile";

// ===== TYPES =====
export interface CalendarEvent {
  date: string; // ISO format: "2025-12-15"
  tasks?: TaskEvent[];
  compliance?: ComplianceEvent[];
}

interface MiniCalendarProps {
  selectedDate?: Date;
  events?: CalendarEvent[];
  onSelect?: (date: Date) => void;
  showMonthNav?: boolean;
  className?: string;
}

// ===== HELPERS =====
const formatDateISO = (d: Date) => d.toISOString().slice(0, 10);

const getMonthDays = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  // Get day of week (0 = Sunday, we want Sunday as first column)
  const startDayOfWeek = firstDay.getDay();
  
  // Previous month days to show
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const prevMonthDays = startDayOfWeek;
  
  // Calculate total cells (always 6 rows for consistency)
  const totalCells = 42;
  
  const days: { date: Date; isCurrentMonth: boolean }[] = [];
  
  // Previous month padding
  for (let i = prevMonthDays - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevMonthLastDay - i),
      isCurrentMonth: false,
    });
  }
  
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }
  
  // Next month padding
  const remaining = totalCells - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }
  
  return days;
};

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// ===== NAVIGATION BUTTON =====
const NavButton: React.FC<{
  direction: "prev" | "next";
  onClick: () => void;
}> = ({ direction, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "w-10 h-10 rounded-[12px] flex items-center justify-center",
      "bg-gradient-to-br from-[#F4F3F0] via-[#F2F1ED] to-[#EFEDE9]",
      "shadow-e2 hover:shadow-e1 active:shadow-engraved",
      "transition-all duration-150",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    )}
    aria-label={direction === "prev" ? "Previous month" : "Next month"}
  >
    {direction === "prev" ? (
      <ChevronLeft className="w-5 h-5 text-accent" strokeWidth={2.5} />
    ) : (
      <ChevronRight className="w-5 h-5 text-accent" strokeWidth={2.5} />
    )}
  </button>
);

// ===== MAIN COMPONENT =====
export const MiniCalendar: React.FC<MiniCalendarProps> = ({
  selectedDate = new Date(),
  events = [],
  onSelect,
  showMonthNav = true,
  className,
}) => {
  const [viewDate, setViewDate] = useState(() => new Date(selectedDate));
  const [animationClass, setAnimationClass] = useState("");

  const todayISO = formatDateISO(new Date());
  const selectedISO = formatDateISO(selectedDate);

  // Build events lookup map
  const eventsMap = useMemo(() => {
    const map = new Map<string, CalendarEvent>();
    for (const event of events) {
      map.set(event.date, event);
    }
    return map;
  }, [events]);

  // Get month days
  const monthDays = useMemo(
    () => getMonthDays(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  );

  // Month label
  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long" });

  // Navigation handlers
  const handleChangeMonth = (direction: "prev" | "next") => {
    setAnimationClass(direction === "prev" ? "animate-slide-out-right" : "animate-slide-out-left");
    
    setTimeout(() => {
      setViewDate((prev) => {
        const newDate = new Date(prev);
        newDate.setMonth(prev.getMonth() + (direction === "prev" ? -1 : 1));
        return newDate;
      });
      setAnimationClass("animate-fade-in");
    }, 120);
  };

  const handleSelectDate = (date: Date) => {
    onSelect?.(date);
  };

  return (
    <div
      className={cn(
        // Container with paper texture and neomorphic elevation
        "p-4 rounded-[14px]",
        "bg-gradient-to-br from-[#F2F2EE] via-[#F0EFE9] to-[#EEEDE7]",
        "shadow-e2",
        // Subtle paper texture overlay (CSS pattern)
        "relative overflow-hidden",
        className
      )}
      style={{
        backgroundImage: `
          linear-gradient(135deg, rgba(244,243,240,0.9) 0%, rgba(238,237,231,0.9) 100%),
          url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")
        `,
        backgroundBlendMode: "overlay",
      }}
    >
      {/* Header: Month + Navigation */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-accent tracking-tight">
          {monthLabel}
        </h2>

        {showMonthNav && (
          <div className="flex items-center gap-2">
            <NavButton direction="prev" onClick={() => handleChangeMonth("prev")} />
            <NavButton direction="next" onClick={() => handleChangeMonth("next")} />
          </div>
        )}
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAY_LABELS.map((label, idx) => (
          <div
            key={`${label}-${idx}`}
            className="text-center text-[11px] font-mono font-medium text-accent/70 uppercase tracking-wider"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className={cn("grid grid-cols-7 gap-1.5 transition-all duration-150", animationClass)}>
        {monthDays.map(({ date, isCurrentMonth }, idx) => {
          const iso = formatDateISO(date);
          const eventData = eventsMap.get(iso);

          return (
            <MiniCalendarDayTile
              key={`${iso}-${idx}`}
              day={date.getDate()}
              date={date}
              isSelected={iso === selectedISO}
              isToday={iso === todayISO}
              isOutOfMonth={!isCurrentMonth}
              tasks={eventData?.tasks || []}
              compliance={eventData?.compliance || []}
              onClick={() => isCurrentMonth && handleSelectDate(date)}
            />
          );
        })}
      </div>
    </div>
  );
};

// Re-export types
export type { DayData, TaskEvent, ComplianceEvent };
