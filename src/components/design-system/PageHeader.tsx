import { ReactNode, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDevBuild } from "@/context/DevModeContext";
import { HeaderAccountMenu } from "@/components/layout/HeaderAccountMenu";

const DevToolsDropdown = lazy(() => import("@/components/dev/DevToolsDropdown"));

/**
 * Gradient / page headers: user management + dev tools + account on the header strip (not a separate app bar).
 */
function PageHeaderToolbar({
  className,
  surface = "gradient",
}: {
  className?: string;
  surface?: "gradient" | "plain";
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
      <Link
        to="/manage/people"
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors shrink-0",
          onGradient
            ? "text-white/95 hover:bg-white/15"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Users className="h-4 w-4 shrink-0 opacity-90" />
        <span className="hidden sm:inline">User management</span>
      </Link>
      <HeaderAccountMenu variant={onGradient ? "onGradient" : "default"} />
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
}

export function PageHeader({
  children,
  className,
  toolbarClassName,
  toolbarSurface = "gradient",
}: PageHeaderProps) {
  return (
    <header className={cn("page-header relative pl-space-sm", className)}>
      <PageHeaderToolbar className={toolbarClassName} surface={toolbarSurface} />
      {children}
    </header>
  );
}
