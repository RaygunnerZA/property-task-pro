/**
 * Display-only sentence case for space names, e.g. "LIVING ROOM" → "Living room".
 * Does not mutate stored values.
 */
export function toSentenceCaseSpaceName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "Unnamed";
  const lower = trimmed.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Next free numbered name for a shallow space copy, e.g. "Kitchen" → "Kitchen 2".
 * Matches existing organise / onboarding copy behaviour.
 */
export function getSuggestedCopyName(baseName: string, existingNames: Iterable<string>): string {
  const base = baseName.trim();
  if (!base) return base;

  const escaped = base.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}(?:\\s+(\\d+))?$`, "i");
  let maxNum = 0;

  for (const raw of existingNames) {
    const name = (raw ?? "").trim();
    const match = name.match(re);
    if (!match) continue;
    const n = match[1] ? parseInt(match[1], 10) : 1;
    if (n > maxNum) maxNum = n;
  }

  return `${base} ${maxNum + 1}`;
}
