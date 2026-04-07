import { ReactNode, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { isDevBuild } from "@/context/DevModeContext";
import { HeaderAccountMenu } from "@/components/layout/HeaderAccountMenu";

const DevToolsDropdown = lazy(() => import("@/components/dev/DevToolsDropdown"));

/**
 * Gradient / page headers: dev tools + account on the header strip (not a separate app bar).
 */
function PageHeaderToolbar({
  className,
  surface = "gradient",
  showAccountMenu = true,
}: {
  className?: string;
  surface?: "gradient" | "plain";
  /** When false, account avatar is not shown in the header (e.g. hub uses workbench row + sidebar). */
  showAccountMenu?: boolean;
}) {
  const onGradient = surface === "gradient";
  return (
    <div
      className={cn(
        "pointer-events-auto absolute right-3 top-1/2 z-50 flex -translate-y-1/2 items-center gap-2 sm:right-4 sm:gap-3",
        className
      )}
    >
      {isDevBuild && (
        <Suspense fallback={null}>
          <DevToolsDropdown />
        </Suspense>
      )}
      {showAccountMenu && (
        <div className="lg:hidden">
          <HeaderAccountMenu variant={onGradient ? "onGradient" : "default"} />
        </div>
      )}
    </div>
  );
}

interface PageHeaderProps {
  children: ReactNode;
  className?: string;
  /** Extra classes for the absolute toolbar (e.g. vertical alignment tweaks). */
  toolbarClassName?: string;
  /** Controls contrast for toolbar controls (gradient strip vs neutral header). */
  toolbarSurface?: "gradient" | "plain";
  /** Omit on hub so account opens from the workbench row; desktop never shows header account (sidebar + settings). */
  showAccountMenu?: boolean;
}

export function PageHeader({
  children,
  className,
  toolbarClassName,
  toolbarSurface = "gradient",
  showAccountMenu = true,
}: PageHeaderProps) {
  return (
    <header className={cn("page-header relative pl-space-sm", className)}>
      <PageHeaderToolbar
        className={toolbarClassName}
        surface={toolbarSurface}
        showAccountMenu={showAccountMenu}
      />
      {children}
    </header>
  );
}
