import { ReactNode } from "react";
import { Outlet, useLocation, NavLink, Navigate } from "react-router-dom";
import { Settings, Users, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { StandardPage } from "@/components/design-system/StandardPage";

interface SettingsNavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresOwner?: boolean;
}

const navItems: SettingsNavItem[] = [
  {
    label: "General",
    path: "/settings",
    icon: Settings,
  },
  {
    label: "Team",
    path: "/settings/team",
    icon: Users,
  },
  {
    label: "Billing",
    path: "/settings/billing",
    icon: CreditCard,
    requiresOwner: true,
  },
];

export function SettingsLayout() {
  const location = useLocation();
  const { isOwner, isLoading: roleLoading } = useCurrentUserRole();

  // Filter nav items based on user role
  const visibleNavItems = navItems.filter(
    (item) => !item.requiresOwner || isOwner
  );

  // If user navigates to billing but isn't owner, redirect to general
  if (
    location.pathname === "/settings/billing" &&
    !roleLoading &&
    !isOwner
  ) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <StandardPage
      title="Settings"
      subtitle="Manage your organization"
      icon={<Settings className="h-6 w-6" />}
      maxWidth="xl"
    >
      {/* Sidebar Navigation */}
      <div className="mb-6">
        <div className="flex gap-2 p-1 bg-surface-gradient rounded-[5px] shadow-e1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-[5px] transition-all font-mono text-[11px] uppercase tracking-wider font-medium",
                  isActive
                    ? "bg-card shadow-e1 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                style={
                  isActive
                    ? {
                        boxShadow:
                          "1px 3px 4px 0px rgba(0, 0, 0, 0.1), inset 1px 1px 1px rgba(255, 255, 255, 0.4)",
                      }
                    : undefined
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Page Content */}
      <div className="mt-6">
        <Outlet />
      </div>
    </StandardPage>
  );
}

