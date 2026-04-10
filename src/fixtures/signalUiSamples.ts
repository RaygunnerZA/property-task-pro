/**
 * One sample per signal kind for UI / icon / copy tuning.
 * Enabled via useSignalUiFixtures (dev default on, or ?signalFixtures=1, or localStorage).
 */
import type { SignalKind, ReviewState } from "@/types/workbenchSignals";
import { SIGNAL_KIND_TO_CHIP, reviewStateDisplay } from "@/types/workbenchSignals";

export type SignalUiFixture = {
  id: string;
  kind: SignalKind;
  disposition: "recent" | "needs_review" | "urgent";
  reviewState: ReviewState;
  typeChip: string;
  title: string;
  contextLine: string;
  whyHere?: string;
  explanation: string;
  primaryAction: { id: string; label: string };
  secondaryActions?: { id: string; label: string }[];
};

function chip(kind: SignalKind): string {
  return SIGNAL_KIND_TO_CHIP[kind];
}

/** Recent column: raw event stream (one per kind where it makes sense as “recent”). */
export const SIGNAL_UI_FIXTURES_RECENT: SignalUiFixture[] = [
  {
    id: "fixture:recent:message",
    kind: "message",
    disposition: "recent",
    reviewState: "none",
    typeChip: chip("message"),
    title: "Heating not working in flat 2B",
    contextLine: "tenant@example.com • Today, 08:14",
    explanation: "Tenant message via portal — may need maintenance triage.",
    primaryAction: { id: "signal-open", label: "View" },
    secondaryActions: [{ id: "dismiss", label: "Dismiss" }],
  },
  {
    id: "fixture:recent:email",
    kind: "email",
    disposition: "recent",
    reviewState: "none",
    typeChip: chip("email"),
    title: "Boiler complaint forwarded",
    contextLine: "from facilities@client.com • 22 Feb, 06:00",
    explanation: "Potential maintenance issue detected from email thread.",
    primaryAction: { id: "signal-open", label: "View" },
    secondaryActions: [{ id: "dismiss", label: "Dismiss" }],
  },
  {
    id: "fixture:recent:upload",
    kind: "upload",
    disposition: "recent",
    reviewState: "none",
    typeChip: chip("upload"),
    title: "Photo uploaded to Kitchen",
    contextLine: "justin • Yesterday, 16:22",
    explanation: "New site photo — not yet classified as issue or record.",
    primaryAction: { id: "signal-open", label: "View" },
    secondaryActions: [{ id: "dismiss", label: "Dismiss" }],
  },
  {
    id: "fixture:recent:ai_warning",
    kind: "ai_warning",
    disposition: "recent",
    reviewState: "none",
    typeChip: chip("ai_warning"),
    title: "Possible mould in bathroom corner",
    contextLine: "AI • 2 min ago",
    explanation: "Low-confidence visual hint — confirm before acting.",
    primaryAction: { id: "signal-open", label: "Review" },
    secondaryActions: [{ id: "dismiss", label: "Dismiss" }],
  },
  {
    id: "fixture:recent:ai_suggestion",
    kind: "ai_suggestion",
    disposition: "recent",
    reviewState: "none",
    typeChip: chip("ai_suggestion"),
    title: "Document looks like a Gas Safety certificate",
    contextLine: "AI • 09:41",
    explanation: "Certificate-like layout detected — may match compliance templates.",
    primaryAction: { id: "signal-open", label: "View" },
    secondaryActions: [{ id: "dismiss", label: "Dismiss" }],
  },
  {
    id: "fixture:recent:conflict",
    kind: "conflict",
    disposition: "recent",
    reviewState: "none",
    typeChip: chip("conflict"),
    title: "Scheduling overlap flagged",
    contextLine: "system • Today, 07:55",
    explanation: "Two contractor windows may intersect — not yet confirmed as a conflict.",
    primaryAction: { id: "signal-open", label: "Review" },
    secondaryActions: [{ id: "dismiss", label: "Dismiss" }],
  },
  {
    id: "fixture:recent:admin",
    kind: "admin",
    disposition: "recent",
    reviewState: "none",
    typeChip: chip("admin"),
    title: "Reminder: complete staff permissions",
    contextLine: "system • Daily digest",
    explanation: "One invited user still has no property access assigned.",
    primaryAction: { id: "signal-open", label: "View" },
    secondaryActions: [{ id: "dismiss", label: "Dismiss" }],
  },
  {
    id: "fixture:recent:weather",
    kind: "weather",
    disposition: "recent",
    reviewState: "none",
    typeChip: chip("weather"),
    title: "Roof work may be affected tomorrow",
    contextLine: "system • 09:10",
    explanation: "Rain forecast overlaps scheduled roof inspection.",
    primaryAction: { id: "signal-open", label: "Review" },
    secondaryActions: [{ id: "dismiss", label: "Dismiss" }],
  },
  {
    id: "fixture:recent:document",
    kind: "document",
    disposition: "recent",
    reviewState: "none",
    typeChip: chip("document"),
    title: "PDF uploaded and auto-linked to EICR",
    contextLine: "system • Mon, 14:05",
    explanation: "File matched an existing compliance slot with high confidence.",
    primaryAction: { id: "signal-open", label: "View" },
    secondaryActions: [{ id: "dismiss", label: "Dismiss" }],
  },
  {
    id: "fixture:recent:system",
    kind: "system",
    disposition: "recent",
    reviewState: "none",
    typeChip: chip("system"),
    title: "Task completed: Annual fire door check",
    contextLine: "system • Sun, 11:30",
    explanation: "Work item closed — appears on timeline for audit visibility.",
    primaryAction: { id: "signal-open", label: "View" },
    secondaryActions: [{ id: "dismiss", label: "Dismiss" }],
  },
];

