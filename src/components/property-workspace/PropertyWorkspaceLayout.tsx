import type { ReactNode } from "react";
import { PageContentTitle } from "@/components/design-system/PageContentTitle";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { WorkbenchCentreSearch } from "@/components/workbench/WorkbenchCentreSearch";
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
  /** Large paper-craft art beside the title (preferred over pageIcon). */
  pageIllustrationSrc?: string;
  pageTitleAction?: ReactNode;
  /** Centre-column pressed search. When set, also use {@link hideHeaderSearch} on the page chrome. */
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: (query: string) => void;
  searchAccentColor?: string;
  /**
   * When true (default), render a phone column stack below `md` and DualPane from `md+`.
   * Set false when the parent already owns mobile layout (e.g. Settings).
   */
  embedMobileStack?: boolean;
}

/**
 * Activity-area shell — thin DualPane wrapper (330 | 700 | 330 @ layout 1280).
 * Title / illustration sit in the left rail; centre search sits above the work column.
 */
export function PropertyWorkspaceLayout({
  contextColumn,
  workColumn,
  actionColumn,
  className,
  pageTitle,
  pageSubtitle,
  pageIcon,
  pageIllustrationSrc,
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
      icon={pageIllustrationSrc ? undefined : pageIcon}
      illustrationSrc={pageIllustrationSrc}
      action={pageTitleAction}
      className="mb-0"
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

  // Match WorkspaceContextColumn / CentreWorkbench insets so Assets · Spaces · People
  // sit on the same column padding as Tasks · Calendar · Records.
  const leftColumn = (
    <div className="flex w-full min-w-0 flex-col gap-4 px-1">
      {titleBlock}
      {contextColumn}
    </div>
  );

  const centreColumn = (
    <div className="flex w-full min-w-0 flex-col gap-5 md:px-2">
      {searchBlock}
      {workColumn}
    </div>
  );

  const desktop = (
    <DualPaneLayout
      embedded
      leftColumn={leftColumn}
      rightColumn={centreColumn}
      thirdColumn={actionColumn}
    />
  );

  if (!embedMobileStack) {
    return <div className={cn("w-full min-w-0", className)}>{desktop}</div>;
  }

  return (
    <>
      <div className={cn("hidden w-full min-w-0 md:block", className)}>{desktop}</div>
      {/* Phone: DualPane hidden — single 15px page inset (--gutter-page); header / bottom nav stay full-bleed. */}
      <div className={cn("flex flex-col gap-6 px-gutter-page md:hidden", className)}>
        {titleBlock}
        {searchBlock}
        {workColumn}
        {contextColumn}
        {actionColumn}
      </div>
    </>
  );
}
