/**
 * Shared filters for person / invite chip detection.
 * Rejects imperative verbs, date-context month names, and other non-person tokens.
 */

/** Month names and abbreviations (for date-context rejection). */
export const MONTH_NAME_TOKENS = new Set([
  "january",
  "jan",
  "february",
  "feb",
  "march",
  "mar",
  "april",
  "apr",
  "may",
  "june",
  "jun",
  "july",
  "jul",
  "august",
  "aug",
  "september",
  "sept",
  "sep",
  "october",
  "oct",
  "november",
  "nov",
  "december",
  "dec",
]);

/** Tokens that must never become person / INVITE chips. */
export const NON_PERSON_WORDS = new Set([
  // Task verbs (title/description starters)
  "fix",
  "check",
  "clean",
  "repair",
  "install",
  "replace",
  "inspect",
  "review",
  "update",
  "remove",
  "add",
  "call",
  "book",
  "schedule",
  "contact",
  "order",
  "buy",
  "get",
  "test",
  "paint",
  "seal",
  "drain",
  "flush",
  "reset",
  "collect",
  "send",
  "pick",
  "deliver",
  "bring",
  "fetch",
  "grab",
  "take",
  "give",
  "make",
  "let",
  "help",
  "hire",
  "pay",
  "remind",
  "notify",
  "delegate",
  "prepare",
  "organize",
  "arrange",
  "ensure",
  "confirm",
  "complete",
  "finish",
  "start",
  "stop",
  "hold",
  "keep",
  "run",
  "set",
  "put",
  "hand",
  "coordinate",
  "follow",
  "have",
  "ask",
  "need",
  "want",
  // Meta / grammar
  "the",
  "this",
  "that",
  "and",
  "for",
  "not",
  "but",
  "from",
  "with",
  "into",
  "must",
  "should",
  "needs",
  "will",
  "can",
  "may",
  "please",
  "urgent",
  "today",
  "tomorrow",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "next",
  "last",
  "asap",
  // Rooms / spaces (not people)
  "kitchen",
  "bathroom",
  "bedroom",
  "living",
  "garden",
  "garage",
  "office",
  "hall",
  "entrance",
  "cottage",
  "house",
  "flat",
  "apartment",
  "room",
  "boiler",
  "toilet",
  "shower",
  "window",
  "door",
  "pipe",
  "roof",
  "floor",
  "wall",
  "ceiling",
  "lock",
  "pool",
  "new",
  "old",
  "broken",
  "leaking",
  "blocked",
  "damaged",
  "high",
  "low",
  "medium",
  "normal",
]);

/** "Have Oliver collect …", "Get John to fix …" */
export const IMPERATIVE_DELEGATE_PATTERN =
  /\b(?:have|get|ask|need|want)\s+([A-Za-z]{2,})\s+(?:(?:to)\s+)?(?:collect|pick(?:\s+up)?|deliver|send|bring|fetch|grab|take|check|review|fix|repair|clean|install|replace|remove|organize|arrange|confirm|complete|finish|sort)\b/gi;

export function isMonthInDateContext(word: string, text: string): boolean {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!MONTH_NAME_TOKENS.has(w)) return false;
  const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${escaped}\\b`, "i"),
    new RegExp(`\\b${escaped}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, "i"),
    new RegExp(
      `\\b(?:by|before|until|on|in)\\s+(?:the\\s+)?\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${escaped}\\b`,
      "i"
    ),
    new RegExp(`\\b(?:by|before|until)\\s+${escaped}\\b`, "i"),
  ];
  return patterns.some((p) => p.test(text));
}

/**
 * Returns true when a candidate name should NOT become a person / invite chip.
 */
export function isRejectedPersonName(name: string, contextText?: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2) return true;

  const tokens = trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z'-]/g, ""))
    .filter(Boolean);

  if (tokens.length === 0) return true;

  for (const token of tokens) {
    if (NON_PERSON_WORDS.has(token)) return true;
    if (contextText && isMonthInDateContext(token, contextText)) return true;
  }

  return false;
}
