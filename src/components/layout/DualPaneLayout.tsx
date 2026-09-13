import { ReactNode, useEffect } from "react";
import { cn } from "@/lib/utils";
import { touchAllTasksIllustrationUsage } from "@/lib/allTasksIllustration";

interface DualPaneLayoutProps {
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  thirdColumn?: ReactNode;
  /** Spans the full main content width (all workbench columns), excluding the app sidebar. */
  header?: ReactNode;
  /**
   * Home-hub phone (`workbenchLayoutMode`): hide centre below `md` and defer the
   * dual-column grid until `md` so the left rail is full-width without an empty track.
   */
  collapseCentreOnPhone?: boolean;
  /**
   * Work-surface phone: hide left (property card / identity strip) below `md`.
   * Centre (Inflow · Tasks · Calendar) sits full-width under the header.
   */
  collapseLeftOnPhone?: boolean;
  /**
   * Phone: keep both columns visible, stacked vertically, and defer the dual-column
   * grid until `md`. Prefer this over collapsing when home should show scope + work.
   *
   * Note: use mobile-first `hidden md:*` utilities — `max-md:*` variants are not
   * reliably generated in this project's Tailwind build.
   */
  stackOnPhone?: boolean;
  /**
   * Cap the centre column to the viewport height (and stretch to the tallest
   * sibling floor). Inner panes (MagneticScrollArea, TaskPanel) own list scrolling.
   */
  viewportBoundCentre?: boolean;
  /**
   * Nest inside an existing page shell (StandardPage, etc.): no min-h-screen, tighter
   * top padding. Activity-area modules use this via PropertyWorkspaceLayout.
   */
  embedded?: boolean;
}

/**
 * Dual-Pane Command Centre Layout (single React tree; responsive CSS only).
 *
 * Default (desktop / tablet dual):
 * - sm–layout: 330px side rail | centre (max 700px)
 * - layout+ (≥1280px): optional third column; rails flex via workbench-triple minmax
 *   with gutter-rail column-gap so the centre list and detail pane stay separated.
 *   Centre must not use overflow-x-hidden on the grid cell — that couples
 *   overflow-y to `auto` and parks a native scrollbar on the column seam.
 * - `embedded`: same tracks inside StandardPage (PropertyWorkspaceLayout); no min-h-screen.
 *
 * Home-hub phone (`collapseCentreOnPhone`):
 * - < md: left only — centre (Quick Wins / Inflow…) hidden
 * - md+: dual/triple grid
 *
 * Work-surface phone (`collapseLeftOnPhone`):
 * - < md: centre only (property rail hidden) — Inflow | Tasks | Calendar
 * - md+: dual/triple grid
 *
 * Optional (`stackOnPhone`): left above centre on phone (neither column hidden).
 */
