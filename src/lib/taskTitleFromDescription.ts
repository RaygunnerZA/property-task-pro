/**
 * Derive a short task title from free-text description when AI has not
 * produced a summary yet. Prefer actionable work items over narrative openings.
 */

const TITLE_TRAILING_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "because",
  "before",
  "but",
  "for",
  "from",
  "if",
  "in",
  "into",
  "of",
  "on",
  "or",
  "since",
  "so",
  "than",
  "that",
  "the",
  "then",
  "there",
  "to",
  "unless",
  "when",
  "which",
  "while",
  "who",
  "with",
]);

/** Words dropped when compacting a phrase into a title. */
const TITLE_FILLER = new Set([
  "a",
  "an",
  "the",
  "latest",
  "new",
  "please",
  "pls",
  "just",
  "also",
  "really",
  "very",
  "today",
  "tomorrow",
  "tonight",
  "asap",
  "urgently",
  "immediate",
  "immediately",
  "currently",
]);

const ACTION_VERBS =
  "fix|repair|replace|change|update|move|review|send|add|remove|check|clean|install|inspect|paint|upload|service|clear|unblock|reset|arrange|book|call|chase|file|renew|submit|drain|unclog|investigate|schedule|follow|chase";

/** Idle / blur delay before committing a non-AI summary title. */
export const TASK_TITLE_SETTLE_MS = 2000;

const MAX_TITLE_WORDS = 6;

/** Cut reason / subordinate tails so titles don't end mid-clause. */
function clipReasonClause(phrase: string): string {
  return phrase.replace(
    /\s+\b(?:as|because|since|although|though|unless)\b[\s\S]*$/i,
    ""
  );
}

function stripTrailingStopWords(phrase: string): string {
  const words = normalizeSpace(phrase).split(" ").filter(Boolean);
  while (
    words.length > 1 &&
    TITLE_TRAILING_STOP_WORDS.has(words[words.length - 1]!.toLowerCase())
  ) {
    words.pop();
  }
  return words.join(" ");
}

