// TASK or REMINDER (signal)
export type ScheduleItemKind = "task" | "signal";

/**
 * Unified schedule item
 * Appears across:
 * - Month view
 * - Week view
 * - List view
 * - Day drawer
 * - Search
 * - Filters
 * - AI summaries
 */

export interface ScheduleItemBase {
  id: string;

  /** "task" or "signal" (shown as "Reminder" in UI for signals) */
  kind: ScheduleItemKind;

  /** Human-readable title */
  title: string;

  /** ISO date (YYYY-MM-DD) */
  date: string;

  /** HH:mm or null */
  time: string | null;

  /** Property link */
  propertyId: string | null;
  propertyName?: string | null; // derived for UI

  /** Space link */
  spaceId?: string | null;
  spaceName?: string | null; // derived for UI

  /** For tasks only — optional */
  priority?: "low" | "medium" | "high" | "urgent" | string | null;

  /** Task or reminder status */
  status?: string | null;

  /** Description/body text */
  description?: string | null;

  /** Assignment */
  assigneeId?: string | null;
  assigneeName?: string | null;

  /** Vendor link (future-proof) */
  vendorId?: string | null;
  vendorName?: string | null;

  /** AI extracted metadata (future) */
  aiExtract?: Record<string, any> | null;
}

/**
 * Filters that can be applied to the schedule.
 * All fields optional.
 */
export interface ScheduleFilters {
  type?: "all" | "tasks" | "signals";
  propertyId?: string | null;
  spaceId?: string | null;
  assigneeId?: string | null;
  vendorId?: string | null;
  priority?: "low" | "medium" | "high" | "urgent";
  status?: string | null;
}
