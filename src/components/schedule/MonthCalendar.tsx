import React from "react";

interface MonthCalendarProps {
  currentDate: Date;          // Controls the visible month
  selectedDate: Date;         // The currently-selected day
  daysWithItems?: string[];   // ISO dates e.g. ["2025-11-10"]
  onSelectDate: (date: Date) => void;
  onChangeMonth: (direction: "prev" | "next") => void;
}

/**
 * MonthCalendar
 * - Soft, tactile month grid
 * - Shows weekday headers
 * - Dots for task/reminder days
 * - Today outlined
 * - Selected date filled
 */

export const MonthCalendar: React.FC<MonthCalendarProps> = ({
  currentDate,
  selectedDate,
  daysWithItems = [],
  onSelectDate,
  onChangeMonth,
}) => {
  const todayISO = new Date().toISOString().slice(0, 10);
  const selectedISO = selectedDate.toISOString().slice(0, 10);

  const fmtISO = (d: Date) => d.toISOString().slice(0, 10);
  const monthLabel = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  /* --------------------------------------------
     BUILD MONTH GRID
  --------------------------------------------- */

  const firstOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const startDay = firstOfMonth.getDay(); // 0 = Sunday (we'll adjust to Monday-based)

  // Make Monday the first column
  const offset = startDay === 0 ? 6 : startDay - 1;

  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();

  // Total cells (5 or 6 weeks)
  const totalCells = offset + daysInMonth <= 35 ? 35 : 42;

  const cells: (Date | null)[] = Array.from({ length: totalCells }, (_, i) => {
    if (i < offset || i >= offset + daysInMonth) return null;
    const day = i - offset + 1;
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
  });

  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="px-4 pt-2 pb-3">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => onChangeMonth("prev")}
          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-card shadow-engraved text-sm"
          aria-label="Previous month"
        >
          ←
        </button>

        <div className="text-sm font-semibold">{monthLabel}</div>

        <button
          type="button"
          onClick={() => onChangeMonth("next")}
          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-card shadow-engraved text-sm"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      {/* WEEKDAY LABELS */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      {/* CALENDAR GRID */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, idx) => {
          if (!date) {
            return <div key={idx} className="aspect-square" />;
          }

          const iso = fmtISO(date);
          const isSelected = iso === selectedISO;
          const isToday = iso === todayISO;
          const hasItems = daysWithItems.includes(iso);

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectDate(date)}
              className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-medium transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-e1"
                  : isToday
                  ? "border-2 border-primary bg-card"
                  : "bg-card hover:bg-muted"
              }`}
            >
              {date.getDate()}

              {/* DOT INDICATOR */}
              {hasItems && !isSelected && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