/** Needs review: ambiguity / judgment queue. */
export const SIGNAL_UI_FIXTURES_REVIEW: SignalUiFixture[] = [
  {
    id: "fixture:review:ai_classify",
    kind: "ai_suggestion",
    disposition: "needs_review",
    reviewState: "needs_classification",
    typeChip: chip("ai_suggestion"),
    title: "Possible compliance document",
    contextLine: "Uploaded image • Pelican site",
    whyHere: "AI confidence is too low to auto-classify.",
    explanation: "Certificate-like text found but owner and record type are unclear.",
    primaryAction: { id: "signal-convert", label: "Add to Records" },
    secondaryActions: [
      { id: "signal-review", label: "Treat as Issue" },
      { id: "dismiss", label: "Dismiss" },
    ],
  },
  {
    id: "fixture:review:conflict",
    kind: "conflict",
    disposition: "needs_review",
    reviewState: "needs_resolution",
    typeChip: chip("conflict"),
    title: "Contractors overlap",
    contextLine: "Scheduling • This week",
    whyHere: "Two bookings conflict in the same time window.",
    explanation: "James Electrical and Fix Crew appear booked for overlapping slots.",
    primaryAction: { id: "signal-assign", label: "Resolve" },
    secondaryActions: [{ id: "dismiss", label: "Dismiss" }],
  },
  {
    id: "fixture:review:admin",
    kind: "admin",
    disposition: "needs_review",
    reviewState: "needs_permissions",
    typeChip: chip("admin"),
    title: "Set permissions for new staff member",
    contextLine: "Organisation • Today",
    whyHere: "New user has no team or property access yet.",
    explanation: "Invited user cannot see work until access is assigned.",
    primaryAction: { id: "signal-assign", label: "Assign permissions" },
    secondaryActions: [{ id: "dismiss", label: "Dismiss" }],
  },
  {
    id: "fixture:review:linking",
    kind: "upload",
    disposition: "needs_review",
    reviewState: "needs_linking",
    typeChip: chip("upload"),
    title: "Photo with no space assigned",
    contextLine: "Mobile upload • 10:02",
    whyHere: "No property / space context — cannot route automatically.",
    explanation: "Assign a location so this can become evidence or an issue.",
    primaryAction: { id: "signal-assign", label: "Assign location" },
    secondaryActions: [{ id: "signal-convert", label: "Convert" }, { id: "dismiss", label: "Dismiss" }],
  },
  {
    id: "fixture:review:duplicate",
    kind: "conflict",
    disposition: "needs_review",
    reviewState: "needs_classification",
    typeChip: chip("conflict"),
    title: "Possible duplicate issue",
    contextLine: "Inbox • Just now",
    whyHere: "Similar open task already exists on this property.",
    explanation: "Text matches an active task from last week — merge or keep separate?",
    primaryAction: { id: "signal-review", label: "Compare" },
    secondaryActions: [{ id: "dismiss", label: "Dismiss" }],
  },
];

export const SIGNAL_UI_FIXTURES_URGENT: SignalUiFixture[] = [
  {
    id: "fixture:urgent:compliance",
    kind: "ai_warning",
    disposition: "urgent",
    reviewState: "none",
    typeChip: "AI WARNING",
    title: "Mandatory certificate may be expired",
    contextLine: "Compliance • Pelican • Due yesterday",
    whyHere: "Parsed expiry conflicts with stored “valid” state.",
    explanation: "EICR expiry date in document does not match portfolio record.",
    primaryAction: { id: "report-issue", label: "Report Issue" },
    secondaryActions: [{ id: "ignore", label: "Ignore" }],
  },
];

export function fixtureReviewBanner(f: SignalUiFixture): string | undefined {
  if (f.disposition !== "needs_review" || f.reviewState === "none") return undefined;
  const rs = reviewStateDisplay(f.reviewState);
  if (!rs) return `${f.typeChip}`;
  return `${f.typeChip} • ${rs}`;
}