function normalizeSpace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/** Lowercase, collapse punctuation to spaces — for prefix/echo compares. */
function normalizeForCompare(input: string): string {
  return normalizeSpace(input.toLowerCase().replace(/[.!?,:;'"()[\]]+/g, " "));
}

function capitalizeTitle(phrase: string): string {
  const trimmed = phrase.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Drop filler words and hard-cap length. */
export function compactTitlePhrase(phrase: string, maxWords = MAX_TITLE_WORDS): string {
  const clipped = clipReasonClause(normalizeSpace(phrase));
  const words = clipped
    .replace(/[.!?,:;]+$/g, "")
    .split(" ")
    .map((w) => w.replace(/^[^\w/#.-]+|[^\w/#.-]+$/g, ""))
    .filter(Boolean)
    .filter((w, i) => {
      const lower = w.toLowerCase();
      // Keep first word even if filler-like when it's a verb (Upload).
      if (i === 0) return true;
      return !TITLE_FILLER.has(lower);
    });

  // Collapse "to the property records/files" style tails (incl. truncated "prop").
  const withoutRecordsTail: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].toLowerCase();
    const next = words[i + 1]?.toLowerCase();
    const next2 = words[i + 2]?.toLowerCase();
    const isPropertyish = (s?: string) =>
      !!s && /^(property|prop|our|records?|files?|docs?|documents?)$/i.test(s);

    if (w === "to" && (next === "the" || isPropertyish(next))) {
      if (next === "the" && isPropertyish(next2)) {
        i += 2;
        while (i + 1 < words.length && isPropertyish(words[i + 1])) i += 1;
        continue;
      }
      if (isPropertyish(next)) {
        i += 1;
        while (i + 1 < words.length && isPropertyish(words[i + 1])) i += 1;
        continue;
      }
    }
    withoutRecordsTail.push(words[i]);
  }

  return stripTrailingStopWords(withoutRecordsTail.slice(0, maxWords).join(" "));
}

/**
 * True when `title` is essentially the start of `description` (echo / trim),
 * not a compact actionable summary of it.
 */
export function isTitleEchoOfDescription(title: string, description: string): boolean {
  const t = normalizeForCompare(title);
  const d = normalizeForCompare(description);
  if (!t || t.length < 6 || !d) return false;

  // Narrative openings are always echoes of the note's story lead-in.
  if (
    /^(this|that)\s+(morning|afternoon|evening|week)\b/.test(t) ||
    /\bsaid\b/.test(t)
  ) {
    return true;
  }

  // Strip common lead-ins from description before comparing.
  const dCore = d
    .replace(/^(?:hi|hey|hello)\s+/, "")
    .replace(/^(?:we\s+need\s+to|need\s+to|please|pls)\s+/, "")
    .replace(/^(?:just\s+a\s+quick\s+note\s*|quick\s+note\s*)/, "");

  // Verbatim / lightly punctuated prefix of the note.
  if (d.startsWith(t) || dCore.startsWith(t)) return true;

  const titleWords = t.split(" ").filter(Boolean);
  const descWords = d.split(" ").filter(Boolean);
  if (titleWords.length < 3) return false;

  // Contiguous opening-word match (ignoring filler) — long titles only.
  // Short verb+object summaries often reuse opening content words without being echoes.
  if (titleWords.length < 5) return false;

  const stripWeak = (w: string) =>
    !TITLE_FILLER.has(w) && !TITLE_TRAILING_STOP_WORDS.has(w);
  const titleContent = titleWords.filter(stripWeak);
  const descContent = descWords.filter(stripWeak);
  if (
    titleContent.length >= 4 &&
    descContent.slice(0, titleContent.length).join(" ") === titleContent.join(" ")
  ) {
    return true;
  }
  return false;
}

function extractActionPhrases(normalized: string): string[] {
  const phrases: string[] = [];
  // Verb + following words; stop at clause punctuation (do not treat "." as a word char).
  const re = new RegExp(
    `\\b((?:please\\s+)?(?:${ACTION_VERBS})\\b(?:\\s+[a-z0-9][a-z0-9/#-]*){0,8})`,
    "gi"
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    const raw = m[1]
      .replace(/^\s*please\s+/i, "")
      .replace(/\b(today|tomorrow|tonight|asap|urgent(ly)?|now)\b/gi, " ");
    const compact = compactTitlePhrase(raw, 5);
    if (compact.split(" ").filter(Boolean).length >= 2) {
      phrases.push(capitalizeTitle(compact));
    }
  }
  return phrases;
}

/** True when `a` is the same work item as `b` (or a longer restatement). */
function isSameWorkItem(a: string, b: string): boolean {
  const aw = normalizeForCompare(a).split(" ").filter(Boolean);
  const bw = normalizeForCompare(b).split(" ").filter(Boolean);
  if (aw.length === 0 || bw.length === 0) return false;
  const shorter = aw.length <= bw.length ? aw : bw;
  const longer = aw.length <= bw.length ? bw : aw;
  return shorter.every((w, i) => longer[i] === w);
}

function extractProblemFixes(normalized: string): string[] {
  const fixes: string[] = [];

  // "the dishwasher isn't draining" / "dishwasher isnt working"
  const problemRe =
    /\b(?:the\s+)?([a-z][a-z0-9/-]{2,}(?:\s+[a-z][a-z0-9/-]{2,}){0,2})\s+(?:isn'?t|is\s+not|not)\s+(?:draining|working|heating|cooling|flushing|charging|starting|opening|closing|responding)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = problemRe.exec(normalized)) !== null) {
    const obj = compactTitlePhrase(m[1], 3);
    if (obj) fixes.push(capitalizeTitle(`Fix ${obj}`));
  }

  // "leaking kitchen tap" / "kitchen tap is leaking"
  const leakBefore = normalized.match(
    /\b(?:a\s+|the\s+)?(leaking\s+[a-z][a-z0-9/-]*(?:\s+[a-z][a-z0-9/-]*){0,2})/i
  );
  if (leakBefore?.[1]) {
    fixes.push(capitalizeTitle(compactTitlePhrase(`Fix ${leakBefore[1]}`, 5)));
  }
  const leakAfter = normalized.match(
    /\b(?:the\s+)?([a-z][a-z0-9/-]*(?:\s+[a-z][a-z0-9/-]*){0,2})\s+(?:is\s+)?leaking\b/i
  );
  if (leakAfter?.[1]) {
    fixes.push(capitalizeTitle(compactTitlePhrase(`Fix leaking ${leakAfter[1]}`, 5)));
  }

  return fixes;
}

function extractNeedToAction(normalized: string): string | null {
  const needToMatch = normalized.match(/\b(?:we\s+need\s+to|need\s+to)\s+([^,.!?]+)/i);
  if (!needToMatch?.[1]) return null;
  const compact = compactTitlePhrase(needToMatch[1], MAX_TITLE_WORDS);
  if (compact.split(" ").filter(Boolean).length < 2) return null;
  return capitalizeTitle(compact);
}

/**
 * "Address Change - France address…" / "Boiler: not heating" → topic label.
 * Useful when notes lead with a work type rather than an imperative verb.
 */
function extractLabeledTopic(normalized: string): string | null {
  const match = normalized.match(
    /^([A-Za-z][A-Za-z0-9/#&'’\s-]{1,40}?)\s*[-–—:|]\s+\S/
  );
  if (!match?.[1]) return null;
  const topic = compactTitlePhrase(match[1], 4);
  const words = topic.split(" ").filter(Boolean);
  if (words.length < 2) return null;
  if (/^(this|that|hi|hey|hello|re|fw|fwd)\b/i.test(topic)) return null;
  return capitalizeTitle(topic);
}

/** Last-resort compact first clause when no verb/problem patterns match. */
function extractFirstClauseSummary(normalized: string): string | null {
  const firstClause = normalized.split(/[.!?\n]/)[0] ?? normalized;
  const withoutLeadIn = firstClause
    .replace(/^(?:hi|hey|hello)[,!\s]+/i, "")
    .replace(/^(?:just\s+a\s+quick\s+note[:\s]*|quick\s+note[:\s]*)/i, "");
  // Prefer the segment after a topic dash if present.
  const afterDash = withoutLeadIn.replace(/^[^–—:\-|]{1,40}?\s*[-–—:|]\s+/, "");
  const compact = compactTitlePhrase(afterDash || withoutLeadIn, MAX_TITLE_WORDS);
  if (compact.split(" ").filter(Boolean).length < 2) return null;
  const titled = capitalizeTitle(compact);
  if (isTitleEchoOfDescription(titled, normalized)) {
    const tighter = capitalizeTitle(compactTitlePhrase(compact, 4));
    if (tighter && !isTitleEchoOfDescription(tighter, normalized)) return tighter;
    return null;
  }
  return titled;
}

/**
 * Heuristic summary title — actionable, short, not a narrative opening.
 * Returns "" when nothing usable can be derived.
 */
export function buildFallbackTitleFromDescription(input: string): string {
  const normalized = normalizeSpace(input);
  if (!normalized || normalized.length < 8) return "";

  const problems = extractProblemFixes(normalized);
  const actions = extractActionPhrases(normalized);
  const needTo = extractNeedToAction(normalized);
  const labeled = extractLabeledTopic(normalized);

  // Merge unique phrases (case-insensitive), prefer problems + concrete verbs.
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (p: string | null | undefined) => {
    if (!p) return;
    const key = p.toLowerCase();
    if (seen.has(key)) return;
    // Skip weak narrative leftovers
    if (/^(this|that|oliver|said|mentioned|afternoon|morning|evening)\b/i.test(p)) return;
    // Prefer the shorter of near-duplicate work items
    for (let i = 0; i < ordered.length; i++) {
      if (isSameWorkItem(ordered[i], p)) {
        if (p.split(" ").length < ordered[i].split(" ").length) {
          seen.delete(ordered[i].toLowerCase());
          ordered[i] = p;
          seen.add(key);
        }
        return;
      }
    }
    seen.add(key);
    ordered.push(p);
  };

  for (const p of problems) push(p);
  for (const p of actions) push(p);
  push(needTo);
  push(labeled);

  if (ordered.length === 0) {
    return extractFirstClauseSummary(normalized) || "";
  }

  // One strong phrase, or two short ones joined.
  if (ordered.length === 1) {
    const one = ordered[0];
    if (isTitleEchoOfDescription(one, normalized)) {
      // Try compacting further
      const tighter = capitalizeTitle(compactTitlePhrase(one, 4));
      if (tighter && !isTitleEchoOfDescription(tighter, normalized)) return tighter;
      return extractFirstClauseSummary(normalized) || "";
    }
    return one;
  }

  // "Fix dishwasher and clean gutters"
  const a = ordered[0];
  const b = ordered[1];
  const aWords = a.split(" ");
  const bWords = b.split(" ");
  if (aWords.length + bWords.length <= 8) {
    const combined = `${a} and ${b.charAt(0).toLowerCase()}${b.slice(1)}`;
    if (!isTitleEchoOfDescription(combined, normalized)) return combined;
  }

  if (!isTitleEchoOfDescription(a, normalized)) return a;
  if (!isTitleEchoOfDescription(b, normalized)) return b;
  return extractFirstClauseSummary(normalized) || "";
}

/** Reject partial / mid-typing title fragments. Optional description rejects echoes. */
export function isUsableGeneratedTitle(rawTitle: string, description?: string): boolean {
  const trimmed = rawTitle.trim().replace(/[.!?,:;]+$/g, "");
  if (trimmed.length < 8) return false;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  if (words.length > 10) return false;

  const lastWord = words[words.length - 1] ?? "";
  if (lastWord.length < 2) return false;

  const lastWordLower = lastWord.toLowerCase();
  if (TITLE_TRAILING_STOP_WORDS.has(lastWordLower)) return false;
  if (/\bon(?:\s+the)?\s+\d{1,2}(?:st|nd|rd|th)?$/i.test(trimmed)) return false;

  // Narrative openings are not titles.
  if (
    /^(this|that)\s+(morning|afternoon|evening|week)\b/i.test(trimmed) ||
    /\bsaid\b/i.test(trimmed)
  ) {
    return false;
  }

  if (description && isTitleEchoOfDescription(trimmed, description)) {
    return false;
  }

  return true;
}

/** Normalize a candidate title for display (capitalize, strip trailing punct). */
export function finalizeGeneratedTitle(raw: string): string {
  const trimmed = normalizeSpace(raw);
  if (!trimmed) return "";
  const compact =
    compactTitlePhrase(trimmed, MAX_TITLE_WORDS) || stripTrailingStopWords(trimmed);
  return capitalizeTitle(compact.replace(/[.!]+$/g, ""));
}

/**
 * Resolve title for create/submit: manual → AI summary → settled heuristic.
 * Never uses a raw character slice of the description.
 */
export function resolveTaskTitle(
  title: string,
  aiTitleGenerated: string,
  description: string
): string | null {
  let finalTitle = title.trim();
  if (!finalTitle && aiTitleGenerated?.trim()) {
    const ai = finalizeGeneratedTitle(aiTitleGenerated);
    if (isUsableGeneratedTitle(ai, description)) finalTitle = ai;
  }
  if (!finalTitle && description.trim()) {
    const fallback = buildFallbackTitleFromDescription(description);
    if (fallback && isUsableGeneratedTitle(fallback, description)) {
      finalTitle = finalizeGeneratedTitle(fallback);
    }
  }
  return finalTitle.trim() || null;
}
