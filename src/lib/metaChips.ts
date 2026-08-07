/**
 * Shared meta-chip sizing for task cards, task detail, and intake facts.
 * Keep height, type, and radius consistent across the app.
 * Matches SemanticChip default: h-[28px], text-2xs, rounded-card, uppercase mono.
 */
export const META_CHIP_HEIGHT_CLASS = "h-[28px]";
export const META_CHIP_AVATAR_SIZE = 28;

/** Shared geometry — fixed height, mono caption, no line-box drift. */
const META_CHIP_GEOMETRY =
  "inline-flex h-[28px] max-w-full shrink-0 items-center justify-center gap-1.5 box-border rounded-card px-2.5 font-mono text-2xs font-medium uppercase leading-none tracking-wide whitespace-nowrap shadow-e1";

/** Base pill — neomorphic card chip, capitalised mono caption. */
export const META_CHIP_CLASS = `${META_CHIP_GEOMETRY} bg-card text-foreground`;

/** Filled status / priority chips (icon + label on solid fill). */
export const META_CHIP_FILLED_CLASS = META_CHIP_GEOMETRY;

/** Icon-only property / avatar nest — no outer padding; content snug to edges. */
export const META_CHIP_ICON_ONLY_CLASS =
  "inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center overflow-hidden rounded-card shadow-e1 p-0 box-border";

/** Person nest: avatar fills the chip with no outer padding. */
export const META_CHIP_AVATAR_NEST_CLASS =
  "inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center overflow-hidden rounded-card shadow-e1 p-0 box-border";
