/**
 * Shared meta-chip sizing for task cards, task detail, and intake facts.
 * Keep height, type, and radius consistent across the app.
 * Matches SemanticChip default: h-[28px], text-2xs, rounded-card, uppercase mono.
 */
export const META_CHIP_HEIGHT_CLASS = "h-[28px]";
export const META_CHIP_AVATAR_SIZE = 28;

/** Base pill — neomorphic card chip, capitalised mono caption. */
export const META_CHIP_CLASS =
  "inline-flex h-[28px] max-w-full items-center gap-1.5 rounded-card bg-card px-2.5 font-mono text-2xs font-medium uppercase tracking-wide text-foreground shadow-e1";

/** Filled status / priority chips (icon + label on solid fill). */
export const META_CHIP_FILLED_CLASS =
  "inline-flex h-[28px] max-w-full items-center gap-1.5 rounded-card px-2.5 font-mono text-2xs font-medium uppercase tracking-wide shadow-e1";

/** Icon-only property / avatar nest — no outer padding; content snug to edges. */
export const META_CHIP_ICON_ONLY_CLASS =
  "inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center overflow-hidden rounded-card shadow-e1 p-0";

/** Person nest: avatar fills the chip with no outer padding. */
export const META_CHIP_AVATAR_NEST_CLASS =
  "inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center overflow-hidden rounded-card shadow-e1 p-0";
