import {
  addMonths,
  addYears,
  startOfDay,
} from "date-fns";

export type ComplianceFrequency =
  | "monthly"
  | "quarterly"
  | "6_monthly"
  | "annual"
  | "2_yearly"
  | "5_yearly";

const FREQUENCY_LABELS: Record<ComplianceFrequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  "6_monthly": "Every 6 months",
  annual: "Annual",
  "2_yearly": "Every 2 years",
  "5_yearly": "Every 5 years",
};

/**
 * Calculate the next due date given a frequency string and a start date.
 * Used by the seed hook (initial due date) and mark-complete hook (next cycle).
 *
 * Always returns a date at midnight local time to avoid timezone drift in date comparisons.
 */
export function calculateNextDueDate(
  frequency: string,
  from: Date = new Date()
): Date {
  const base = startOfDay(from);

  switch (frequency as ComplianceFrequency) {
    case "monthly":
      return addMonths(base, 1);
    case "quarterly":
      return addMonths(base, 3);
    case "6_monthly":
      return addMonths(base, 6);
    case "annual":
      return addYears(base, 1);
    case "2_yearly":
      return addYears(base, 2);
    case "5_yearly":
      return addYears(base, 5);
    default:
      // Fallback: treat unknown frequencies as annual
      return addYears(base, 1);
  }
}

/** Format a frequency value for display in the UI. */
export function formatFrequency(frequency: string): string {
  return FREQUENCY_LABELS[frequency as ComplianceFrequency] ?? frequency;
}

/** All selectable frequency options in UI order. */
export const FREQUENCY_OPTIONS: { value: ComplianceFrequency; label: string }[] =
  Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({
    value: value as ComplianceFrequency,
    label,
  }));
