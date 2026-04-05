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
 * Below `min-[1100px]` columns stack: context → work → action.
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
        "min-[1100px]:grid-cols-[265px_minmax(0,1fr)_minmax(260px,300px)]",
        "min-[1100px]:gap-6",
        className
      )}
    >
      <aside
        className={cn(
          "min-w-0 w-full space-y-4 px-[3px] flex flex-wrap",
          "min-[1100px]:h-[335px] min-[1100px]:max-h-[calc(100vh-var(--header-height)-48px)] min-[1100px]:sticky min-[1100px]:top-[calc(var(--header-height)+12px)]",
          "min-[1100px]:overflow-y-auto"
        )}
      >
        {contextColumn}
      </aside>

      <section className="min-w-0 max-w-[660px] w-full space-y-5">{workColumn}</section>

      <aside
        className={cn(
          "min-w-0 space-y-4",
          "min-[1100px]:max-h-[calc(100vh-var(--header-height)-48px)] min-[1100px]:sticky min-[1100px]:top-[calc(var(--header-height)+12px)]",
          "min-[1100px]:overflow-y-auto"
        )}
      >
        {actionColumn}
      </aside>
    </div>
  );
}
