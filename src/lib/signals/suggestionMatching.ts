import type { SuggestionDocument, SuggestionTask } from "./actionableSuggestionTypes";

export const TERMINAL_TASK_STATUSES = new Set(["completed", "archived", "done"]);

export const ACCESS_PATTERN =
  /\b(access|keys?|entry|let[\s-]?in|waiting for (the )?tenant|no access)\b/i;
/** Later evidence that access is no longer a blocker. */
export const ACCESS_RESOLVED_PATTERN =
  /\b(access (confirmed|arranged|sorted|provided|given)|keys? (left|provided|given|with)|let[\s-]?in (arranged|confirmed)|entry (confirmed|arranged)|no longer (needs?|waiting for) access|access (issue )?resolved)\b/i;
export const ACCESS_CANCELLED_PATTERN =
  /\b(visit (cancelled|canceled|called off)|cancelled (the )?visit|job cancelled|appointment cancelled|no longer required)\b/i;
/** Clear evidence an update was sent to the tenant — not merely mentioning them. */
export const TENANT_NOTIFY_SENT_PATTERN =
  /\b((sms|text|email|letter|message) (sent|posted|delivered) (to )?(the )?(tenant|occup)|tenant (notified|informed|told|texted|emailed)|notified (the )?tenant|informed (the )?occup|texted (the )?tenant)\b/i;
export const TENANT_MENTION_ONLY_PATTERN = /\b(tenant|occupier|resident)\b/i;
export const VISIT_CANCELLED_PATTERN =
  /\b(cancelled|canceled|called off|no longer (going|required)|visit (cancelled|canceled))\b/i;
export const VISIT_PATTERN =
  /\b(visit|appointment|engineer|inspection|access visit|contractor visit|booked)\b/i;
export const INSPECTION_PATTERN =
  /\b(inspect|inspection|gas(\s+safe)?|eicr|legionella|fire risk|pat(\s+test)?|loler|certificate)\b/i;
export const FAULT_PATTERN =
  /\b(leak|leaking|fault|broken|repair|heating|boiler|damp|ingress|not working|blocked|overflow)\b/i;
/** Specific fault nouns used for duplicate matching — excludes weak shared words like "repair". */
export const FAULT_NOUN_PATTERN =
  /\b(leak|leaking|boiler|heating|radiator|damp|ingress|overflow|blocked|burst|flood)\b/i;
export const RENEWAL_PATTERN =
  /\b(renew|renewal|re-?inspect|certificate|expiry|expire|compliance)\b/i;
export const CERT_FILE_PATTERN = /\b(cert|certificate|cp12|eicr|gas.?safe|warranty)\b/i;
export const EMAIL_ACTIONABLE_PATTERN =
  /\b(please (approve|confirm|advise|respond|action)|approval (needed|required)|quote|quotation|invoice|appointment|access (details|required)|complaint|urgent|can you|need(s)? (your|a) (decision|response|approval)|waiting (for|on) (your|a))\b/i;
export const LOCATION_TOKENS = [
  "kitchen",
  "bathroom",
  "lounge",
  "living",
  "bedroom",
  "hall",
  "hallway",
  "landing",
  "attic",
  "loft",
  "basement",
  "garden",
  "garage",
  "roof",
  "cupboard",
  "utility",
  "toilet",
  "ensuite",
  "balcony",
] as const;

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "to",
  "for",
  "and",
  "of",
  "at",
  "on",
  "in",
  "this",
  "that",
  "task",
  "open",
  "due",
  "from",
  "with",
  "into",
  "your",
  "our",
]);

export function isOpenTask(task: SuggestionTask): boolean {
  return !TERMINAL_TASK_STATUSES.has((task.status ?? "").toLowerCase());
}

export function isCompletedTask(task: SuggestionTask): boolean {
  return (task.status ?? "").toLowerCase() === "completed";
}

export function daysUntil(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  const startNow = new Date(now);
  startNow.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - startNow.getTime()) / (1000 * 60 * 60 * 24));
}

