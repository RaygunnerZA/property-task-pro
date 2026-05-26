import { format } from "date-fns";
import { cn } from "@/lib/utils";

type CalendarMonthYearLabelProps = {
  date: Date;
  className?: string;
  monthClassName?: string;
  yearClassName?: string;
};

/** Month name beside year split across two lines (e.g. 20 / 26). */
export function CalendarMonthYearLabel({
  date,
  className,
  monthClassName = "text-lg font-semibold text-ink",
  yearClassName = "text-[10px] font-semibold leading-none text-accent",
}: CalendarMonthYearLabelProps) {
  const year = format(date, "yyyy");

  return (
    <div
      className={cn("inline-flex items-center gap-1.5", className)}
      aria-label={format(date, "MMMM yyyy")}
    >
      <span className={monthClassName}>{format(date, "MMMM")}</span>
      <div className={cn("flex flex-col items-center", yearClassName)}>
        <span>{year.slice(0, 2)}</span>
        <span>{year.slice(2)}</span>
      </div>
    </div>
  );
}
