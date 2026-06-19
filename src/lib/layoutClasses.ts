/**
 * Shared responsive layout class strings for modals, sheets, and workbench columns.
 * Mobile-first: cap width to viewport minus gutter; expand at `sm+` where noted.
 */

/** Centered dialog — default cap (32rem) never exceeds viewport. */
export const dialogContentClass =
  "w-full min-w-0 max-w-[min(32rem,calc(100vw-2rem))]";

/** Wide centered dialog (viewers, rich detail). */
export const dialogContentWideClass =
  "w-full min-w-0 max-w-[min(56rem,calc(100vw-2rem))]";

/** Extra-wide centered dialog. */
export const dialogContentXWideClass =
  "w-full min-w-0 max-w-[min(72rem,calc(100vw-2rem))]";

/** Asset detail and similar (~960px cap). */
export const dialogContent960Class =
  "w-full min-w-0 max-w-[min(960px,calc(100vw-2rem))]";

/** Right slide-over detail panel (task/message/signal modals on narrow layouts). */
export const slideOverPanelClass =
  "fixed right-0 top-0 z-50 flex h-full w-full min-w-0 max-w-full flex-col bg-card shadow-2xl md:w-[min(100%,480px)]";

/** Wider slide-over (inbox / message detail). */
export const slideOverPanelWideClass =
  "fixed right-0 top-0 z-50 flex h-full w-full min-w-0 max-w-full flex-col bg-card shadow-2xl md:w-[min(100%,600px)]";

/** Workbench / property column shell — prevents flex/grid overflow on narrow viewports. */
export const columnShellClass = "flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col";

/** Side sheet content override when a fixed desktop width is needed. */
export const sideSheetDesktopWidthClass =
  "w-full max-w-full min-w-0 sm:w-[420px] sm:max-w-[480px]";
