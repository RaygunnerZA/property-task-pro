import { Inbox } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { GlobalDropZone } from "@/components/attachments/GlobalDropZone";
import { ForwardEmailSection } from "@/components/intake/ForwardEmailSection";
import { CalendarImportSection, CloudPickerSection } from "@/components/intake/IntakeImportSections";

interface AddToFillaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: (taskId: string) => void;
  defaultPropertyId?: string;
}

/** Capture-only sheet — review of processed uploads lives on Home Inflow. */
export function AddToFillaSheet({ open, onOpenChange }: AddToFillaSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-xl pb-8 max-h-[calc(100dvh-2rem)] overflow-y-auto !inset-x-auto !left-1/2 !right-auto !top-4 !bottom-auto !h-auto !w-full max-w-[min(28rem,calc(100vw-1.5rem))] max-lg:!max-w-[min(28rem,calc(100vw-1.5rem))] !-translate-x-1/2"
      >
        <SheetHeader className="text-left pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            Add to Filla
          </SheetTitle>
          <SheetDescription>
            Upload a photo or document. When processing finishes, it appears on Home under Needs
            review for you to file.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pt-2">
          <GlobalDropZone compact onUploadComplete={() => undefined} />
          <ForwardEmailSection />
          <CalendarImportSection />
          <CloudPickerSection />
        </div>
      </SheetContent>
    </Sheet>
  );
}
