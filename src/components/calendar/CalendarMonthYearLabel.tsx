import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared month title — matches the mini-calendar caption. */
export const CALENDAR_MONTH_TITLE_CLASS = "font-semibold text-ink pl-[7px] text-xl";

export const CALENDAR_MONTH_TITLE_EMBEDDED_CLASS = "font-semibold text-ink pl-[7px] text-base";

export const CALENDAR_NAV_CHEVRON_GROUP_CLASS =
  "flex h-[26px] items-center gap-[17px] pt-[3px]";

export const CALENDAR_NAV_CHEVRON_BUTTON_CLASS =
  "inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,transform] duration-150 ease-out hover:bg-muted/50 active:scale-90";

export function CalendarNavChevronIcon({
  direction,
}: {
  direction: "prev" | "next";
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return <Icon className="h-6 w-6 text-accent" strokeWidth={2.2} />;
}

export function CalendarNavChevrons({
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  className,
}: {
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
  className?: string;
}) {
  return (
    <div className={cn(CALENDAR_NAV_CHEVRON_GROUP_CLASS, className)}>
      <button
        type="button"
        onClick={onPrev}
        className={CALENDAR_NAV_CHEVRON_BUTTON_CLASS}
        aria-label={prevLabel}
      >
        <CalendarNavChevronIcon direction="prev" />
      </button>
      <button
        type="button"
        onClick={onNext}
        className={CALENDAR_NAV_CHEVRON_BUTTON_CLASS}
        aria-label={nextLabel}
      >
        <CalendarNavChevronIcon direction="next" />
      </button>
    </div>
  );
}

type CalendarMonthYearLabelProps = {
  date: Date;
  className?: string;
  monthClassName?: string;
  yearClassName?: string;
  /** When set, the month/title opens Calendar (planner). */
  onClick?: () => void;
};

/** Month name beside year split across two lines (e.g. 20 / 26). */
export function CalendarMonthYearLabel({
  date,
  className,
  monthClassName = CALENDAR_MONTH_TITLE_CLASS,
  yearClassName = "text-2xs font-semibold leading-none text-accent",
  onClick,
}: CalendarMonthYearLabelProps) {
  const year = format(date, "yyyy");
  const label = format(date, "MMMM yyyy");
  const inner = (
    <>
      <span className={monthClassName}>{format(date, "MMMM")}</span>
      <div className={cn("flex flex-col items-center", yearClassName)}>
        <span>{year.slice(0, 2)}</span>
        <span>{year.slice(2)}</span>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md text-left transition-opacity duration-150 hover:opacity-80",
          className
        )}
        aria-label={`Open Calendar, ${label}`}
        title="Open Calendar"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)} aria-label={label}>
      {inner}
    </div>
  );
}
