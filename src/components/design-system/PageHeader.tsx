import { ReactNode, lazy, Suspense, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { isDevBuild } from "@/context/DevModeContext";
import { HeaderAccountMenu } from "@/components/layout/HeaderAccountMenu";
import { MobileHeaderSearchButton } from "@/components/layout/MobileHeaderSearchButton";

const DevToolsDropdown = lazy(() => import("@/components/dev/DevToolsDropdown"));

/**
 * Gradient / page headers: dev tools + account on the header strip (not a separate app bar).
 */
function PageHeaderToolbar({
  className,
  surface = "gradient",
  showAccountMenu = true,
  showSearch = false,
  mobileSearchSlot,
}: {
  className?: string;
  surface?: "gradient" | "plain";
  /** When false, account avatar is not shown in the header (e.g. hub uses workbench row + sidebar). */
  showAccountMenu?: boolean;
  showSearch?: boolean;
  mobileSearchSlot?: ReactNode;
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
      {showSearch && (
        <div className="lg:hidden">
          {mobileSearchSlot ?? (
            <MobileHeaderSearchButton variant={onGradient ? "onGradient" : "default"} />
          )}
        </div>
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
  style?: CSSProperties;
  /** Extra classes for the absolute toolbar (e.g. vertical alignment tweaks). */
  toolbarClassName?: string;
  /** Controls contrast for toolbar controls (gradient strip vs neutral header). */
  toolbarSurface?: "gradient" | "plain";
  /** Omit on hub so account opens from the workbench row; desktop never shows header account (sidebar + settings). */
  showAccountMenu?: boolean;
  /** Mobile search icon in the header toolbar. */
  showSearch?: boolean;
  /** Replaces the default mobile search button (e.g. inline workbench search). */
  mobileSearchSlot?: ReactNode;
}

export function PageHeader({
  children,
  className,
  style,
  toolbarClassName,
  toolbarSurface = "gradient",
  showAccountMenu = true,
  showSearch = false,
  mobileSearchSlot,
}: PageHeaderProps) {
  return (
    <header className={cn("page-header relative pl-space-sm", className)} style={style}>
      <PageHeaderToolbar
        className={toolbarClassName}
        surface={toolbarSurface}
        showAccountMenu={showAccountMenu}
        showSearch={showSearch}
        mobileSearchSlot={mobileSearchSlot}
      />
      {children}
    </header>
  );
}
