import { resolveToCanonicalSpaceType } from "@/config/spaceTypeAliases";
import {
  getSpaceIllustrationFromCopy,
  getSpaceMiniCardIllustration,
} from "@/lib/spaceTypeIllustrations";
import { isSignatureEvidenceAttachment } from "@/lib/isSignatureEvidenceAttachment";
import type { SignalKind } from "@/types/workbenchSignals";

/** Path prefix for default task thumbnails sourced from space mini-card art. */
export const TASK_SPACE_ILLUSTRATION_PATH_PREFIX = "/spaces/mini-cards/";

export function isTaskSpaceIllustrationUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.includes(TASK_SPACE_ILLUSTRATION_PATH_PREFIX);
}

export type TaskSpaceRef = {
  name?: string | null;
  type?: string | null;
  /** Canonical space type label when available (e.g. space_types.name). */
  spaceTypeName?: string | null;
};

/** Strip leading articles so "The Boiler Room" resolves like "Boiler Room". */
function normalizeSpaceLabel(input: string): string {
  const label = input.trim();
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
 * Operational title keywords that are not space names.
 * Space-word matching (gate, kitchen, loft…) lives in getSpaceIllustrationFromCopy.
 */
const TASK_TITLE_SPACE_HINTS: ReadonlyArray<{ pattern: RegExp; spaceType: string }> = [
  { pattern: /\b(floor.?plan|blueprint|site.?plan)\b/i, spaceType: "Building Exterior" },
  { pattern: /\b(boiler|temperature|thermostat|heating)\b/i, spaceType: "Boiler Room" },
  { pattern: /\b(cooker|oven|dishwasher|sink)\b/i, spaceType: "Kitchen" },
  { pattern: /\b(mould|mold|damp)\b/i, spaceType: "Bathroom" },
  { pattern: /\b(leak|plumb|pipe|drain)\b/i, spaceType: "Plant Room" },
  { pattern: /\b(light|lighting|bulb|fuse)\b/i, spaceType: "Electrical Room" },
  { pattern: /\b(door|doorbell|lock|keys?)\b/i, spaceType: "Entrance" },
  { pattern: /\b(window|glazing)\b/i, spaceType: "Building Exterior" },
  { pattern: /\b(building|buildings)\b/i, spaceType: "Building Exterior" },
  { pattern: /\b(fence)\b/i, spaceType: "Exterior Gate" },
  { pattern: /\b(gutter|chimney)\b/i, spaceType: "Roof" },
  { pattern: /\b(alarm|smoke|detector)\b/i, spaceType: "Fire Alarm Panel" },
  { pattern: /\b(wifi|network|cctv|camera|rack)\b/i, spaceType: "Server Room" },
  { pattern: /\b(datacentre|datacenter)\b/i, spaceType: "Server Room" },
  { pattern: /\b(asset|assets|equipment|appliance|machinery)\b/i, spaceType: "Workshop" },
  { pattern: /\b(clean|cleaning|cleaner)\b/i, spaceType: "Cupboard" },
  { pattern: /\b(paint|painting|decorat)/i, spaceType: "Creative Studio" },
  { pattern: /\b(pump)\b/i, spaceType: "Garden" },
  { pattern: /\b(compliance|document|record|upload|file|pdf)\b/i, spaceType: "Archive" },
];

/**
 * Generic scenes for unmatched tasks — visually distinct, not office.png.
 * Stable per seed so the same task does not flicker between renders.
 */
export const GENERIC_TASK_ILLUSTRATION_POOL = [
  `${TASK_SPACE_ILLUSTRATION_PATH_PREFIX}lobby.png`,
  `${TASK_SPACE_ILLUSTRATION_PATH_PREFIX}workshop.png`,
  `${TASK_SPACE_ILLUSTRATION_PATH_PREFIX}building-exterior.png`,
  `${TASK_SPACE_ILLUSTRATION_PATH_PREFIX}meeting-room.png`,
  `${TASK_SPACE_ILLUSTRATION_PATH_PREFIX}breakout-area.png`,
  `${TASK_SPACE_ILLUSTRATION_PATH_PREFIX}archive-room.png`,
  `${TASK_SPACE_ILLUSTRATION_PATH_PREFIX}entrance.png`,
  `${TASK_SPACE_ILLUSTRATION_PATH_PREFIX}creative-studio.png`,
  `${TASK_SPACE_ILLUSTRATION_PATH_PREFIX}reception.png`,
  `${TASK_SPACE_ILLUSTRATION_PATH_PREFIX}staircase.png`,
  `${TASK_SPACE_ILLUSTRATION_PATH_PREFIX}lounge.png`,
  `${TASK_SPACE_ILLUSTRATION_PATH_PREFIX}loading-bay.png`,
] as const;

function hashSeedIndex(seed: string, modulo: number): number {
  if (modulo <= 0) return 0;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % modulo;
}

export function pickGenericTaskIllustration(seed: string | null | undefined): string {
  const key = seed?.trim() || "task";
  return GENERIC_TASK_ILLUSTRATION_POOL[hashSeedIndex(key, GENERIC_TASK_ILLUSTRATION_POOL.length)];
}

function illustrationFromTitle(taskTitle: string | null | undefined): string | undefined {
  const title = taskTitle?.trim();
  if (!title) return undefined;
  for (const { pattern, spaceType } of TASK_TITLE_SPACE_HINTS) {
    if (!pattern.test(title)) continue;
    const src = getSpaceMiniCardIllustration(spaceType);
    if (src) return src;
  }
  return getSpaceIllustrationFromCopy(title);
}

/**
 * Mini-card illustration for tasks without uploaded images.
 * Prefers linked space context; then title/copy hints; no generic default here.
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

  const pickRealUpload = (url: string | null | undefined): string | null => {
    if (!url || isTaskSpaceIllustrationUrl(url)) return null;
    return url;
  };

  const firstImage =
    images.find((attachment) => {
      if (isSignatureEvidenceAttachment(attachment)) return false;
      const candidate =
        pickRealUpload(attachment?.thumbnail_url) || pickRealUpload(attachment?.file_url);
      if (!candidate) return false;
      const fileType = String(attachment?.file_type || "").toLowerCase();
      const fileName = String(attachment?.file_name || "").toLowerCase();
      if (
        fileType.startsWith("image/") ||
        /\.(png|jpe?g|webp|gif|heic|heif|bmp|svg)$/.test(fileName)
      ) {
        return true;
      }
      // tasks_view / legacy rows may only expose file_url
      return !fileType;
    }) ?? null;

  return (
    pickRealUpload(firstImage?.thumbnail_url) ||
    pickRealUpload(firstImage?.file_url) ||
    pickRealUpload(
      typeof task.primary_image_url === "string" ? task.primary_image_url : null
    ) ||
    pickRealUpload(typeof task.image_url === "string" ? task.image_url : null)
  );
}

function taskIllustrationSeed(
  task: Record<string, unknown> | null | undefined,
  title: string | null | undefined
): string {
  const id = task?.id;
  if (typeof id === "string" && id.trim()) return id.trim();
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return title?.trim() || "task";
}

/** Uploaded task image, else the best-matching space mini-card illustration. */
export function resolveTaskDisplayImageUrl(
  task: Record<string, unknown> | null | undefined,
  taskTitle?: string | null
): string {
  const uploaded = firstUploadedTaskImageUrl(task);
  if (uploaded) return uploaded;

  const title = taskTitle ?? (typeof task?.title === "string" ? task.title : null);
  return (
    getTaskSpaceIllustration(parseTaskSpaces(task), title) ??
    pickGenericTaskIllustration(taskIllustrationSeed(task, title))
  );
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
  seed?: string | null;
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

  return pickGenericTaskIllustration(
    options.seed?.trim() || titleContext || options.signalKind || "signal"
  );
}
