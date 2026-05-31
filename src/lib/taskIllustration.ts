import { resolveToCanonicalSpaceType } from "@/config/spaceTypeAliases";
import { getSpaceMiniCardIllustration } from "@/lib/spaceTypeIllustrations";
import type { SignalKind } from "@/types/workbenchSignals";

/** Path prefix for default task thumbnails sourced from space mini-card art. */
export const TASK_SPACE_ILLUSTRATION_PATH_PREFIX = "/spaces/mini-cards/";

export function isTaskSpaceIllustrationUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith(TASK_SPACE_ILLUSTRATION_PATH_PREFIX);
}

export type TaskSpaceRef = {
  name?: string | null;
  type?: string | null;
  /** Canonical space type label when available (e.g. space_types.name). */
  spaceTypeName?: string | null;
};

/** Strip leading articles so "The Boiler Room" resolves like "Boiler Room". */
function normalizeSpaceLabel(input: string): string {
  let label = input.trim();
  if (!label) return label;
  const lower = label.toLowerCase();
  if (lower.startsWith("the ")) return label.slice(4).trim();
  if (lower.startsWith("a ")) return label.slice(2).trim();
  return label;
}

function resolveSpaceIllustrationLabel(space: TaskSpaceRef): string | null {
  const candidates = [
    space.spaceTypeName,
    space.type,
    space.name,
  ].filter((v): v is string => Boolean(v?.trim()));

  for (const raw of candidates) {
    const trimmed = raw.trim();
    const normalized = normalizeSpaceLabel(trimmed);
    const canonical =
      resolveToCanonicalSpaceType(normalized) ??
      resolveToCanonicalSpaceType(trimmed);
    if (canonical) return canonical;
    if (normalized) return normalized;
    if (trimmed) return trimmed;
  }
  return null;
}

/**
 * Task title keywords → canonical space type when linked space labels do not resolve.
 * Keeps maintenance tasks visually grounded (e.g. temperature checks → boiler room art).
 */
const TASK_TITLE_SPACE_HINTS: ReadonlyArray<{ pattern: RegExp; spaceType: string }> = [
  { pattern: /\b(boiler|temperature|thermostat|heating|hvac)\b/i, spaceType: "Boiler Room" },
  { pattern: /\b(server|rack|datacentre|datacenter)\b/i, spaceType: "Server Room" },
  { pattern: /\b(kitchen|cooker|oven|dishwasher|sink)\b/i, spaceType: "Kitchen" },
  { pattern: /\b(bathroom|toilet|wc|shower|mould|mold)\b/i, spaceType: "Bathroom" },
  { pattern: /\b(parking|car park|garage)\b/i, spaceType: "Car Park" },
  { pattern: /\b(pool|pump)\b/i, spaceType: "Garden" },
  { pattern: /\b(compliance|document|record)\b/i, spaceType: "Archive" },
];

function illustrationFromTitle(taskTitle: string | null | undefined): string | undefined {
  const title = taskTitle?.trim();
  if (!title) return undefined;
  for (const { pattern, spaceType } of TASK_TITLE_SPACE_HINTS) {
    if (!pattern.test(title)) continue;
    const src = getSpaceMiniCardIllustration(spaceType);
    if (src) return src;
  }
  return undefined;
}

/**
 * Mini-card illustration for tasks without uploaded images.
 * Prefers linked space context; falls back to task-title keyword hints.
 */
export function getTaskSpaceIllustration(
  spaces: TaskSpaceRef[] | null | undefined,
  taskTitle?: string | null
): string | undefined {
  if (spaces?.length) {
    for (const space of spaces) {
      const label = resolveSpaceIllustrationLabel(space);
      if (!label) continue;
      const src = getSpaceMiniCardIllustration(label);
      if (src) return src;
    }
  }
  return illustrationFromTitle(taskTitle);
}

function parseJsonArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function parseTaskSpaces(task: Record<string, unknown> | null | undefined): TaskSpaceRef[] {
  return parseJsonArray<TaskSpaceRef>(task?.spaces);
}

function firstUploadedTaskImageUrl(task: Record<string, unknown> | null | undefined): string | null {
  if (!task) return null;
  const images = parseJsonArray<{
    file_type?: string;
    file_name?: string;
    thumbnail_url?: string;
    file_url?: string;
  }>(task.images);

  const firstImage =
    images.find((attachment) => {
      const fileType = String(attachment?.file_type || "").toLowerCase();
      const fileName = String(attachment?.file_name || "").toLowerCase();
      return (
        fileType.startsWith("image/") ||
        /\.(png|jpe?g|webp|gif|heic|heif|bmp|svg)$/.test(fileName)
      );
    }) ?? (images.length > 0 ? images[0] : null);

  return (
    firstImage?.thumbnail_url ||
    firstImage?.file_url ||
    (typeof task.primary_image_url === "string" ? task.primary_image_url : null) ||
    (typeof task.image_url === "string" ? task.image_url : null)
  );
}

function defaultMiniCardIllustration(): string {
  return getSpaceMiniCardIllustration("Office") ?? `${TASK_SPACE_ILLUSTRATION_PATH_PREFIX}office.png`;
}

/** Uploaded task image, else the best-matching space mini-card illustration. */
export function resolveTaskDisplayImageUrl(
  task: Record<string, unknown> | null | undefined,
  taskTitle?: string | null
): string {
  const uploaded = firstUploadedTaskImageUrl(task);
  if (uploaded) return uploaded;

  const title = taskTitle ?? (typeof task?.title === "string" ? task.title : null);
  return getTaskSpaceIllustration(parseTaskSpaces(task), title) ?? defaultMiniCardIllustration();
}

const SIGNAL_KIND_ILLUSTRATION_HINT: Partial<Record<SignalKind, string>> = {
  message: "Living Room",
  email: "Mailroom",
  upload: "Kitchen",
  document: "Archive",
  ai_suggestion: "Office",
  ai_warning: "Plant Room",
  admin: "HR Office",
  conflict: "Meeting Room",
  weather: "Garden",
  system: "Server Room",
};

/** Issues stream rows: uploaded image when present, else mini-card art from copy/signal kind. */
export function resolveAttentionStreamThumbnail(options: {
  imageUrl?: string | null;
  title?: string | null;
  context?: string | null;
  signalKind?: SignalKind;
  spaces?: TaskSpaceRef[] | null;
}): string {
  const uploaded = options.imageUrl?.trim();
  if (uploaded) return uploaded;

  const titleContext = [options.title, options.context].filter(Boolean).join(" ");
  const fromCopy =
    getTaskSpaceIllustration(options.spaces, titleContext) ??
    getTaskSpaceIllustration(null, titleContext);
  if (fromCopy) return fromCopy;

  if (options.signalKind) {
    const hint = SIGNAL_KIND_ILLUSTRATION_HINT[options.signalKind];
    const kindArt = hint ? getSpaceMiniCardIllustration(hint) : undefined;
    if (kindArt) return kindArt;
  }

  return defaultMiniCardIllustration();
}
