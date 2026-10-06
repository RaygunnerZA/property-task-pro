import { useMemo } from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Calendar,
  BarChart3,
  HelpCircle,
  Settings,
  FolderOpen,
  Layers,
  Package,
  Users,
  Sparkles,
} from "lucide-react";
import { useAssistantContext } from "@/contexts/AssistantContext";
import { cn } from "@/lib/utils";
import {
  PROPERTY_ASSETS_PATH,
  PROPERTY_PEOPLE_PATH,
  PROPERTY_SPACES_PATH,
} from "@/lib/mainNavigation";

const MORE_MENU_ITEMS = [
  { to: "/calendar", label: "Calendar", icon: Calendar, description: "Month and schedule" },
  { to: "/records", label: "Records", icon: FolderOpen, description: "Compliance and documents" },
  { to: PROPERTY_SPACES_PATH, label: "Spaces", icon: Layers, description: "Rooms and space groups" },
  { to: PROPERTY_ASSETS_PATH, label: "Assets", icon: Package, description: "Equipment and maintainables" },
  { to: PROPERTY_PEOPLE_PATH, label: "People", icon: Users, description: "Staff, contractors, contacts" },
  { to: "/reports", label: "Reports", icon: BarChart3, description: "Insights and exports" },
  { to: "/help", label: "Help", icon: HelpCircle, description: "Guides and support" },
  { to: "/settings", label: "Settings", icon: Settings, description: "Account and organisation" },
] as const;

type MobileMoreMenuDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Mobile “More” sheet — secondary destinations not on the bottom bar.
 * Anchored to the bottom of the visual viewport. Vaul’s bottom-sheet
 * transform was leaving this panel below the phone while the scrim stayed put.
 */
export function MobileMoreMenuDrawer({ open, onOpenChange }: MobileMoreMenuDrawerProps) {
  const items = useMemo(() => MORE_MENU_ITEMS, []);
  const { openAssistant } = useAssistantContext();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-scrim fixed inset-0 z-[110]" />
        <Dialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-[120] flex w-full flex-col overflow-hidden outline-none",
            "max-h-[min(85dvh,calc(100dvh-env(safe-area-inset-top)-12px))]",
            "rounded-t-2xl border-0 bg-card shadow-e3",
            "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          )}
        >
          <div className="shrink-0 px-4 pt-3">
            <Dialog.Title className="font-display text-xl">More</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              Workspace and account
            </Dialog.Description>
          </div>
          <nav
            className="grid min-h-0 gap-1 overflow-y-auto overscroll-contain px-4 pb-2 pt-3"
            aria-label="More destinations"
          >
            <button
              type="button"
              onClick={() => {
                openAssistant();
                onOpenChange(false);
              }}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                "text-foreground hover:bg-muted/50"
              )}
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted/40 shadow-sm">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">Ask Filla</span>
                <span className="block text-xs text-muted-foreground">Questions about this workspace</span>
              </span>
            </button>
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 no-underline transition-colors",
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
