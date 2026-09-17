import { cn } from "@/lib/utils";

/** Typography matches NeomorphicInput: Inter Tight 400, 14px, sentence case. */
export const SPACE_GROUP_ADD_INPUT_CLASS = cn(
  "min-w-0 flex-1 rounded-lg bg-input px-2.5 py-1.5",
  "font-sans font-normal text-sm normal-case tracking-normal text-foreground",
  "placeholder:normal-case placeholder:text-muted-foreground/60",
  "outline-none focus:ring-2 focus:ring-primary/40"
);

export const SPACE_GROUP_ADD_INPUT_SHADOW = {
  boxShadow:
    "inset 2px 2px 4px rgba(0,0,0,0.08), inset -2px -2px 4px rgba(255,255,255,0.7)",
} as const;

/**
 * Pixels a dropdown chip grows on hover (chevron reveal + soft max bump).
 * ChipCloud keeps this free on the right of every row.
 */
export const CHIP_HOVER_EXPAND_PX = 20;

/** Matches Tailwind `gap-x-1.5` / `gap-y-2` used on card chip clouds. */
export const CHIP_CLOUD_GAP_X_PX = 6;
export const CHIP_CLOUD_GAP_Y_PX = 8;

/**
 * @deprecated Prefer {@link ChipCloud} — kept for any leftover className joins.
 * Soft right inset equal to hover-expand reserve.
 */
export const CHIP_CLOUD_EXPAND_BUFFER_CLASS = "pr-5";
