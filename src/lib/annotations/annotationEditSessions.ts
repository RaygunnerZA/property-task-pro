import type { Annotation } from "@/types/image-annotations";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AnnotationLayerSession = {
  id: string;
  createdAt: string;
  userId: string | null;
  userDisplayName: string;
  userAvatarUrl: string | null;
  versionNumber: number;
  label: string;
  annotations: Annotation[];
  isEnabled?: boolean;
  /** Real `task_image_annotation_versions.id` when this card maps to one DB row. */
  persistId?: string;
};

export type AuthorGroup = {
  userId: string | null;
  annotations: Annotation[];
};

/** True when `id` is a persisted version row, not a legacy/baseline/exploded card. */
export function isPersistedAnnotationLayerId(id: string | null | undefined): boolean {
  return Boolean(id && UUID_RE.test(id));
}

export function annotationAuthorKey(
  annotation: Annotation,
  defaultUserId: string | null | undefined,
): string {
  return annotation.createdBy || defaultUserId || "unknown";
}

/**
 * Group shapes by author, keeping first-seen author order.
 * Marks without `createdBy` stay with `defaultUserId` (the session owner).
 */
export function groupAnnotationsByAuthor(
  annotations: Annotation[],
  defaultUserId: string | null | undefined,
): AuthorGroup[] {
  const groups = new Map<string, AuthorGroup>();
  const order: string[] = [];

  for (const annotation of annotations) {
    const key = annotationAuthorKey(annotation, defaultUserId);
    let group = groups.get(key);
    if (!group) {
      group = {
        userId: annotation.createdBy || defaultUserId || null,
        annotations: [],
      };
      groups.set(key, group);
      order.push(key);
    }
    group.annotations.push(annotation);
  }

  return order.map((key) => groups.get(key)!);
}

export type SessionAuthorDisplay = {
  name: string;
  avatarUrl: string | null;
};

/**
 * One stacked card per author inside a layer. A mixed blob (legacy JSON or a
 * first-save that merged everyone) becomes Justin / Mathew / … panels.
 * Already-separate persisted layers are left as-is.
 */
export function splitEditSessionsByAuthor(
  sessions: AnnotationLayerSession[],
  resolveDisplay: (userId: string | null) => SessionAuthorDisplay,
): AnnotationLayerSession[] {
  const split: AnnotationLayerSession[] = [];

  for (const session of sessions) {
    const groups = groupAnnotationsByAuthor(session.annotations, session.userId);
    if (groups.length <= 1) {
      split.push(session);
      continue;
    }

    for (const group of groups) {
      const display = resolveDisplay(group.userId);
      split.push({
        ...session,
        id: `${session.id}:${group.userId ?? "unknown"}`,
        persistId: undefined,
        userId: group.userId,
        userDisplayName: display.name,
        userAvatarUrl: display.avatarUrl,
        annotations: group.annotations,
      });
    }
  }

  return split;
}

/** Later layers win when the same shape id appears in more than one session. */
export function winningSessionIdByAnnotation(
  sessions: Array<{ id: string; annotations: Annotation[]; isEnabled?: boolean }>,
  options: { previewLayerIds?: string[]; draftIds?: Set<string> } = {},
): Map<string, string> {
  const preview = new Set(options.previewLayerIds ?? []);
  const draftIds = options.draftIds ?? new Set<string>();
  const winner = new Map<string, string>();

  for (const session of sessions) {
    const enabled = session.isEnabled !== false || preview.has(session.id);
    if (!enabled) continue;
    for (const annotation of session.annotations) {
      if (draftIds.has(annotation.annotationId)) continue;
      winner.set(annotation.annotationId, session.id);
    }
  }

  return winner;
}
