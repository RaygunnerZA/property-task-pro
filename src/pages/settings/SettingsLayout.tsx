import { Outlet, useLocation, NavLink, Navigate, useNavigate } from "react-router-dom";
import { Settings, Users, CreditCard, Zap, UserCircle, Plug, LogOut, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { StandardPage } from "@/components/design-system/StandardPage";
import {
  SettingsWorkbenchProvider,
  useSettingsWorkbench,
} from "@/contexts/SettingsWorkbenchContext";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

interface SettingsNavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresOwner?: boolean;
  requiresPrimaryOwner?: boolean;
}

const navItems: SettingsNavItem[] = [
  { label: "General", path: "/settings", icon: Settings },
  { label: "Profile", path: "/settings/profile", icon: UserCircle },
  { label: "Automation & AI", path: "/settings/automation", icon: Zap },
  { label: "Integrations", path: "/settings/integrations", icon: Plug },
  { label: "Team", path: "/settings/team", icon: Users },
  { label: "Billing", path: "/settings/billing", icon: CreditCard, requiresPrimaryOwner: true },
  { label: "Trash", path: "/settings/trash", icon: Trash2 },
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
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const hasContextualPanel = rightPanel != null;

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } catch {
      toast.error("Could not sign out. Try again.");
      setSigningOut(false);
    }
  };

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-4 sm:gap-6",
        /* Middle track capped at 700px (like the workbench) so the contextual
           rail sits beside the content instead of the far page edge. */
        "lg:grid lg:grid-cols-[minmax(200px,240px)_minmax(0,700px)_minmax(260px,320px)] lg:items-start lg:gap-6",
        "xl:grid-cols-[240px_minmax(0,700px)_minmax(280px,360px)]"
      )}
    >
      {/* Left — settings menu (horizontal pills on narrow screens, sidebar on lg+) */}
      <nav
        aria-label="Settings sections"
        className={cn(
          "sticky top-0 z-20 -mx-gutter-page border-b border-border/15 bg-background/80 px-gutter-page py-2 backdrop-blur-md",
          "flex min-w-0 snap-x snap-mandatory flex-row gap-1 overflow-x-auto overscroll-x-contain pb-2 pt-0.5",
          "scrollbar-hz-teal touch-pan-x",
          "lg:static lg:z-0 lg:mx-0 lg:flex lg:flex-col lg:gap-1 lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
        )}
      >
        {navItemsVisible.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/settings"}
              className={({ isActive }) =>
                cn(
                  "flex min-h-[44px] shrink-0 snap-start items-center gap-2 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all",
                  "lg:w-full lg:min-h-0",
                  isActive
                    ? "bg-card/60 text-foreground shadow-e1"
                    : "text-muted-foreground hover:bg-card/40 hover:text-foreground"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" />
              <span className="whitespace-nowrap">{item.label}</span>
            </NavLink>
          );
        })}

        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className={cn(
            "flex min-h-[44px] shrink-0 snap-start items-center gap-2 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all",
            "text-destructive hover:bg-destructive/10",
            "lg:mt-auto lg:w-full lg:min-h-0 lg:border-t lg:border-border/20 lg:pt-3",
            signingOut && "opacity-60"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">{signingOut ? "Signing out…" : "Log out"}</span>
        </button>
      </nav>

      {/* Middle — selected section (no min-h: avoids empty textured “glitch” panels) */}
      <main className="min-w-0 max-w-full overflow-x-hidden">
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
  const { isOwner, isPrimaryOwner, isLoading: roleLoading } = useCurrentUserRole();

  const visibleNavItems = navItems.filter((item) => {
    if (item.requiresPrimaryOwner) return isPrimaryOwner;
    if (item.requiresOwner) return isOwner;
    return true;
  });

  if (
    location.pathname === "/settings/billing" &&
    !roleLoading &&
    !isPrimaryOwner
  ) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <StandardPage
      title="Settings"
      subtitle="Manage your organization"
      icon={<Settings className="h-6 w-6" />}
      maxWidth="full"
      contentClassName="max-w-full overflow-x-hidden py-4 sm:py-6"
    >
      <SettingsWorkbenchProvider>
        <SettingsThreeColumnFrame navItemsVisible={visibleNavItems} />
      </SettingsWorkbenchProvider>
    </StandardPage>
  );
}
