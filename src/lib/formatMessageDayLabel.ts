import {
  differenceInCalendarDays,
  format,
  isToday,
  isValid,
  isYesterday,
  parseISO,
  startOfDay,
} from "date-fns";

/**
 * Message card / thread day label:
 * - Today → omit or "TODAY" (caller chooses)
 * - Yesterday → "YESTERDAY"
 * - Within last 7 days → weekday (e.g. "MONDAY")
 * - Older → short date (e.g. "12 AUG")
 */
export function formatMessageDayLabel(
  iso: string | null | undefined,
  opts?: { includeToday?: boolean }
): string | null {
  if (!iso) return null;
  const d = typeof iso === "string" ? parseISO(iso) : new Date(iso);
  if (!isValid(d)) return null;

  if (isToday(d)) {
    return opts?.includeToday ? "TODAY" : null;
  }
  if (isYesterday(d)) return "YESTERDAY";

  const days = differenceInCalendarDays(startOfDay(new Date()), startOfDay(d));
  if (days > 0 && days < 7) {
    return format(d, "EEEE").toUpperCase();
  }
  return format(d, "d MMM").toUpperCase();
}
