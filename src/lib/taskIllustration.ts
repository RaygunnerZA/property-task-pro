import { resolveToCanonicalSpaceType } from "@/config/spaceTypeAliases";
import { getSpaceMiniCardIllustration } from "@/lib/spaceTypeIllustrations";

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
  { pattern: /\b(kitchen|cooker|oven|dishwasher)\b/i, spaceType: "Kitchen" },
  { pattern: /\b(bathroom|toilet|wc|shower)\b/i, spaceType: "Bathroom" },
  { pattern: /\b(parking|car park|garage)\b/i, spaceType: "Car Park" },
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
