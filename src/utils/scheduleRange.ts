export type ScheduleViewMode = "list" | "week" | "month";

/**
 * Returns a date range (start/end) in ISO format.
 * - Month  → full calendar month
 * - Week   → Monday–Sunday
 * - List   → today → +30 days (forward-looking)
 */

export function getScheduleRange(
  viewMode: ScheduleViewMode,
  currentDate: Date
): { start: string; end: string } {
  const start = new Date(currentDate);
  const end = new Date(currentDate);

  /* --------------------------------------------
     MONTH VIEW
  --------------------------------------------- */
  if (viewMode === "month") {
    // Begin at first day of month (00:00)
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    // End at last day of month (23:59)
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    return {
      start: monthStart.toISOString(),
      end: monthEnd.toISOString(),
    };
  }

  /* --------------------------------------------
     WEEK VIEW — always Monday → Sunday
  --------------------------------------------- */
  if (viewMode === "week") {
    const copied = new Date(currentDate);
    const day = copied.getDay(); // 0 = Sun, 1 = Mon…

    // Convert to Monday index
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const weekStart = new Date(copied);
    weekStart.setDate(copied.getDate() + diffToMonday);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return {
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
    };
  }

  /* --------------------------------------------
     LIST VIEW — next 30 days
     (Not just today; gives meaningful upcoming timeline)
  --------------------------------------------- */
  if (viewMode === "list") {
    const listStart = new Date(currentDate);
    listStart.setHours(0, 0, 0, 0);

    const listEnd = new Date(listStart);
    listEnd.setDate(listStart.getDate() + 30);
    listEnd.setHours(23, 59, 59, 999);

    return {
      start: listStart.toISOString(),
      end: listEnd.toISOString(),
    };
  }

  // Fallback (should never be hit)
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}
