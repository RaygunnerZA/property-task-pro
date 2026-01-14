import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Home, CheckSquare, Inbox, Calendar, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { AudioRecorder } from "@/components/audio/AudioRecorder";

/**
 * Mobile Bottom Navigation
 * 
 * Tabs: Home, Tasks, Inbox, Schedule, Create (Center, highlighted)
 * Only visible on screens smaller than md breakpoint
 * Fixed at bottom with high z-index and glassmorphism background
 */
export function MobileBottomNav() {
  const location = useLocation();
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [createView, setCreateView] = useState<"menu" | "task" | "audio">("menu");

  const navItems = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/tasks", icon: CheckSquare, label: "Tasks" },
    { to: "/work/inbox", icon: Inbox, label: "Inbox" },
    { to: "/schedule", icon: Calendar, label: "Schedule" },
  ];

  const isActiveRoute = (path: string) => {
    if (path === "/") {
      return location.pathname === "/" || location.pathname === "/dashboard";
    }
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const handleCreateClick = () => {
    setShowCreateDrawer(true);
    setCreateView("menu");
  };

  const handleCreateTask = () => {
    setCreateView("task");
  };

  const handleCreateAudio = () => {
    setCreateView("audio");
  };

  const handleCloseDrawer = () => {
    setShowCreateDrawer(false);
    // Reset to menu view after a short delay
    setTimeout(() => setCreateView("menu"), 200);
  };

  return (
    <>
      {/* Mobile Bottom Navigation - Only visible on screens < md */}
      <nav className="fixed bottom-0 left-0 right-0 z-[100] md:hidden">
        {/* Glassmorphism background */}
        <div className="absolute inset-0 bg-background/80 backdrop-blur-md border-t border-border/50" />
        
        {/* Content */}
        <div className="relative max-w-md mx-auto px-2 py-2">
          <div className="flex items-center justify-around">
            {/* Regular nav items */}
            {navItems.map(({ to, icon: Icon, label }) => {
              const isActive = isActiveRoute(to);
              
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-all duration-200",
                    "hover:scale-105 active:scale-95",
                    isActive && "scale-105"
                  )}
                >
                  <Icon 
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )} 
                  />
                  <span 
                    className={cn(
                      "text-[10px] font-semibold tracking-tight transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}

            {/* Create button - Center, highlighted */}
            <button
              onClick={handleCreateClick}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-all duration-200",
                "hover:scale-105 active:scale-95",
                "bg-accent text-accent-foreground shadow-fab"
              )}
              aria-label="Create"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[10px] font-semibold tracking-tight">
                Create
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Create Menu Drawer */}
      {createView === "menu" && (
        <Drawer open={showCreateDrawer} onOpenChange={handleCloseDrawer}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="border-b border-border">
              <DrawerTitle>Create</DrawerTitle>
              <DrawerDescription>
                Choose what you'd like to create
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-4 space-y-3">
              <button
                onClick={handleCreateTask}
                className="w-full p-4 rounded-lg bg-card shadow-e1 border border-border hover:shadow-md transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <CheckSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Create Task</div>
                    <div className="text-sm text-muted-foreground">Add a new task to your list</div>
                  </div>
                </div>
              </button>
              <button
                onClick={handleCreateAudio}
                className="w-full p-4 rounded-lg bg-card shadow-e1 border border-border hover:shadow-md transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
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

      {/* Create Task Modal - Handles its own Drawer on mobile */}
      {createView === "task" && (
        <CreateTaskModal
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              handleCloseDrawer();
            }
          }}
        />
      )}

      {/* Audio Recorder - Handles its own Drawer on mobile */}
      {createView === "audio" && (
        <AudioRecorder
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              handleCloseDrawer();
            }
          }}
        />
      )}
    </>
  );
}

