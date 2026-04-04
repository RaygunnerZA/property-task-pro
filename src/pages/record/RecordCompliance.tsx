import { NavLink, Outlet, useLocation } from "react-router-dom";
import { StandardPage } from "@/components/design-system/StandardPage";
import { Shield, BarChart3, User, Calendar, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useComplianceRecommendations } from "@/hooks/useComplianceRecommendations";

const complianceNavItems = [
  { path: "/record/compliance", label: "Dashboard", icon: BarChart3 },
  { path: "/record/compliance/tasks", label: "Tasks", icon: CheckSquare },
  { path: "/record/compliance/portfolio", label: "Portfolio", icon: Shield },
  { path: "/record/compliance/contractors", label: "Contractors", icon: User },
  { path: "/record/compliance/calendar", label: "Calendar", icon: Calendar },
];

export default function RecordCompliance() {
  const location = useLocation();
  const { data: pendingRecommendations = [] } = useComplianceRecommendations();
  const isIndex = location.pathname === "/record/compliance" || location.pathname === "/record/compliance/";

  return (
    <StandardPage
      title="Compliance"
      subtitle="Compliance records and portfolio"
      icon={<Shield className="h-6 w-6" />}
      maxWidth="xl"
    >
      <div className="mb-6 flex gap-2 p-1 bg-surface-gradient rounded-[5px] shadow-e1">
        {complianceNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.path === "/record/compliance"
            ? isIndex
            : location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[5px] transition-all font-mono text-[11px] uppercase tracking-wider font-medium relative",
                isActive
                  ? "bg-card shadow-e1 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
              {item.path === "/record/compliance/portfolio" && pendingRecommendations.length > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-medium"
                  title={`${pendingRecommendations.length} pending recommendation${pendingRecommendations.length !== 1 ? "s" : ""}`}
                >
                  {pendingRecommendations.length > 99 ? "99+" : pendingRecommendations.length}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
      <Outlet />
    </StandardPage>
  );
}
