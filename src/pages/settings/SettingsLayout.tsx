import { Outlet, useLocation, NavLink, Navigate, useNavigate } from "react-router-dom";
import { Settings, Users, CreditCard, Zap, UserCircle, Plug, LogOut, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { StandardPage } from "@/components/design-system/StandardPage";
import {
  SettingsWorkbenchProvider,
  useSettingsWorkbench,
} from "@/contexts/SettingsWorkbenchContext";
import { PropertyWorkspaceLayout } from "@/components/property-workspace";
import { supabase } from "@/integrations/supabase/client";
import { useState, type ReactNode } from "react";
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
      <p className="text-xs leading-relaxed text-muted-foreground">
        Add, create, and edit actions for this section use the wider layout on desktop.
      </p>
    </div>
  );
}

function SettingsNavLinks({
  items,
  orientation,
  footer,
}: {
  items: SettingsNavItem[];
  orientation: "horizontal" | "vertical";
  footer?: ReactNode;
}) {
  const horizontal = orientation === "horizontal";
  return (
    <nav
      aria-label="Settings sections"
      className={cn(
        horizontal
          ? cn(
              "sticky top-0 z-20 -mx-gutter-page border-b border-border/15 bg-background/80 px-gutter-page py-2 backdrop-blur-md",
              "flex min-w-0 snap-x snap-mandatory flex-row gap-1 overflow-x-auto overscroll-x-contain pb-2 pt-0.5",
              "scrollbar-hz-teal touch-pan-x"
            )
          : "flex w-full flex-col gap-1"
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/settings"}
            className={({ isActive }) =>
              cn(
                "flex min-h-[44px] shrink-0 snap-start items-center gap-2 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all",
                !horizontal && "w-full min-h-0",
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
      {footer}
    </nav>
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

  const signOutButton = (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      disabled={signingOut}
      className={cn(
        "flex min-h-[44px] shrink-0 snap-start items-center gap-2 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all",
        "text-destructive hover:bg-destructive/10",
        "workspace:mt-auto workspace:w-full workspace:min-h-0 workspace:border-t workspace:border-border/20 workspace:pt-3",
        signingOut && "opacity-60"
      )}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      <span className="whitespace-nowrap">{signingOut ? "Signing out…" : "Log out"}</span>
    </button>
  );

  const contextColumn = (
    <div className="flex h-full min-h-0 flex-col gap-1">
      <SettingsNavLinks
        items={navItemsVisible}
        orientation="vertical"
        footer={signOutButton}
      />
    </div>
  );

  const workColumn = (
    <main className="min-w-0 max-w-full overflow-x-hidden">
      <Outlet />
    </main>
  );

  const actionColumn = (
    <aside className="min-w-0 max-w-full overflow-x-hidden">
      {rightPanel ?? <SettingsRightColumnPlaceholder />}
    </aside>
  );

  return (
    <>
      <div className="mb-4 workspace:hidden">
        <SettingsNavLinks
          items={navItemsVisible}
          orientation="horizontal"
          footer={signOutButton}
        />
      </div>

      <div className="hidden workspace:block">
        <PropertyWorkspaceLayout
          contextColumn={contextColumn}
          workColumn={workColumn}
          actionColumn={actionColumn}
        />
      </div>

      <div className="flex flex-col gap-6 workspace:hidden">
        {workColumn}
        {hasContextualPanel ? actionColumn : null}
      </div>
    </>
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
      contentClassName="max-w-[1480px] overflow-x-hidden py-4 sm:py-6"
    >
      <SettingsWorkbenchProvider>
        <SettingsThreeColumnFrame navItemsVisible={visibleNavItems} />
      </SettingsWorkbenchProvider>
    </StandardPage>
  );
}
