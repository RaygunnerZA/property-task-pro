import { Home, Briefcase, Settings, FileText, Plus } from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import { DS } from "@/design-system/DesignSystem";

export default function FooterNav() {
  const location = useLocation();

  const navItems = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/work", icon: Briefcase, label: "Work" },
    { to: "/manage", icon: Settings, label: "Manage" },
    { to: "/record", icon: FileText, label: "Record" },
  ];

  return (
    <nav
      className="h-16 border-t px-4 flex items-center justify-around relative"
      style={{
        backgroundColor: DS.colour.bg,
        borderColor: DS.colour.border
      }}
    >
      {navItems.map(({ to, icon: Icon, label }) => {
        const isActive = location.pathname === to;

        return (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-0.5 transition-all"
          >
            <Icon
              size={20}
              color={isActive ? DS.colour.primary : DS.colour.textMuted}
            />
            <span
              className="text-[11px] font-medium"
              style={{
                color: isActive ? DS.colour.primary : DS.colour.textMuted
              }}
            >
              {label}
            </span>
          </Link>
        );
      })}

      {/* Floating Action Button */}
      <button
        className="absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95"
        style={{
          backgroundColor: DS.colour.primary,
          boxShadow: DS.shadow.raised
        }}
        aria-label="Add"
      >
        <Plus size={24} color="white" />
      </button>
    </nav>
  );
}