export function DualPaneLayout({
  leftColumn,
  rightColumn,
  thirdColumn,
  header,
  collapseCentreOnPhone = false,
  collapseLeftOnPhone = false,
  stackOnPhone = false,
  viewportBoundCentre = false,
  embedded = false,
}: DualPaneLayoutProps) {
  const hasThirdColumn = !!thirdColumn;
  const hasHeader = !!header;

  useEffect(() => {
    // Distinct workbench days drive All-tasks header art rotation.
    touchAllTasksIllustrationUsage();
  }, []);

  /** Defer dual-column grid to `md` whenever phone uses a special column policy. */
  const dualGridFromPhone =
    collapseCentreOnPhone || collapseLeftOnPhone || stackOnPhone;

  const stickyColClass = cn(
    embedded
      ? "sm:sticky sm:top-[calc(var(--header-height,70px)+12px)] sm:self-start sm:h-auto sm:px-0 sm:pl-[12px] sm:pr-[12px]"
      : hasHeader
        ? "sm:sticky sm:top-[var(--header-height)] sm:self-start sm:h-auto sm:px-0 sm:pl-[12px] sm:pr-[12px]"
        : "sm:sticky sm:top-0 sm:self-start sm:h-auto sm:px-0 sm:pl-[12px] sm:pr-[12px]",
    dualGridFromPhone ? "md:w-workbench-side-rail" : "sm:w-workbench-side-rail",
    // Triple grid: fill the track; keep the same 12px rail inset as dual (do not drop to pl-2).
    hasThirdColumn &&
      "layout:w-full layout:min-w-0 layout:max-w-workbench-side-rail layout:pl-[12px] layout:pr-[12px]",
    "[overflow-anchor:none]"
  );

  // Stretch with the tallest grid sibling (usually the left rail). Cap at
  // viewport height so MagneticScrollArea / inner panes can own vertical scroll —
  // min-height alone lets the centre grow with the list and disables scrolling.
  const boundCentreMd = hasHeader
    ? "md:self-stretch md:h-[calc(100dvh-var(--header-height,0px)-20px)] md:max-h-[calc(100dvh-var(--header-height,0px)-20px)] md:min-h-0"
    : "md:self-stretch md:h-[calc(100dvh-20px)] md:max-h-[calc(100dvh-20px)] md:min-h-0";
  const boundCentreSm = hasHeader
    ? "sm:self-stretch sm:h-[calc(100dvh-var(--header-height,0px)-20px)] sm:max-h-[calc(100dvh-var(--header-height,0px)-20px)] sm:min-h-0"
    : "sm:self-stretch sm:h-[calc(100dvh-20px)] sm:max-h-[calc(100dvh-20px)] sm:min-h-0";

  const centreShellClass = cn(
    "min-h-0 min-w-0 w-full max-w-full flex-1 px-1 pb-4",
    // When collapsing centre on phone, avoid a bare `flex` that would override `hidden`.
    // Do not put overflow-y-auto on this grid cell: the native scrollbar sits on the
    // track edge and reads as a thick divider against the third column. Inner panes
    // (CentreWorkbench, TaskPanel) own vertical scroll, inset by this padding.
    collapseCentreOnPhone
      ? cn(
          "hidden md:flex md:min-h-0 md:max-w-[700px] md:flex-col md:px-1 md:pb-4",
          viewportBoundCentre ? boundCentreMd : "md:h-full md:self-stretch"
        )
      : dualGridFromPhone
        ? cn(
            "md:flex md:min-h-0 md:max-w-[700px] md:flex-col md:px-1 md:pb-4",
            viewportBoundCentre ? boundCentreMd : "md:h-full md:self-stretch"
          )
        : cn(
            "sm:flex sm:min-h-0 sm:max-w-[700px] sm:flex-col sm:px-1 sm:pb-4",
            viewportBoundCentre ? boundCentreSm : "sm:h-full sm:self-stretch"
          ),
    // Same horizontal inset whether dual or triple — matches CentreWorkbench md:px-2 stack.
    hasThirdColumn
      ? "layout:min-w-0 layout:max-w-[700px] layout:overflow-x-clip layout:px-2 layout:pb-5"
      : "layout:max-w-none layout:px-2 layout:pb-5",
    /** Phone work-surface: single 15px edge inset (--gutter-page); avoid stacking rail + pane padding. */
    collapseLeftOnPhone && "px-gutter-page pt-0 md:px-1 md:pt-0"
  );

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col",
        embedded ? "min-h-0" : "min-h-screen"
      )}
    >
      {hasHeader && (
        <div className="w-full shrink-0 min-h-[var(--header-height,70px)] lg:min-h-0">
          {header}
        </div>
      )}

      <div
        className={cn(
          "flex min-h-0 w-full min-w-0 flex-1 flex-col",
          embedded ? "pt-0" : "pt-[20px]",
          dualGridFromPhone
            ? [
                "md:grid md:min-h-0 md:grid-cols-workbench-dual",
                hasThirdColumn
                  ? "layout:grid layout:grid-cols-workbench-triple"
                  : "layout:grid layout:grid-cols-workbench-center-max",
              ]
            : [
                "sm:grid sm:min-h-0 sm:grid-cols-workbench-dual",
                hasThirdColumn
                  ? "layout:grid layout:grid-cols-workbench-triple"
                  : "layout:grid layout:grid-cols-workbench-center-max",
              ],
          !embedded && collapseLeftOnPhone && "pt-2 md:pt-[20px]",
          // gap-y only for phone stack: the `gap` shorthand would reset column-gap to 0.
          stackOnPhone && "gap-y-4 md:gap-y-0",
          // Same column gap as Tasks / Calendar / Records (DualPane + workbench-triple).
          dualGridFromPhone ? "md:gap-x-gutter-rail" : "sm:gap-x-gutter-rail"
        )}
      >
        <div
          className={cn(
            "w-full min-w-0 max-w-full shrink-0 flex-col gap-3 px-gutter-rail",
            // `hidden` + `flex` conflict if both are unconditional — pick one display mode.
            collapseLeftOnPhone ? "hidden md:flex" : "flex",
            stickyColClass
          )}
        >
          {leftColumn}
        </div>

        <div className={centreShellClass}>{rightColumn}</div>

        {hasThirdColumn && (
          <div
            data-workbench-third-column
            className={cn(
              "hidden layout:block layout:min-h-0 layout:min-w-0 layout:w-full layout:max-w-workbench-side-rail layout:overflow-x-clip layout:overflow-y-auto layout:self-start layout:px-[12px] layout:[overflow-anchor:none]",
              embedded &&
                "layout:sticky layout:top-[calc(var(--header-height,70px)+12px)] layout:max-h-[calc(100dvh-var(--header-height,70px)-48px)]"
            )}
          >
            {thirdColumn}
          </div>
        )}
      </div>
    </div>
  );
}
