/**
 * Consolidated Fuzzy Matching Utilities
 * Single source of truth for all string similarity logic in the AI pipeline.
 *
 * Two matching modes:
 *   - Distance-based  (`isFuzzyMatch`)       — edit distance ≤ threshold (default 2).
 *     Good for comparing individual words against short entity names.
 *   - Similarity-based (`isFuzzyMatchSimilarity`) — ratio ≥ threshold (default 0.8).
 *     Good for comparing full labels with plural/singular awareness.
 */

// ─── Normalisation ──────────────────────────────────────────────

/**
 * Normalise a string for matching: lowercase, trim, remove punctuation,
 * collapse whitespace.
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')  // Strip punctuation
    .replace(/\s+/g, ' ');    // Collapse whitespace
}

/**
 * Split text into words (≥ 3 chars) for keyword-level matching.
 */
export function extractWords(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
}

// ─── Levenshtein Distance ───────────────────────────────────────

/**
 * Classic Levenshtein edit-distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// ─── Distance-based Fuzzy Match ─────────────────────────────────

/**
 * Quick fuzzy match by absolute edit distance.
 * Used by the rule-based extractor for keyword-level matching.
 *
 * Checks (in order): exact → contains → Levenshtein ≤ `maxDistance`.
 */
export function isFuzzyMatch(a: string, b: string, maxDistance = 2): boolean {
  const na = normalizeString(a);
  const nb = normalizeString(b);

  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  return levenshteinDistance(na, nb) <= maxDistance;
}

// ─── Similarity-based Fuzzy Match ───────────────────────────────

/**
 * Careful fuzzy match by similarity ratio, with plural/singular awareness.
 * Used by the resolution pipeline for entity-level matching.
 *
 * Checks (in order): exact → contains → plural/singular → Levenshtein ratio ≥ `minSimilarity`.
 */
export function isFuzzyMatchSimilarity(
  a: string,
  b: string,
  minSimilarity = 0.8,
): boolean {
  const na = normalizeString(a);
  const nb = normalizeString(b);

  // Exact match after normalisation
  if (na === nb) return true;

  // Containment
  if (na.includes(nb) || nb.includes(na)) return true;

  // Plural / singular variations
  const plural1 = na.endsWith('s') ? na.slice(0, -1) : na + 's';
  const plural2 = nb.endsWith('s') ? nb.slice(0, -1) : nb + 's';
  if (na === plural2 || nb === plural1) return true;

  // Levenshtein similarity ratio
  const longer = na.length > nb.length ? na : nb;
  const distance = levenshteinDistance(na, nb);
  const similarity = 1 - distance / longer.length;

  return similarity >= minSimilarity;
}
