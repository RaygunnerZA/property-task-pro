import type { ReportDateRangePreset } from "./types";
import {
  differenceInCalendarDays,
  endOfDay,
  format,
  startOfDay,
  startOfYear,
  subDays,
} from "date-fns";

export type DateRange = {
  start: Date;
  end: Date;
  label: string;
  previous: { start: Date; end: Date };
};

export const DATE_RANGE_OPTIONS: {
  value: ReportDateRangePreset;
  label: string;
}[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
];

export function resolveDateRange(
  preset: ReportDateRangePreset,
  now = new Date()
): DateRange {
  const end = endOfDay(now);
  let start: Date;
  let label: string;

  switch (preset) {
    case "7d":
      start = startOfDay(subDays(now, 6));
      label = "Last 7 days";
      break;
    case "90d":
      start = startOfDay(subDays(now, 89));
      label = "Last 90 days";
      break;
    case "ytd":
      start = startOfYear(now);
      label = "Year to date";
      break;
    case "30d":
    default:
      start = startOfDay(subDays(now, 29));
      label = "Last 30 days";
      break;
  }

  const days = Math.max(1, differenceInCalendarDays(end, start) + 1);
  const previousEnd = endOfDay(subDays(start, 1));
  const previousStart = startOfDay(subDays(previousEnd, days - 1));

  return {
    start,
    end,
    label,
    previous: { start: previousStart, end: previousEnd },
  };
}

export function formatPeriodBucket(date: Date, preset: ReportDateRangePreset): {
  key: string;
  label: string;
} {
  if (preset === "7d") {
    return { key: format(date, "yyyy-MM-dd"), label: format(date, "EEE d") };
  }
  if (preset === "90d" || preset === "ytd") {
    return { key: format(date, "yyyy-MM"), label: format(date, "MMM") };
  }
  // 30d — weekly buckets approximate by week start
  return { key: format(date, "yyyy-'W'II"), label: format(date, "d MMM") };
}

export function inRange(iso: string | null | undefined, start: Date, end: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d >= start && d <= end;
}
