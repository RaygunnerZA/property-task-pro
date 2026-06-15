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
import { IntakeInboxPanel, type IntakeReviewPayload } from "@/components/intake/IntakeInboxPanel";
import { IntakeReviewSheet } from "@/components/intake/IntakeReviewSheet";
import { IntakeModal } from "@/components/intake/IntakeModal";
import { useState } from "react";
import type { IntakeMode } from "@/types/intake";

interface AddToFillaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: (taskId: string) => void;
  defaultPropertyId?: string;
}

export function AddToFillaSheet({
  open,
  onOpenChange,
  onTaskCreated,
  defaultPropertyId,
}: AddToFillaSheetProps) {
  const [reviewPayload, setReviewPayload] = useState<IntakeReviewPayload | null>(null);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<IntakeMode>("add_record");

  const handleReview = (payload: IntakeReviewPayload) => {
    setReviewPayload(payload);
    setReviewSheetOpen(true);
    onOpenChange(false);
  };

  const handleContinueFromReview = (mode: IntakeMode) => {
    setComposeMode(mode);
    setReviewSheetOpen(false);
    setComposeOpen(true);
  };

  const handleReviewSheetChange = (next: boolean) => {
    setReviewSheetOpen(next);
    if (!next && !composeOpen) {
      setReviewPayload(null);
    }
  };

  const handleComposeChange = (next: boolean) => {
    setComposeOpen(next);
    if (!next) {
      setReviewPayload(null);
      setReviewSheetOpen(false);
    }
  };

  const handleBackToUploads = () => {
    setReviewSheetOpen(false);
    onOpenChange(true);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-[20px] pb-8 max-h-[85vh] overflow-y-auto">
          <SheetHeader className="text-left pb-2">
            <SheetTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              Add to Filla
            </SheetTitle>
            <SheetDescription>
              Upload a photo or document. Filla will analyse it and suggest how to file it.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 pt-2">
            <GlobalDropZone compact onUploadComplete={() => undefined} />
            <ForwardEmailSection />
            <CalendarImportSection />
            <CloudPickerSection />
            <IntakeInboxPanel onReview={handleReview} />
          </div>
        </SheetContent>
      </Sheet>

      <IntakeReviewSheet
        open={reviewSheetOpen}
        onOpenChange={handleReviewSheetChange}
        payload={reviewPayload}
        onContinue={handleContinueFromReview}
        onBackToUploads={handleBackToUploads}
      />

      <IntakeModal
        open={composeOpen}
        onOpenChange={handleComposeChange}
        onTaskCreated={onTaskCreated}
        defaultPropertyId={defaultPropertyId}
        initialIntakeMode={composeMode}
        initialDescription={reviewPayload?.description}
        initialSourceArtifact={reviewPayload?.sourceArtifact}
        fromIntakeReview
      />
    </>
  );
}
