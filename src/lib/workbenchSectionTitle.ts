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

/** Inactive title in a workbench H1 tab strip — same size as page H1, muted. */
export const workbenchSectionTitleInactiveClassName =
  "font-display text-2xl font-normal leading-tight tracking-tight text-muted-foreground/50 hover:text-muted-foreground";

/** Muted subtitle under workbench section / page headers. */
export const workbenchSectionSubtitleClassName =
  "text-sm leading-snug text-muted-foreground";
