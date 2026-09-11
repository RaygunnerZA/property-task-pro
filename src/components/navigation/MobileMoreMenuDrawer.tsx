import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Calendar,
  BarChart3,
  HelpCircle,
  Settings,
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
  { to: "/calendar", label: "Calendar", icon: Calendar, description: "Month and schedule" },
  { to: "/records", label: "Records", icon: FolderOpen, description: "Compliance and documents" },
  { to: "/property/spaces", label: "Property", icon: Building2, description: "Spaces, assets, and people" },
  { to: "/reports", label: "Reports", icon: BarChart3, description: "Insights and exports" },
  { to: "/help", label: "Help", icon: HelpCircle, description: "Guides and support" },
  { to: "/settings", label: "Settings", icon: Settings, description: "Account and organisation" },
] as const;

type MobileMoreMenuDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Mobile “More” slider — secondary destinations not on the bottom bar.
 */
export function MobileMoreMenuDrawer({ open, onOpenChange }: MobileMoreMenuDrawerProps) {
  const items = useMemo(() => MORE_MENU_ITEMS, []);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] border-0 bg-card shadow-e3">
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-display text-xl">More</DrawerTitle>
          <DrawerDescription>Workspace and account</DrawerDescription>
        </DrawerHeader>
        <nav className="grid gap-1 px-4 pb-8" aria-label="More destinations">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 no-underline transition-colors",
                  "text-foreground hover:bg-muted/50"
                )}
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted/40 shadow-sm">
                  <Icon className="h-4 w-4 text-primary" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="block text-caption text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
