/**
 * Rank property spaces for Where pickers — prefer text / chip signals over the full catalog.
 */

export type RankableSpace = {
  id: string;
  name: string;
};

export type RankLikelySpacesOptions<T extends RankableSpace> = {
  spaces: T[];
  selectedIds?: string[];
  /** Task title + description (and similar) for name hits */
  contextText?: string;
  /** Resolved space entity ids from suggestion chips */
  suggestedEntityIds?: string[];
  /** Space labels from suggestion chips (resolved or ghost) */
  suggestedLabels?: string[];
  /** Max spaces to return (default 8) */
  limit?: number;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns the most likely spaces for quick pick. Selected spaces are always included.
 * When there is no text/chip signal, returns only selected spaces (empty if none) —
 * callers should rely on search / + Space for the rest of the catalog.
 */
export function rankLikelySpaces<T extends RankableSpace>({
  spaces,
  selectedIds = [],
  contextText = "",
  suggestedEntityIds = [],
  suggestedLabels = [],
  limit = 8,
}: RankLikelySpacesOptions<T>): T[] {
  if (spaces.length === 0 || limit <= 0) return [];

  const text = contextText.toLowerCase();
  const tokens = text.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2);
  const selected = new Set(selectedIds);
  const suggestedIds = new Set(suggestedEntityIds.filter(Boolean));
  const labels = suggestedLabels
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l.length > 0);

  const scored = spaces.map((space) => {
    let score = 0;
    const name = space.name.trim().toLowerCase();
    if (!name) return { space, score: 0 };

    if (selected.has(space.id)) score += 1000;
    if (suggestedIds.has(space.id)) score += 120;

    for (const label of labels) {
      if (label === name) score += 100;
      else if (name.includes(label) || label.includes(name)) score += 70;
    }

    if (name.length >= 3) {
      try {
        if (new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(contextText)) {
          score += 80;
        } else if (text.includes(name)) {
          score += 40;
        }
      } catch {
        if (text.includes(name)) score += 40;
      }
    }

    const nameTokens = name.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2);
    for (const nt of nameTokens) {
      if (tokens.includes(nt)) score += 18;
    }

    return { space, score };
  });

  const positive = scored
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.space.name.localeCompare(b.space.name);
    });

  if (positive.length === 0) return [];

  const out: T[] = [];
  const seen = new Set<string>();
  for (const row of positive) {
    if (seen.has(row.space.id)) continue;
    seen.add(row.space.id);
    out.push(row.space);
    if (out.length >= limit) break;
  }
  return out;
}
