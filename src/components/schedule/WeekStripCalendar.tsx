import React from "react";

interface WeekStripCalendarProps {
  startOfWeek: Date;
  selectedDate: Date;
  daysWithItems?: string[]; // ISO strings e.g. "2025-01-10"
  onSelectDate: (date: Date) => void;
  onChangeWeek: (direction: "prev" | "next") => void;
}

/**
 * WeekStripCalendar
 * - Used in Schedule > Week view
 * - Shows 7 soft, tactile day chips
 * - Today outlined
 * - Selected day filled
 * - Dot indicator for days with tasks/signals
 */

export const WeekStripCalendar: React.FC<WeekStripCalendarProps> = ({
  startOfWeek,
  selectedDate,
  daysWithItems = [],
  onSelectDate,
  onChangeWeek,
}) => {
  const [slideDirection, setSlideDirection] = React.useState<"left" | "right" | null>(null);
  const [key, setKey] = React.useState(0);
  
  // Build the 7-day array
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const todayISO = new Date().toISOString().slice(0, 10);
  const selectedISO = selectedDate.toISOString().slice(0, 10);

  const handleChangeWeek = (direction: "prev" | "next") => {
    setSlideDirection(direction === "prev" ? "right" : "left");
    setKey(prev => prev + 1);
    setTimeout(() => {
      onChangeWeek(direction);
      setSlideDirection(null);
    }, 150);
  };

  const fmt = (date: Date) => date.toISOString().slice(0, 10);
  const dayNum = (date: Date) => date.getDate();
  const weekdayShort = (date: Date) =>
    date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);

  return (
    <div className="px-4 pt-3 pb-1 flex items-center gap-3">
      {/* Left arrow */}
      <button
        type="button"
        onClick={() => handleChangeWeek("prev")}
        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-card shadow-engraved text-sm shrink-0"
        aria-label="Previous week"
      >
        ←
      </button>

      {/* DAYS */}
      <div 
        key={key}
        className={`flex-1 flex justify-between gap-1 transition-all duration-200 ${
          slideDirection === "left" ? "animate-slide-out-left" : 
          slideDirection === "right" ? "animate-slide-out-right" : 
          "animate-fade-in"
        }`}
      >
        {days.map((date, idx) => {
          const iso = fmt(date);
          const isSelected = iso === selectedISO;
          const isToday = iso === todayISO;
          const hasItems = daysWithItems.includes(iso);

          return (
            <button
              key={idx}
              onClick={() => onSelectDate(date)}
              className={`relative flex flex-col items-center justify-center w-11 h-14 rounded-xl transition-all select-none ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-e1"
                  : "bg-card shadow-e2 text-foreground"
              } ${isToday && !isSelected ? "border-2 border-primary" : ""}`}
            >
              {/* Weekday */}
              <span className="text-[10px] font-medium opacity-80">
                {weekdayShort(date)}
              </span>

              {/* Date number */}
              <span className="text-sm font-bold">{dayNum(date)}</span>

              {/* DOT INDICATOR */}
              {hasItems && !isSelected && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>

      {/* Right arrow */}
      <button
        type="button"
        onClick={() => handleChangeWeek("next")}
        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-card shadow-engraved text-sm shrink-0"
        aria-label="Next week"
      >
        →
      </button>
    </div>
  );
};
