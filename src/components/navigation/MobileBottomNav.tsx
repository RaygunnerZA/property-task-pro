import { useState, type ComponentType } from "react";
import { useLocation, Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import {
  MOBILE_NAV_ITEMS,
  MOBILE_MORE_NAV_URL,
  isMobileNavActive,
} from "@/lib/mainNavigation";
import { centreWorkbenchTasksPath } from "@/lib/centreWorkbenchTabs";
import { cn } from "@/lib/utils";
import { paperTexturedColorStyle } from "@/lib/paperTexture";
import { MobileMoreMenuDrawer } from "@/components/navigation/MobileMoreMenuDrawer";
import { CreateActionDrawer } from "@/components/navigation/CreateActionDrawer";

/**
 * Mobile Bottom Navigation
 *
 * Tabs: Home · Tasks · Compliance · More + center FAB
 * Only visible below md (768px) — tablet/desktop use the left icon rail.
 */
export function MobileBottomNav() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const leftItems = MOBILE_NAV_ITEMS.slice(0, 2);
  const rightItems = MOBILE_NAV_ITEMS.slice(2);

  /** Tasks opens the work-surface Tasks tab, keeping current property scope. */
  const tasksHref = centreWorkbenchTasksPath("tasks", searchParams);

  const handleCreateClick = () => {
    setShowCreateDrawer(true);
  };

  const renderNavLink = (to: string, icon: ComponentType<{ className?: string }>, label: string) => {
    const Icon = icon;
    const isMore = to === MOBILE_MORE_NAV_URL;
    const isActive = !isMore && isMobileNavActive(location.pathname, to);
    const href = to === "/tasks" ? tasksHref : to;

    if (isMore) {
      return (
        <button
          key={to}
          type="button"
          onClick={() => setShowMoreMenu(true)}
          className={cn(
            "flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition-all duration-200",
            "hover:scale-105 active:scale-95"
          )}
          aria-label="More"
        >
          <Icon className="h-6 w-6 text-muted-foreground icon-shadow-neu-pressed" />
          <span className="text-2xs font-semibold leading-none tracking-tight text-muted-foreground">
            {label}
          </span>
        </button>
      );
    }

    return (
      <Link
        key={to}
        to={href}
        className={cn(
          "flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-lg py-1 transition-all duration-200",
          "hover:scale-105 active:scale-95",
          to === "/tasks" && "pl-2 pr-5",
          to === "/compliance" && "pl-5 pr-2",
          to !== "/tasks" && to !== "/compliance" && "px-2",
          isActive && "scale-105"
        )}
      >
        <Icon
          className={cn(
            "h-6 w-6 icon-shadow-neu-pressed transition-colors",
            isActive ? "text-ink" : "text-muted-foreground"
          )}
        />
        <span
          className={cn(
            "text-2xs font-semibold leading-none tracking-tight transition-colors",
            isActive ? "text-ink" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
      </Link>
    );
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-[100] h-[72px] md:hidden" aria-label="Main navigation">
        <div className="absolute inset-0 border-t-2 border-white/[0.61] bg-background/90 backdrop-blur-md" />

        <div className="relative mx-auto max-w-md px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          <div className="relative flex items-end justify-between">
            <div className="flex flex-1 justify-around">
              {leftItems.map(({ url, icon, title }) => renderNavLink(url, icon, title))}
            </div>

            <div className="w-[65px] shrink-0" aria-hidden />

            <div className="flex flex-1 justify-around">
              {rightItems.map(({ url, icon, title }) => renderNavLink(url, icon, title))}
            </div>

            <button
              type="button"
              onClick={handleCreateClick}
              className={cn(
                "absolute left-1/2 top-[9px] flex h-[65px] w-[65px] -translate-x-1/2 -translate-y-1/2 items-center justify-center",
                "overflow-hidden rounded-xl paper-textured-color text-primary-foreground shadow-fab-neo",
                "transition-transform hover:scale-105 active:scale-95"
              )}
              style={paperTexturedColorStyle("hsl(var(--primary))")}
              aria-label="Create"
            >
              <Plus className="h-8 w-8 icon-shadow-neu-pressed" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </nav>

      <MobileMoreMenuDrawer open={showMoreMenu} onOpenChange={setShowMoreMenu} />
      <CreateActionDrawer open={showCreateDrawer} onOpenChange={setShowCreateDrawer} />
    </>
  );
}
