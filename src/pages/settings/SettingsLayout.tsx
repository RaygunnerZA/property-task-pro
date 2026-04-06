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
        Add, create, and edit actions for this section appear here on larger screens.
      </p>
    </div>
  );
}

function SettingsThreeColumnFrame({ navItemsVisible }: { navItemsVisible: SettingsNavItem[] }) {
  const { rightPanel } = useSettingsWorkbench();

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-8",
        "lg:grid lg:grid-cols-[minmax(200px,240px)_minmax(0,1fr)_minmax(260px,320px)] lg:items-start lg:gap-6",
        "xl:grid-cols-[240px_minmax(0,1fr)_minmax(280px,360px)]"
      )}
    >
      {/* Left — settings menu */}
      <nav
        aria-label="Settings sections"
        className="flex min-w-0 flex-row gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
      >
        {navItemsVisible.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-2 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all",
                  "lg:w-full",
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
      <main className="min-h-[50vh] min-w-0">
        <Outlet />
      </main>

      {/* Right — contextual create / edit */}
      <aside
        className={cn(
          "min-w-0 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:max-h-[calc(100vh-var(--header-height)-3rem)] lg:overflow-y-auto lg:pt-0"
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
    >
      <SettingsWorkbenchProvider>
        <SettingsThreeColumnFrame navItemsVisible={visibleNavItems} />
      </SettingsWorkbenchProvider>
    </StandardPage>
  );
}
