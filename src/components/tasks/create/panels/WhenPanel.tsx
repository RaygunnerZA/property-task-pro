/**
 * WhenPanel — date + time for Create Task and Task edit.
 *
 * Layout: FillaMiniCalendar week strip, then pressed hour/minute/AM-PM tiles on the next row.
 */

import { useMemo } from "react";
import type { RepeatRule } from "@/types/database";
import { cn } from "@/lib/utils";
import { format, addDays, startOfDay } from "date-fns";
import {
  CustomRepeatBuilder,
  unitToRepeatType,
  type CustomRepeatUnit,
} from "@/components/tasks/create/CustomRepeatBuilder";
import { defaultWeekendPush, isWeekendDueDate } from "@/lib/repeatWeekendPush";
import { FillaMiniCalendar } from "@/components/calendar/FillaMiniCalendar";
import { DueTimePressedPicker } from "@/components/tasks/create/DueTimePressedPicker";

interface WhenPanelProps {
  dueDate: string;
  repeatRule?: RepeatRule;
  onDueDateChange: (date: string) => void;
  onRepeatRuleChange: (rule: RepeatRule | undefined) => void;
  /** Hide the quick-date chip row when the parent already renders it inline. */
  showQuickDates?: boolean;
  /** Show the Custom Repeat [# ▾] [WEEKS ▾] builder (Custom from repeat presets). */
  showCustomRepeatBuilder?: boolean;
  /** Called after custom repeat is confirmed so parent can leave builder mode. */
  onCustomRepeatCommitted?: () => void;
}

const quickDates = [
  { label: "TODAY", days: 0 },
  { label: "TOM", days: 1 },
  { label: "+7D", days: 7 },
  { label: "+14D", days: 14 },
];

function parseLocalDate(dueDate: string): Date {
  if (!dueDate) return new Date();
  const [y, m, d] = dueDate.split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function timePart(dueDate: string): string {
  if (dueDate.includes("T")) return dueDate.split("T")[1]?.slice(0, 5) || "09:00";
  return "09:00";
}

export function WhenPanel({
  dueDate,
  onDueDateChange,
  onRepeatRuleChange,
  showQuickDates = true,
  showCustomRepeatBuilder = false,
  onCustomRepeatCommitted,
}: WhenPanelProps) {
  const handleCustomRepeatConfirm = (interval: number, unit: CustomRepeatUnit) => {
    const type = unitToRepeatType(unit);
    onRepeatRuleChange({
      type,
      interval,
      ...(isWeekendDueDate(dueDate) ? { weekend_push: defaultWeekendPush(type) } : {}),
    });
    onCustomRepeatCommitted?.();
  };

  const selectedDate = useMemo(() => parseLocalDate(dueDate), [dueDate]);
  const dueTime = timePart(dueDate);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    onDueDateChange(`${format(date, "yyyy-MM-dd")}T${dueTime}`);
  };

  const setQuickDate = (days: number) => {
    const d = addDays(startOfDay(new Date()), days);
    onDueDateChange(`${format(d, "yyyy-MM-dd")}T${dueTime}`);
  };

  return (
    <div className="space-y-3">
      {showQuickDates && (
        <div className="flex h-6 min-w-0 flex-nowrap gap-1 overflow-x-auto no-scrollbar">
          {quickDates.map(({ label, days }) => {
            const active = dueDate && (() => {
              const t = addDays(startOfDay(new Date()), days);
              return dueDate.split("T")[0] === format(t, "yyyy-MM-dd");
            })();
            return (
              <button
                key={label}
                type="button"
                onClick={() => setQuickDate(days)}
                className={cn(
                  "cursor-pointer select-none rounded-[4px] px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider transition-all",
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
      )}

      {showCustomRepeatBuilder ? (
        <CustomRepeatBuilder
          resetKey={showCustomRepeatBuilder}
          onConfirm={handleCustomRepeatConfirm}
        />
      ) : null}

      <div className="flex flex-col items-start gap-1.5">
        <FillaMiniCalendar
          variant="sidebar"
          bare
          defaultExpanded={false}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          className="min-w-0 shrink-0"
        />
        <DueTimePressedPicker dueDate={dueDate} onDueDateChange={onDueDateChange} />
      </div>
    </div>
  );
}
