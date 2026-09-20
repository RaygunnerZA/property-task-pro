/**
 * Compact hour / minute / AM-PM picker for Create Task and Task edit.
 * Selected values sit in 30×30 mini-calendar tiles with a pressed neomorphic shadow.
 */

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CALENDAR_MONTH_TITLE_CLASS } from "@/components/calendar/CalendarMonthYearLabel";

const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const MINUTES = [0, 15, 30, 45] as const;

const TILE =
  "relative box-border flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-card font-mono text-sm font-medium text-foreground transition-[background-color,transform] duration-150 ease-out hover:bg-white/60 active:scale-90";

const TILE_PRESSED =
  "bg-white shadow-btn-pressed hover:bg-white";

export type DueTimePressedPickerProps = {
  dueDate: string;
  onDueDateChange: (isoLocal: string) => void;
  className?: string;
};

function parseDueParts(dueDate: string): { dateStr: string; hour24: number; minute: number } {
  const dateStr = dueDate.split("T")[0] || format(new Date(), "yyyy-MM-dd");
  const timePart = dueDate.includes("T") ? dueDate.split("T")[1]?.slice(0, 5) : "09:00";
  const [hRaw, mRaw] = (timePart || "09:00").split(":").map(Number);
  return {
    dateStr,
    hour24: Number.isFinite(hRaw) ? hRaw : 9,
    minute: Number.isFinite(mRaw) ? mRaw : 0,
  };
}

function toHour12(hour24: number): number {
  if (hour24 === 0) return 12;
  if (hour24 > 12) return hour24 - 12;
  return hour24;
}

function toHour24(hour12: number, isPm: boolean): number {
  if (isPm) return hour12 === 12 ? 12 : hour12 + 12;
  return hour12 === 12 ? 0 : hour12;
}

function commit(dateStr: string, hour24: number, minute: number, onDueDateChange: (next: string) => void) {
  const t = `${hour24.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  onDueDateChange(`${dateStr}T${t}`);
}

function ChoiceTile({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(TILE, selected ? TILE_PRESSED : "bg-background shadow-e1")}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

export function DueTimePressedPicker({
  dueDate,
  onDueDateChange,
  className,
}: DueTimePressedPickerProps) {
  const { dateStr, hour24, minute } = useMemo(() => parseDueParts(dueDate), [dueDate]);
  const isPm = hour24 >= 12;
  const hour12 = toHour12(hour24);
  const [hourOpen, setHourOpen] = useState(false);
  const [minuteOpen, setMinuteOpen] = useState(false);

  const minuteLabel = minute.toString().padStart(2, "0");

  return (
    <div className={cn("flex shrink-0 flex-col items-start pb-1", className)}>
      <div className="mb-1 flex h-5 items-center">
        <span className={cn(CALENDAR_MONTH_TITLE_CLASS, "pl-0")}>Time</span>
      </div>

      <div className="flex items-center gap-1">
        <Popover open={hourOpen} onOpenChange={setHourOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(TILE, TILE_PRESSED)}
              aria-label={`Hour ${hour12}`}
            >
              {String(hour12).padStart(2, "0")}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            sideOffset={8}
            className="z-[120] w-auto rounded-xl border-0 bg-card p-2 shadow-e1"
          >
            <div className="grid grid-cols-4 gap-1.5">
              {HOURS_12.map((h) => (
                <ChoiceTile
                  key={h}
                  label={String(h)}
                  selected={h === hour12}
                  onSelect={() => {
                    commit(dateStr, toHour24(h, isPm), minute, onDueDateChange);
                    setHourOpen(false);
                  }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <span className="w-1.5 text-center font-mono text-sm font-semibold text-muted-foreground" aria-hidden>
          :
        </span>

        <Popover open={minuteOpen} onOpenChange={setMinuteOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(TILE, TILE_PRESSED)}
              aria-label={`Minute ${minuteLabel}`}
            >
              {minuteLabel}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            sideOffset={8}
            className="z-[120] w-auto rounded-xl border-0 bg-card p-2 shadow-e1"
          >
            <div className="grid grid-cols-2 gap-1.5">
              {MINUTES.map((m) => (
                <ChoiceTile
                  key={m}
                  label={m.toString().padStart(2, "0")}
                  selected={m === minute}
                  onSelect={() => {
                    commit(dateStr, hour24, m, onDueDateChange);
                    setMinuteOpen(false);
                  }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <button
          type="button"
          onClick={() => commit(dateStr, toHour24(hour12, !isPm), minute, onDueDateChange)}
          className={cn(
            TILE,
            "bg-primary text-[10px] font-semibold text-primary-foreground shadow-btn-pressed hover:bg-primary",
          )}
          aria-label={isPm ? "PM, switch to AM" : "AM, switch to PM"}
        >
          {isPm ? "PM" : "AM"}
        </button>
      </div>
    </div>
  );
}
