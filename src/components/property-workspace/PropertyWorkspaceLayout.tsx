import type { ReactNode } from "react";
import { PageContentTitle } from "@/components/design-system/PageContentTitle";
import {
  WorkbenchCentreSearch,
} from "@/components/workbench/WorkbenchCentreSearch";
import { cn } from "@/lib/utils";

export interface PropertyWorkspaceLayoutProps {
  /** Column 1 — “What exists here?” Context / health / navigation */
  contextColumn: ReactNode;
  /** Column 2 — “What needs attention / what can I work on?” Main surface */
  workColumn: ReactNode;
  /** Column 3 — “What can I add / upload / generate?” Action / AI rail */
  actionColumn: ReactNode;
  className?: string;
  /**
   * Screen H1 — rendered at the top of the left (context) column on desktop,
   * and first on mobile. Omit on Home (Inflow | Tasks | Calendar).
   */
  pageTitle?: string;
  pageSubtitle?: string;
  pageIcon?: ReactNode;
  pageTitleAction?: ReactNode;
  /** Centre-column pressed search. When set, also use {@link hideHeaderSearch} on the page chrome. */
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: (query: string) => void;
  searchAccentColor?: string;
  /**
   * When true (default), render a mobile column stack under `workspace`.
   * Set false when the parent already owns mobile layout (e.g. Settings).
   */
  embedMobileStack?: boolean;
}

/**
 * Shared 3-column shell for property-scoped / activity-area modules
 * (Documents, Assets, Reports, Knowledge, Spaces, …).
 *
 * Aligns with Hub spatial grammar: ~265px context, capped work surface (700px),
 * flexible action rail (≤280px). Below `workspace` (1100px) columns stack:
 * title → search → work → context → action (when {@link embedMobileStack}).
 */
export function PropertyWorkspaceLayout({
  contextColumn,
  workColumn,
  actionColumn,
  className,
  pageTitle,
  pageSubtitle,
  pageIcon,
  pageTitleAction,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchAccentColor,
  embedMobileStack = true,
}: PropertyWorkspaceLayoutProps) {
  const titleBlock = pageTitle ? (
    <PageContentTitle
      title={pageTitle}
      subtitle={pageSubtitle}
      icon={pageIcon}
      action={pageTitleAction}
      className="mb-0 border-b-0 pb-0 workspace:mb-4 workspace:border-b workspace:border-border/15 workspace:pb-4"
    />
  ) : null;

  const searchBlock =
    searchPlaceholder != null ? (
      <WorkbenchCentreSearch
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={onSearchChange}
        onSubmit={onSearchSubmit}
        accentColor={searchAccentColor}
      />
    ) : null;

  const leftColumn = (
    <div className="flex w-full min-w-0 flex-col gap-4">
      {titleBlock}
      {contextColumn}
    </div>
  );

  const centreColumn = (
    <div className="flex w-full min-w-0 flex-col gap-5">
      {searchBlock}
      {workColumn}
    </div>
  );

  return (
    <>
      <div
        className={cn(
          "w-full max-w-full min-w-0 grid-cols-1 gap-6 items-start",
          embedMobileStack
            ? "hidden workspace:grid workspace:grid-cols-[265px_minmax(0,700px)_minmax(0,280px)] workspace:gap-[44px]"
            : "grid workspace:grid-cols-[265px_minmax(0,700px)_minmax(0,280px)] workspace:gap-[44px]",
          className
        )}
      >
        <aside
          className={cn(
            "relative z-[1] flex w-full min-w-0 flex-col px-1",
            "workspace:sticky workspace:top-[calc(var(--header-height)+12px)]"
          )}
        >
          {leftColumn}
        </aside>

        <section className="min-w-0 max-w-[700px] w-full">{centreColumn}</section>

        <aside
          className={cn(
            "min-w-0 space-y-4",
            "workspace:max-h-[calc(100vh-var(--header-height)-48px)] workspace:sticky workspace:top-[calc(var(--header-height)+12px)]",
            "workspace:overflow-y-auto workspace:overflow-x-visible workspace:px-1.5 workspace:pb-3 workspace:pt-0.5"
          )}
        >
          {actionColumn}
        </aside>
      </div>

      {embedMobileStack ? (
        <div className={cn("flex flex-col gap-6 workspace:hidden", className)}>
          {titleBlock}
          {searchBlock}
          {workColumn}
          {contextColumn}
          {actionColumn}
        </div>
      ) : null}
    </>
  );
}
