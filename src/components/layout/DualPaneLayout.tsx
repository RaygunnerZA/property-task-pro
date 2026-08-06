import { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
}

/**
 * Dual-Pane Command Centre Layout (single React tree; responsive CSS only).
 *
 * Default (desktop / tablet dual):
 * - sm–layout: 330px side rail | centre (max 700px)
 * - layout+ (≥1280px): optional third column; rails flex via workbench-triple minmax
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
}: DualPaneLayoutProps) {
  const hasThirdColumn = !!thirdColumn;
  const hasHeader = !!header;

  /** Defer dual-column grid to `md` whenever phone uses a special column policy. */
  const dualGridFromPhone =
    collapseCentreOnPhone || collapseLeftOnPhone || stackOnPhone;

  const stickyColClass = cn(
    hasHeader
      ? "sm:sticky sm:top-[var(--header-height)] sm:self-start sm:h-auto sm:px-0 sm:pl-[12px] sm:pr-[12px]"
      : "sm:sticky sm:top-0 sm:self-start sm:h-auto sm:px-0 sm:pl-[12px] sm:pr-[12px]",
    dualGridFromPhone ? "md:w-workbench-side-rail" : "sm:w-workbench-side-rail",
    // Triple grid: fill the track and allow compression below the 330px preferred rail.
    hasThirdColumn &&
      "layout:w-full layout:min-w-0 layout:max-w-workbench-side-rail layout:pl-2 layout:pr-2"
  );

  const centreShellClass = cn(
    "min-h-0 min-w-0 w-full max-w-full flex-1 px-1 pb-4",
    // When collapsing centre on phone, avoid a bare `flex` that would override `hidden`.
    collapseCentreOnPhone
      ? "hidden md:flex md:h-full md:max-w-[700px] md:flex-col md:overflow-y-auto md:px-1 md:pb-4"
      : dualGridFromPhone
        ? "md:flex md:h-full md:max-w-[700px] md:flex-col md:overflow-y-auto md:px-1 md:pb-4"
        : "sm:flex sm:h-full sm:max-w-[700px] sm:flex-col sm:overflow-y-auto sm:px-1 sm:pb-4",
    hasThirdColumn
      ? "layout:min-w-0 layout:max-w-[700px] layout:overflow-y-auto layout:px-1 layout:pb-5"
      : "layout:max-w-none layout:overflow-y-auto layout:px-1 layout:pb-5",
    /** Phone work-surface: centre is the only column — no leftover left-rail gutter. */
    collapseLeftOnPhone && "px-gutter-rail pt-0 md:px-1 md:pt-0"
  );

  return (
    <div className="flex min-h-screen w-full min-w-0 flex-col">
      {hasHeader && (
        <div className="w-full shrink-0 min-h-[var(--header-height,70px)] lg:min-h-0">
          {header}
        </div>
      )}

      <div
        className={cn(
          "flex min-h-0 w-full min-w-0 flex-1 flex-col pt-[14px]",
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
          collapseLeftOnPhone && "pt-2 md:pt-[14px]",
          stackOnPhone && "gap-4 md:gap-0"
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
            className="hidden layout:block layout:min-h-0 layout:min-w-0 layout:w-full layout:max-w-workbench-side-rail layout:overflow-x-hidden layout:overflow-y-auto layout:self-start layout:[overflow-anchor:none]"
          >
            {thirdColumn}
          </div>
        )}
      </div>
    </div>
  );
}
