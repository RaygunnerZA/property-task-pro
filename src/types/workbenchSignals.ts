/**
 * Workbench Issues signal taxonomy (UI + future persistence).
 * Fixtures use these for dev / visual tuning; production ingestion should map to the same shape.
 */

export type SignalKind =
  | "message"
  | "email"
  | "upload"
  | "ai_warning"
  | "ai_suggestion"
  | "admin"
  | "conflict"
  | "weather"
  | "document"
  | "system";

export type ReviewState =
  | "none"
  | "needs_classification"
  | "needs_assignment"
  | "needs_linking"
  | "needs_resolution"
  | "needs_permissions";

export type SignalDisposition =
  | "recent"
  | "needs_review"
  | "urgent"
  | "dismissed"
  | "converted_to_issue"
  | "converted_to_record";

/** Uppercase chip label shown on cards (distinct from SignalKind for display). */
export type SignalTypeChip =
  | "MESSAGE"
  | "EMAIL"
  | "UPLOAD"
  | "AI WARNING"
  | "AI SUGGESTION"
  | "SYSTEM ALERT"
  | "ADMIN"
  | "CONFLICT"
  | "WEATHER"
  | "DOCUMENT"
  | "SYSTEM";

export const SIGNAL_KIND_TO_CHIP: Record<SignalKind, SignalTypeChip> = {
  message: "MESSAGE",
  email: "EMAIL",
  upload: "UPLOAD",
  ai_warning: "AI WARNING",
  ai_suggestion: "AI SUGGESTION",
  admin: "ADMIN",
  conflict: "CONFLICT",
  weather: "WEATHER",
  document: "DOCUMENT",
  system: "SYSTEM",
};

/** Bottom-of-card label for feed layout (readable, spaced words — not duplicate of title). */
export const SIGNAL_KIND_FOOT_LABEL: Record<SignalKind, string> = {
  message: "TENANT MESSAGE",
  email: "FORWARDED EMAIL",
  upload: "UPLOADED PHOTO",
  ai_warning: "AI WARNING",
  ai_suggestion: "AI SUGGESTION",
  admin: "ADMIN REMINDER",
  conflict: "SCHEDULING",
  weather: "WEATHER ALERT",
  document: "DOCUMENT",
  system: "SYSTEM EVENT",
};

export function reviewStateDisplay(state: ReviewState): string | null {
  if (state === "none") return null;
  const map: Record<Exclude<ReviewState, "none">, string> = {
    needs_classification: "NEEDS CLASSIFICATION",
    needs_assignment: "NEEDS ASSIGNMENT",
    needs_linking: "NEEDS LINKING",
    needs_resolution: "NEEDS DECISION",
    needs_permissions: "NEEDS SETUP",
  };
  return map[state as Exclude<ReviewState, "none">];
}
