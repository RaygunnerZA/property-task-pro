import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  monthClassName = "text-lg font-semibold text-ink",
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
