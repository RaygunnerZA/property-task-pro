import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Plus, FileText } from "lucide-react";
import {
  MOBILE_NAV_ITEMS,
  MOBILE_MORE_NAV_URL,
  isMobileNavActive,
} from "@/lib/mainNavigation";
import type { IntakeMode } from "@/types/intake";
import { cn } from "@/lib/utils";
import { paperTexturedColorStyle } from "@/lib/paperTexture";
import {
  intakeAddRecordDrawerCardClassName,
  intakeDrawerIconWrapAddClassName,
  intakeDrawerIconWrapReportClassName,
  intakeReportIssueDrawerCardClassName,
} from "@/lib/intake-action-buttons";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { IntakeModal } from "@/components/intake/IntakeModal";
import { AudioRecorder } from "@/components/audio/AudioRecorder";
import { MobileMoreMenuDrawer } from "@/components/navigation/MobileMoreMenuDrawer";
import type { ComponentType } from "react";

/**
 * Mobile Bottom Navigation
 *
 * Tabs: Home · Tasks · Compliance · More + center FAB
 * Only visible below lg (1024px)
 */
export function MobileBottomNav() {
  const location = useLocation();
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [createView, setCreateView] = useState<"menu" | "task" | "audio">("menu");
  const [mobileIntakeInitial, setMobileIntakeInitial] = useState<IntakeMode>("report_issue");

  const leftItems = MOBILE_NAV_ITEMS.slice(0, 2);
  const rightItems = MOBILE_NAV_ITEMS.slice(2);

  const handleCreateClick = () => {
    setShowCreateDrawer(true);
    setCreateView("menu");
  };

  const openIntake = (mode: IntakeMode) => {
    setMobileIntakeInitial(mode);
    setCreateView("task");
  };

  const handleCreateAudio = () => {
    setCreateView("audio");
  };

  const handleCloseDrawer = () => {
    setShowCreateDrawer(false);
    setTimeout(() => setCreateView("menu"), 200);
  };

  const renderNavLink = (to: string, icon: ComponentType<{ className?: string }>, label: string) => {
    const Icon = icon;
    const isMore = to === MOBILE_MORE_NAV_URL;
    const isActive = !isMore && isMobileNavActive(location.pathname, to);

    if (isMore) {
      return (
        <button
          key={to}
          type="button"
          onClick={() => setShowMoreMenu(true)}
          className={cn(
            "flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition-all duration-200",
            "hover:scale-105 active:scale-95"
          )}
          aria-label="More"
        >
          <Icon className="h-6 w-6 text-muted-foreground icon-shadow-neu-pressed" />
          <span className="text-[10px] font-semibold leading-none tracking-tight text-muted-foreground">
            {label}
          </span>
        </button>
      );
    }

    return (
      <Link
        key={to}
        to={to}
        className={cn(
          "flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-lg py-1 transition-all duration-200",
          "hover:scale-105 active:scale-95",
          to === "/tasks" && "pl-2 pr-5",
          to === "/compliance" && "pl-5 pr-2",
          to !== "/tasks" && to !== "/compliance" && "px-2",
          isActive && "scale-105"
        )}
      >
        <Icon
          className={cn(
            "h-6 w-6 icon-shadow-neu-pressed transition-colors",
            isActive ? "text-[#3A4A6A]" : "text-muted-foreground"
          )}
        />
        <span
          className={cn(
            "text-[10px] font-semibold leading-none tracking-tight transition-colors",
            isActive ? "text-[#3A4A6A]" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
      </Link>
    );
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-[100] h-[72px] lg:hidden" aria-label="Main navigation">
        <div className="absolute inset-0 border-t-2 border-white/[0.61] bg-background/90 backdrop-blur-md" />

        <div className="relative mx-auto max-w-md px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          <div className="relative flex items-end justify-between">
            <div className="flex flex-1 justify-around">
              {leftItems.map(({ url, icon, title }) => renderNavLink(url, icon, title))}
            </div>

            <div className="w-[65px] shrink-0" aria-hidden />

            <div className="flex flex-1 justify-around">
              {rightItems.map(({ url, icon, title }) => renderNavLink(url, icon, title))}
            </div>

            <button
              type="button"
              onClick={handleCreateClick}
              className={cn(
                "absolute left-1/2 top-[9px] flex h-[65px] w-[65px] -translate-x-1/2 -translate-y-1/2 items-center justify-center",
                "overflow-hidden rounded-xl paper-textured-color text-primary-foreground shadow-fab-neo",
                "transition-transform hover:scale-105 active:scale-95"
              )}
              style={paperTexturedColorStyle("hsl(var(--primary))")}
              aria-label="Create"
            >
              <Plus className="h-8 w-8 icon-shadow-neu-pressed" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </nav>

      <MobileMoreMenuDrawer open={showMoreMenu} onOpenChange={setShowMoreMenu} />

      {createView === "menu" && (
        <Drawer open={showCreateDrawer} onOpenChange={handleCloseDrawer}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="border-b border-border">
              <DrawerTitle>Create</DrawerTitle>
              <DrawerDescription>Choose what you&apos;d like to create</DrawerDescription>
            </DrawerHeader>
            <div className="space-y-3 p-4">
              <button onClick={() => openIntake("add_record")} className={intakeAddRecordDrawerCardClassName}>
                <div className="flex items-center gap-3">
                  <div className={intakeDrawerIconWrapAddClassName}>
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold">Add Record</div>
                    <div className="text-sm text-white/85">File a certificate, inspection, or document</div>
                  </div>
                </div>
              </button>
              <button onClick={() => openIntake("report_issue")} className={intakeReportIssueDrawerCardClassName}>
                <div className="flex items-center gap-3">
                  <div className={intakeDrawerIconWrapReportClassName}>
                    <Plus className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold">Report Issue</div>
                    <div className="text-sm text-white/85">Capture a problem or maintenance need</div>
                  </div>
                </div>
              </button>
              <button
                onClick={handleCreateAudio}
                className="w-full rounded-lg border border-border bg-card p-4 text-left shadow-e1 transition-all hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-accent/10 p-2">
                    <Plus className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Record Audio</div>
                    <div className="text-sm text-muted-foreground">Record an audio note</div>
                  </div>
                </div>
              </button>
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {createView === "task" && (
        <IntakeModal
          open
          onOpenChange={(open) => {
            if (!open) handleCloseDrawer();
          }}
          initialIntakeMode={mobileIntakeInitial}
        />
      )}

      {createView === "audio" && (
        <AudioRecorder
          open
          onOpenChange={(open) => {
            if (!open) handleCloseDrawer();
          }}
        />
      )}
    </>
  );
}
