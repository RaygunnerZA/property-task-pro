/**
 * Format task date/time according to the rules:
 * - Today: [TODAY • 12:30]
 * - Tomorrow: [TOMORROW • 12:30]
 * - This month: [THURS 10 • 12:30]
 * - Next month: [10 JAN • 12:30]
 *
 * Compact (phone cards): shorter words and a 12-hour clock so the line stays one row.
 * - Tomorrow 01:00 → TMRW • 1 AM
 * - Tomorrow 17:20 → TMRW • 5:20 PM
 */

export type FormatTaskDateOptions = {
  compact?: boolean;
  now?: Date;
};

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THURS", "FRI", "SAT"] as const;
const DAY_NAMES_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

function formatClock24(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

/** 1 AM, 5:20 PM — minutes omitted on the hour. */
function formatClock12(date: Date): string {
  const minutes = date.getMinutes();
  const suffix = date.getHours() >= 12 ? "PM" : "AM";
  let hours = date.getHours() % 12;
  if (hours === 0) hours = 12;
  const minutePart = minutes === 0 ? "" : `:${minutes.toString().padStart(2, "0")}`;
  return `${hours}${minutePart} ${suffix}`;
}

export function formatTaskDate(
  dateString: string | null | undefined,
  options?: FormatTaskDateOptions
): string {
  if (!dateString) return "No due date";

  const date = new Date(dateString);
  const now = options?.now ?? new Date();
  const compact = options?.compact === true;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const hasTime = dateString.includes("T") && !dateString.endsWith("T00:00:00");
  const timeStr = hasTime ? ` • ${compact ? formatClock12(date) : formatClock24(date)}` : "";

  if (taskDate.getTime() === today.getTime()) {
    return hasTime ? `TODAY${timeStr}` : "TODAY";
  }

  if (taskDate.getTime() === tomorrow.getTime()) {
    const label = compact ? "TMRW" : "TOMORROW";
    return hasTime ? `${label}${timeStr}` : label;
  }

  if (taskDate.getMonth() === today.getMonth() && taskDate.getFullYear() === today.getFullYear()) {
    const dayName = (compact ? DAY_NAMES_SHORT : DAY_NAMES)[date.getDay()];
    return `${dayName} ${date.getDate()}${timeStr}`;
  }

  const monthName = MONTH_NAMES[date.getMonth()];
  return `${date.getDate()} ${monthName}${timeStr}`;
}