export function daysAgo(iso: string | null | undefined, now: Date): number | null {
  const until = daysUntil(iso, now);
  return until == null ? null : -until;
}

export function taskDueIso(task: SuggestionTask): string | null {
  return task.due_date || task.due_at || null;
}

export function taskText(task: SuggestionTask): string {
  return `${task.title ?? ""} ${task.description ?? ""}`.trim();
}

export function significantTokens(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
  return new Set(tokens);
}

export function sharedTokenCount(a: string, b: string): number {
  const left = significantTokens(a);
  const right = significantTokens(b);
  let count = 0;
  for (const token of left) {
    if (right.has(token)) count += 1;
  }
  return count;
}

export function sharedFaultTokens(a: string, b: string): boolean {
  const left = significantTokens(a);
  const right = significantTokens(b);
  for (const token of left) {
    if (!right.has(token)) continue;
    if (FAULT_NOUN_PATTERN.test(token)) return true;
  }
  return false;
}

export function locationTokensIn(text: string): Set<string> {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const token of LOCATION_TOKENS) {
    if (new RegExp(`\\b${token}\\b`, "i").test(lower)) found.add(token);
  }
  return found;
}

/** True when both texts name locations and those sets do not overlap. */
export function hasContradictoryLocations(a: string, b: string): boolean {
  const left = locationTokensIn(a);
  const right = locationTokensIn(b);
  if (left.size === 0 || right.size === 0) return false;
  for (const token of left) {
    if (right.has(token)) return false;
  }
  return true;
}

export function isCancelledVisit(task: SuggestionTask, messages: Array<{ body: string }> = []): boolean {
  const status = (task.status ?? "").toLowerCase();
  if (status === "cancelled" || status === "canceled") return true;
  const corpus = `${taskText(task)} ${messages.map((message) => message.body).join(" ")}`;
  return VISIT_CANCELLED_PATTERN.test(corpus);
}

export type AccessBlockerState = "waiting" | "resolved" | "cancelled" | "none";

/**
 * Access advice is only current when the latest relevant evidence still shows a blocker.
 * A later confirmation, resolution or cancellation suppresses the suggestion.
 */
export function accessBlockerState(
  task: SuggestionTask,
  messages: Array<{ body: string; createdAt: string }> = []
): AccessBlockerState {
  const status = (task.status ?? "").toLowerCase();
  if (status === "cancelled" || status === "canceled") return "cancelled";

  type Event = { at: string; kind: "wait" | "resolved" | "cancelled" };
  const events: Event[] = [];

  const taskCorpus = taskText(task);
  if (ACCESS_CANCELLED_PATTERN.test(taskCorpus) || VISIT_CANCELLED_PATTERN.test(taskCorpus)) {
    events.push({ at: task.updated_at || task.created_at || "0", kind: "cancelled" });
  } else if (ACCESS_RESOLVED_PATTERN.test(taskCorpus)) {
    events.push({ at: task.updated_at || task.created_at || "0", kind: "resolved" });
  } else if (ACCESS_PATTERN.test(taskCorpus) && /\bwait(ing)?\b|no access|need(s)? access/i.test(taskCorpus)) {
    events.push({ at: task.created_at || "0", kind: "wait" });
  }

  for (const message of messages) {
    const body = message.body ?? "";
    if (ACCESS_CANCELLED_PATTERN.test(body) || VISIT_CANCELLED_PATTERN.test(body)) {
      events.push({ at: message.createdAt || "0", kind: "cancelled" });
    } else if (ACCESS_RESOLVED_PATTERN.test(body)) {
      events.push({ at: message.createdAt || "0", kind: "resolved" });
    } else if (ACCESS_PATTERN.test(body) && /\bwait(ing)?\b|no access|need(s)? access|keys?\b/i.test(body)) {
      events.push({ at: message.createdAt || "0", kind: "wait" });
    }
  }

  if (events.length === 0) {
    if (ACCESS_PATTERN.test(taskCorpus)) return "waiting";
    return "none";
  }

  events.sort((a, b) => a.at.localeCompare(b.at));
  const latest = events[events.length - 1]!;
  if (latest.kind === "cancelled") return "cancelled";
  if (latest.kind === "resolved") return "resolved";
  return "waiting";
}

