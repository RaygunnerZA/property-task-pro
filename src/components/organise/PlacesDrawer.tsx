import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type PlacesDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "browse" | "filing";
  browseTitle?: string;
  filingTitle?: string;
  children: ReactNode;
};

/**
 * Drawer shell — places never occupy permanent width. Opens from the right
 * edge in browse (filter) or filing (drop targets) mode; picking up any
 * draggable opens it automatically (shelf–bench–drawer grammar,
 * @Docs/04_UI_System.md).
 */
export function PlacesDrawer({
  open,
  onOpenChange,
  mode,
  browseTitle = "Locations",
  filingTitle = "File to location",
  children,
}: PlacesDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(100%,380px)] border-l-0 bg-[hsl(var(--background))] p-4 shadow-e2 sm:max-w-md"
      >
        <SheetHeader className="mb-3">
          <SheetTitle className="text-base">
            {mode === "filing" ? filingTitle : browseTitle}
          </SheetTitle>
        </SheetHeader>
        <div className="h-[calc(100vh-6rem)]">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
