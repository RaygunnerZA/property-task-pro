/**
 * Shared helpers for inline chip inputs (task create + task edit rows).
 */

/** Defer closing inline edit unless focus moved outside the row container. */
export function scheduleInlineInputBlur(
  container: HTMLElement | null,
  onClose: () => void,
  delayMs = 150
): void {
  setTimeout(() => {
    if (container?.contains(document.activeElement)) return;
    onClose();
  }, delayMs);
}

/** Prefer exact name match, then first prefix/substring suggestion. */
export function pickBestNameMatch<T extends { name: string }>(
  items: T[],
  query: string
): T | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  const exact = items.find((item) => item.name.toLowerCase() === q);
  if (exact) return exact;
  return items.find((item) => item.name.toLowerCase().includes(q));
}
