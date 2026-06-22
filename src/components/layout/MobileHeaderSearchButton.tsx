import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useOptionalWorkbenchControls } from "@/contexts/WorkbenchControlsContext";
import { cn } from "@/lib/utils";
import {
  GradientHeaderMaskedIcon,
  gradientHeaderControlClassName,
} from "@/lib/gradientHeaderControls";

const WORKBENCH_SEARCH_ICON = "/icons/workbench/search.svg";

type MobileHeaderSearchButtonProps = {
  variant?: "default" | "onGradient";
  accentColor?: string;
};

export function MobileHeaderSearchButton({
  variant = "default",
  accentColor = "#8EC9CE",
}: MobileHeaderSearchButtonProps) {
  const navigate = useNavigate();
  const workbenchControls = useOptionalWorkbenchControls();
  const [open, setOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState("");

  const onGradient = variant === "onGradient";

  const handleOpen = () => {
    setLocalQuery(workbenchControls?.searchQuery ?? "");
    setOpen(true);
  };

  const handleSubmit = () => {
    const trimmed = localQuery.trim();
    if (workbenchControls) {
      workbenchControls.setSearchQuery(trimmed);
      setOpen(false);
      return;
    }
    if (trimmed) {
      navigate(`/?search=${encodeURIComponent(trimmed)}`);
    } else {
      navigate("/");
    }
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          onGradient
            ? gradientHeaderControlClassName()
            : "flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-card shadow-e1 outline-none transition-shadow hover:shadow-e2 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
        aria-label="Search"
      >
        {onGradient ? (
          <GradientHeaderMaskedIcon src={WORKBENCH_SEARCH_ICON} color={accentColor} />
        ) : (
          <img
            src={WORKBENCH_SEARCH_ICON}
            alt=""
            className="h-5 w-5 object-contain"
            width={20}
            height={20}
          />
        )}
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[40vh]">
          <DrawerHeader className="border-b border-border/50 pb-3">
            <DrawerTitle>Search</DrawerTitle>
          </DrawerHeader>
          <div className="p-4">
            <div className="flex min-w-0 items-stretch overflow-hidden rounded-lg border border-border/40 bg-input">
              <input
                type="search"
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
                placeholder="Search anything..."
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/70"
                aria-label="Search"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex shrink-0 items-center justify-center border-l border-border/50 px-4 text-sm font-medium text-primary"
              >
                Go
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
