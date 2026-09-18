/**
 * Pure helpers for document ↔ space filing (Gmail-label model).
 * Persistence uses attachment_spaces; never invents a records.space_id column.
 */

export type LinkedSpace = { id: string; name: string };

/** Prefer human title; fall back to filename without extension. */
export function documentDisplayTitle(doc: {
  title?: string | null;
  file_name?: string | null;
}): string {
  const title = doc.title?.trim();
  if (title) return title;
  const file = doc.file_name?.trim();
  if (file) return file.replace(/\.[^/.]+$/, "") || file;
  return "Untitled document";
}

export function isPropertyLevelDocument(doc: {
  linked_spaces?: LinkedSpace[] | null;
}): boolean {
  return !doc.linked_spaces || doc.linked_spaces.length === 0;
}

/** Space ids to insert when adding a link; empty if already linked. */
export function spaceIdsToAdd(
  currentIds: readonly string[],
  spaceId: string
): string[] {
  if (!spaceId || currentIds.includes(spaceId)) return [];
  return [spaceId];
}

/**
 * Reconcile multi-select "File to…" picker against current links.
 * Returns { add, remove } — never touches unrelated links outside the picker set.
 */
export function reconcileSpaceLinks(
  currentIds: readonly string[],
  selectedIds: readonly string[]
): { add: string[]; remove: string[] } {
  const current = new Set(currentIds);
  const selected = new Set(selectedIds);
  const add: string[] = [];
  const remove: string[] = [];
  for (const id of selected) {
    if (!current.has(id)) add.push(id);
  }
  for (const id of current) {
    if (!selected.has(id)) remove.push(id);
  }
  return { add, remove };
}

export function filingDropOverlayLabel(
  spaceName: string | null,
  isPropertyLevel: boolean
): string {
  if (isPropertyLevel) return "Keep at property level";
  // "+" marks the additive verb — filing links, it never moves the document
  // (one gesture, three verbs — @Docs/04_UI_System.md).
  return `+ File to ${spaceName?.trim() || "space"}`;
}

export function filedToastMessage(spaceName: string): string {
  return `Filed to ${spaceName.trim() || "space"}`;
}

export function removedLinkToastMessage(spaceName: string): string {
  return `Removed ${spaceName.trim() || "space"} link`;
}
