export type SourceUrlSaveIntent =
  | { kind: "update"; sourceId: string }
  | { kind: "replace"; previousUrl: string }
  | { kind: "add" };

export function sourceUrlSaveIntent(input: {
  editingId: string | "new" | null;
  previousUrl?: string | null;
}): SourceUrlSaveIntent {
  if (input.editingId && input.editingId !== "new") {
    return { kind: "update", sourceId: input.editingId };
  }
  const previous = input.previousUrl?.trim() ?? "";
  if (previous) return { kind: "replace", previousUrl: previous };
  return { kind: "add" };
}

export function sourceUrlRemoveTarget(source: {
  id?: string;
  url?: string | null;
}): { sourceId: string | null; url: string | null } | null {
  const url = source.url?.trim() || null;
  if (source.id) return { sourceId: source.id, url };
  if (url) return { sourceId: null, url };
  return null;
}
