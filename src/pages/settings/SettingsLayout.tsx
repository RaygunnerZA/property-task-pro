import { Outlet, useLocation, NavLink, Navigate } from "react-router-dom";
import { Settings, Users, CreditCard, Zap, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { StandardPage } from "@/components/design-system/StandardPage";
import {
  SettingsWorkbenchProvider,
  useSettingsWorkbench,
} from "@/contexts/SettingsWorkbenchContext";

interface SettingsNavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresOwner?: boolean;
}

const navItems: SettingsNavItem[] = [
  { label: "General", path: "/settings", icon: Settings },
  { label: "Profile", path: "/settings/profile", icon: UserCircle },
  { label: "Automation & AI", path: "/settings/automation", icon: Zap },
  { label: "Team", path: "/settings/team", icon: Users },
  { label: "Billing", path: "/settings/billing", icon: CreditCard, requiresOwner: true },
];

function SettingsRightColumnPlaceholder() {
  return (
    <div className="rounded-[10px] border border-border/25 bg-card/40 px-4 py-6 text-center shadow-e1">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Add, create, and edit actions for this section use the wider layout on desktop.
      </p>
    </div>
  );
}

function SettingsThreeColumnFrame({ navItemsVisible }: { navItemsVisible: SettingsNavItem[] }) {
  const { rightPanel } = useSettingsWorkbench();
  const hasContextualPanel = rightPanel != null;

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-4 sm:gap-6",
        "lg:grid lg:grid-cols-[minmax(200px,240px)_minmax(0,1fr)_minmax(260px,320px)] lg:items-start lg:gap-6",
        "xl:grid-cols-[240px_minmax(0,1fr)_minmax(280px,360px)]"
      )}
    >
      {/* Left — settings menu (horizontal pills on narrow screens, sidebar on lg+) */}
      <nav
        aria-label="Settings sections"
        className={cn(
          "sticky top-0 z-20 -mx-gutter-page border-b border-border/15 bg-background/90 px-gutter-page py-2 backdrop-blur-md",
          "flex min-w-0 snap-x snap-mandatory flex-row gap-1 overflow-x-auto overscroll-x-contain pb-2 pt-0.5",
          "scrollbar-hz-teal touch-pan-x",
          "lg:static lg:z-0 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
        )}
      >
        {navItemsVisible.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex min-h-[44px] shrink-0 snap-start items-center gap-2 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all",
                  "lg:w-full lg:min-h-0",
                  isActive
                    ? "bg-card text-foreground shadow-e1"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" />
              <span className="whitespace-nowrap">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Middle — selected section */}
      <main className="min-h-[min(50vh,480px)] min-w-0 max-w-full overflow-x-hidden lg:min-h-[50vh]">
        <Outlet />
      </main>

      {/* Right — contextual create / edit (hidden on small screens when empty) */}
      <aside
        className={cn(
          "min-w-0 max-w-full overflow-x-hidden",
          !hasContextualPanel && "hidden lg:block",
          hasContextualPanel && "max-lg:border-t max-lg:border-border/20 max-lg:pt-4",
          "lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:max-h-[calc(100vh-var(--header-height)-3rem)] lg:overflow-y-auto lg:pt-0"
        )}
      >
        {rightPanel ?? <SettingsRightColumnPlaceholder />}
      </aside>
    </div>
  );
}

export function SettingsLayout() {
  const location = useLocation();
  const { isOwner, isLoading: roleLoading } = useCurrentUserRole();

  const visibleNavItems = navItems.filter((item) => !item.requiresOwner || isOwner);

  if (location.pathname === "/settings/billing" && !roleLoading && !isOwner) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <StandardPage
      title="Settings"
      subtitle="Manage your organization"
      icon={<Settings className="h-6 w-6" />}
      maxWidth="full"
      contentClassName="max-w-full overflow-x-hidden py-4 sm:py-6"
      headerClassName="[&_h1]:text-xl [&_h1]:sm:text-2xl"
    >
      <SettingsWorkbenchProvider>
        <SettingsThreeColumnFrame navItemsVisible={visibleNavItems} />
      </SettingsWorkbenchProvider>
    </StandardPage>
  );
}