/**
 * True only when Filla has evidence an update was sent to the tenant,
 * not merely that someone mentioned them in an internal note.
 */
export function hasTenantNotificationRecorded(
  task: SuggestionTask,
  messages: Array<{ body: string; direction?: string | null; source?: string | null }> = []
): boolean {
  if (TENANT_NOTIFY_SENT_PATTERN.test(taskText(task))) return true;
  return messages.some((message) => {
    const body = message.body ?? "";
    if (!TENANT_NOTIFY_SENT_PATTERN.test(body)) return false;
    const direction = (message.direction ?? "").toLowerCase();
    const source = (message.source ?? "").toLowerCase();
    // Prefer outbound / external send channels; still accept clear "tenant notified" wording.
    if (direction === "outbound" || source === "sms" || source === "email" || source === "letter") {
      return true;
    }
    return TENANT_NOTIFY_SENT_PATTERN.test(body);
  });
}

export function emailHasActionableTrigger(input: {
  title?: string | null;
  body?: string | null;
  payload?: Record<string, unknown> | null;
}): boolean {
  const subject = String(input.payload?.subject ?? input.title ?? "");
  const preview = String(input.payload?.preview ?? input.body ?? "");
  const corpus = `${subject} ${preview}`;
  return EMAIL_ACTIONABLE_PATTERN.test(corpus);
}

export function documentLabel(doc: SuggestionDocument): string {
  return (doc.title || doc.document_type || "This certificate").trim();
}

export function documentDueIso(doc: SuggestionDocument): string | null {
  return doc.next_due_date || doc.expiry_date || null;
}

export function looksLikeRenewalTask(task: SuggestionTask, doc: SuggestionDocument): boolean {
  if (!isOpenTask(task)) return false;
  if (doc.property_id && task.property_id && doc.property_id !== task.property_id) {
    return false;
  }
  const text = taskText(task);
  if (!RENEWAL_PATTERN.test(text) && !task.is_compliance) return false;
  const docText = `${doc.title ?? ""} ${doc.document_type ?? ""}`;
  return sharedTokenCount(text, docText) >= 1 || RENEWAL_PATTERN.test(docText);
}

export function parseTaskAttachments(images: unknown): Array<{
  file_name?: string;
  file_url?: string;
  file_type?: string;
}> {
  if (!images) return [];
  try {
    const parsed = typeof images === "string" ? JSON.parse(images) : images;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function taskHasCertificateAttachment(task: SuggestionTask): boolean {
  return parseTaskAttachments(task.images).some((attachment) => {
    const name = `${attachment.file_name ?? ""} ${attachment.file_url ?? ""}`.toLowerCase();
    const type = (attachment.file_type ?? "").toLowerCase();
    return CERT_FILE_PATTERN.test(name) || type.includes("pdf");
  });
}

export function isInspectionLike(task: SuggestionTask): boolean {
  if (task.is_compliance) return true;
  const text = taskText(task);
  const type = (task.type ?? "").toLowerCase();
  return INSPECTION_PATTERN.test(text) || INSPECTION_PATTERN.test(type);
}

export function isVisitLike(task: SuggestionTask): boolean {
  return VISIT_PATTERN.test(taskText(task));
}

export function isFaultLike(task: SuggestionTask): boolean {
  return FAULT_PATTERN.test(taskText(task));
}

export function isProgressingUrgentWork(task: SuggestionTask): boolean {
  const status = (task.status ?? "").toLowerCase();
  const priority = (task.priority ?? "").toLowerCase();
  return (
    status === "in_progress" &&
    Boolean(task.assigned_user_id) &&
    (priority === "urgent" || priority === "high")
  );
}

export function canManageSignals(role: string | null): boolean {
  const normalized = (role ?? "").toLowerCase();
  return normalized === "owner" || normalized === "manager" || normalized === "admin";
}

export function weekdayLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "the booked day";
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return date.toLocaleDateString("en-GB", { weekday: "long" });
}
