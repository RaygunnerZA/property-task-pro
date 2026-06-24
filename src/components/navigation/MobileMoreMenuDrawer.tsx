import { Link } from "react-router-dom";
import {
  Building2,
  Box,
  BarChart3,
  HelpCircle,
  Settings,
  Layers,
  FolderOpen,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

const MORE_MENU_ITEMS = [
  { to: "/properties", label: "Properties", icon: Building2, description: "Portfolio and property hubs" },
  { to: "/properties", label: "Spaces", icon: Layers, description: "Rooms and areas" },
  { to: "/assets", label: "Assets", icon: Box, description: "Equipment and fixtures" },
  { to: "/records", label: "Records", icon: FolderOpen, description: "Compliance and documents" },
  { to: "/reports", label: "Reports", icon: BarChart3, description: "Insights and exports" },
  { to: "/help", label: "Help", icon: HelpCircle, description: "Guides and support" },
  { to: "/settings", label: "Settings", icon: Settings, description: "Account and organisation" },
] as const;

type MobileMoreMenuDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Mobile “More” slider — Properties, Spaces, Assets, Records, Reports, Help, Settings.
 */
export function MobileMoreMenuDrawer({ open, onOpenChange }: MobileMoreMenuDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b border-border/50 text-left">
          <DrawerTitle>More</DrawerTitle>
          <DrawerDescription>Properties, records, reports, and settings</DrawerDescription>
        </DrawerHeader>
        <nav className="space-y-1 p-4 pb-8" aria-label="More navigation">
          {MORE_MENU_ITEMS.map(({ to, label, icon: Icon, description }) => (
            <Link
              key={label}
              to={to}
              onClick={() => onOpenChange(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl p-3 transition-colors",
                "bg-card shadow-sm hover:bg-card/90 active:scale-[0.99]"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                <Icon className="h-5 w-5 text-foreground/80" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground">{description}</div>
              </div>
            </Link>
          ))}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
