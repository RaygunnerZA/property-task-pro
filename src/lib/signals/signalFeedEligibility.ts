import type { SignalRow } from "@/lib/signals/signalTypes";

/** Subtypes that are operational/meta — never surface in Issues. */
const ISSUES_SUPPRESSED_SUBTYPES = new Set([
  "property.geocoded",
  "property.missing_location_data",
  "location.gps_verified",
]);

const ISSUES_MIN_SEVERITY = new Set(["warning", "urgent", "critical"]);

/**
 * Whether a platform signal should appear in the Issues workbench feed.
 * Keeps the product layer calm: actionable, user-meaningful signals only.
 */
export function isSignalEligibleForIssuesFeed(signal: SignalRow): boolean {
  if (ISSUES_SUPPRESSED_SUBTYPES.has(signal.subtype)) {
    return false;
  }

  if (signal.expires_at && new Date(signal.expires_at).getTime() < Date.now()) {
    return false;
  }

  const disposition = signal.disposition;
  if (disposition === "urgent" || disposition === "needs_review") {
    return true;
  }

  if (ISSUES_MIN_SEVERITY.has(signal.severity)) {
    return true;
  }

  const action = signal.recommendation?.action as string | undefined;
  if (action === "create_task" && signal.severity !== "info") {
    return true;
  }

  return false;
}
