/**
 * Shared responsive layout class strings for modals, sheets, and workbench columns.
 * Mobile-first: cap width to viewport minus gutter; expand at `sm+` where noted.
 */

/** Centered dialog — default cap (32rem) never exceeds viewport. */
export const dialogContentClass =
  "w-full min-w-0 max-w-[min(32rem,calc(100vw-2rem))]";

/** Mobile (< lg): top of screen, horizontally centered. */
export const mobileTopModalShellClass =
  "max-lg:top-4 max-lg:translate-y-0 max-lg:rounded-xl max-lg:max-h-[calc(100dvh-2rem)]";

/** Scrollable modal shell — header/footer stay fixed; body scrolls. Pair with `modalScrollBodyClass`. */
export const modalScrollShellClass =
  "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0";

/** Scrollable region inside a modal shell. */
export const modalScrollBodyClass =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain px-6";

/** Pinned modal header when using `modalScrollShellClass`. */
export const modalScrollHeaderClass = "shrink-0 px-6 pt-6 pb-2";

/** Pinned modal footer when using `modalScrollShellClass`. */
export const modalScrollFooterClass =
  "shrink-0 border-t border-border/40 px-6 pb-6 pt-4";

/** Desktop (lg+): vertically centered dialog. */
export const desktopCenterModalShellClass =
  "lg:top-1/2 lg:-translate-y-1/2 lg:rounded-lg";

/** Shared modal close control — top-right X. */
export const modalCloseButtonClass =
  "absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-foreground opacity-70 ring-offset-background transition-opacity hover:bg-muted/60 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none";

/** Base horizontal centering for modal shells. */
export const modalHorizontalCenterClass = "left-1/2 -translate-x-1/2";

/** Wide centered dialog (viewers, rich detail). */
export const dialogContentWideClass =
  "w-full min-w-0 max-w-[min(56rem,calc(100vw-2rem))]";

/** Extra-wide centered dialog. */
export const dialogContentXWideClass =
  "w-full min-w-0 max-w-[min(72rem,calc(100vw-2rem))]";

/** Asset detail and similar (~960px cap). */
export const dialogContent960Class =
  "w-full min-w-0 max-w-[min(960px,calc(100vw-2rem))]";

/** Dimmed backdrop behind centered detail sheets. */
export const slideOverBackdropClass = "modal-scrim fixed inset-0 z-40";

/**
 * Full-viewport flex host that truly centers the sheet.
 * Prefer this over `top-1/2 -translate-y-1/2` (translate often fails to apply / gets overridden).
 */
export const slideOverCenterHostClass =
  "fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none";

/** Centered detail sheet card (pair with {@link slideOverCenterHostClass}). */
export const slideOverPanelClass =
  "pointer-events-auto flex min-h-0 min-w-0 w-full max-w-[min(32rem,calc(100vw-2rem))] max-h-[min(90dvh,calc(100dvh-2rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl";

/** Wider centered detail sheet card. */
export const slideOverPanelWideClass =
  "pointer-events-auto flex min-h-0 min-w-0 w-full max-w-[min(36rem,calc(100vw-2rem))] max-h-[min(90dvh,calc(100dvh-2rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl";

/** Workbench / property column shell — prevents flex/grid overflow on narrow viewports. */
export const columnShellClass = "flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col";

/** Side sheet content override when a fixed desktop width is needed. */
export const sideSheetDesktopWidthClass =
  "w-full max-w-full min-w-0 sm:w-[420px] sm:max-w-[480px]";
