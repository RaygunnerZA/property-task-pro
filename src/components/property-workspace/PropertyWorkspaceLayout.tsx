import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PropertyWorkspaceLayoutProps {
  /** Column 1 — “What exists here?” Context / health / navigation */
  contextColumn: ReactNode;
  /** Column 2 — “What needs attention / what can I work on?” Main surface */
  workColumn: ReactNode;
  /** Column 3 — “What can I add / upload / generate?” Action / AI rail */
  actionColumn: ReactNode;
  className?: string;
}

/**
 * Shared 3-column shell for property-scoped modules (Documents, Assets, Compliance, Spaces).
 * Aligns with Hub spatial grammar: ~265px context, capped work surface (660px), fixed action rail.
 * Below `workspace` (1100px) columns stack: context → work → action.
 */
export function PropertyWorkspaceLayout({
  contextColumn,
  workColumn,
  actionColumn,
  className,
}: PropertyWorkspaceLayoutProps) {
  return (
    <div
      className={cn(
        "grid w-full max-w-full min-w-0 grid-cols-1 gap-5 items-start",
        "workspace:grid-cols-[265px_minmax(0,1fr)_minmax(260px,300px)]",
        "workspace:gap-6",
        className
      )}
    >
      <aside
        className={cn(
          "min-w-0 w-full space-y-4 px-[3px] flex flex-wrap",
          "workspace:h-[335px] workspace:max-h-[calc(100vh-var(--header-height)-48px)] workspace:sticky workspace:top-[calc(var(--header-height)+12px)]",
          "workspace:overflow-y-auto"
        )}
      >
        {contextColumn}
      </aside>

      <section className="min-w-0 max-w-[660px] w-full space-y-5">{workColumn}</section>

      <aside
        className={cn(
          "min-w-0 space-y-4",
          "workspace:max-h-[calc(100vh-var(--header-height)-48px)] workspace:sticky workspace:top-[calc(var(--header-height)+12px)]",
          "workspace:overflow-y-auto"
        )}
      >
        {actionColumn}
      </aside>
    </div>
  );
}
