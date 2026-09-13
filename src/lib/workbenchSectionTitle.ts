/**
 * Screen / page H1 — Fraunces, one clear step above section titles.
 * Docs §4.3 scale max is `text-2xl` (24px); use this for every primary screen title.
 */
export const workbenchPageTitleClassName =
  "font-display text-2xl font-semibold leading-tight tracking-tight text-foreground text-shadow-neu-pressed [text-wrap:balance]";

/**
 * Section H2 within a screen — subordinate to {@link workbenchPageTitleClassName}.
 * Shared section / subsection headers on mobile and desktop.
 */
export const workbenchSectionTitleClassName =
  "font-display text-xl font-semibold leading-tight tracking-tight text-foreground";

/**
 * Top band shared by left-rail section H1 and centre list tabs
 * (matches WorkbenchSectionHero `py-3` top + label offset).
 */
export const workbenchTitleBandPtClassName = "pt-3";
export const workbenchTitleBandLabelOffsetClassName = "pt-1 sm:pt-1.5";

/** Active centre list tab fill — darker Filla turquoise. */
export const WORKBENCH_CENTRE_TAB_ACTIVE_COLOR = "#5A9499";
/** Inactive centre list tab fill — cool gray (halfway between light and prior darker). */
export const WORKBENCH_CENTRE_TAB_INACTIVE_COLOR = "#AFB5BE";

/** Active centre list tab (All / Urgent / Planner…) — turquoise + deboss. */
export const workbenchCentreTabActiveClassName =
  "font-display text-2xl font-medium leading-tight tracking-tight text-shadow-neu-pressed [text-wrap:balance]";

/** Inactive centre list tab — light cool gray + softer deboss. */
export const workbenchCentreTabInactiveClassName =
  "font-display text-2xl font-light leading-tight tracking-tight text-shadow-neu-pressed";

/** @deprecated Use {@link workbenchCentreTabInactiveClassName} */
export const workbenchSectionTitleInactiveClassName = workbenchCentreTabInactiveClassName;

/** Muted subtitle under workbench section / page headers. */
export const workbenchSectionSubtitleClassName =
  "text-sm leading-snug text-muted-foreground";
