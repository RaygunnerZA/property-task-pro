import { useState } from "react";
import { IntakeInboxPanel, type IntakeReviewPayload } from "@/components/intake/IntakeInboxPanel";
import { IntakeReviewSheet } from "@/components/intake/IntakeReviewSheet";
import { IntakeModal } from "@/components/intake/IntakeModal";
import type { IntakeMode } from "@/types/intake";
import { cn } from "@/lib/utils";

type IntakePendingReviewSectionProps = {
  className?: string;
  defaultPropertyId?: string;
  onTaskCreated?: (taskId: string) => void;
  /** Optional ref target wrapper for deep-link scroll (`?inflow=pending`). */
  sectionRef?: React.RefObject<HTMLElement | null>;
};

/**
 * Ready / processing uploads for review on Home Inflow (not inside Add to Filla).
 */
export function IntakePendingReviewSection({
  className,
  defaultPropertyId,
  onTaskCreated,
  sectionRef,
}: IntakePendingReviewSectionProps) {
  const [reviewPayload, setReviewPayload] = useState<IntakeReviewPayload | null>(null);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<IntakeMode>("add_record");

  const handleReview = (payload: IntakeReviewPayload) => {
    setReviewPayload(payload);
    setReviewSheetOpen(true);
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

  return (
    <>
      <section
        ref={sectionRef as React.RefObject<HTMLElement>}
        id="pending-uploads"
        className={cn("min-w-0", className)}
      >
        <IntakeInboxPanel onReview={handleReview} />
      </section>

      <IntakeReviewSheet
        open={reviewSheetOpen}
        onOpenChange={handleReviewSheetChange}
        payload={reviewPayload}
        onContinue={handleContinueFromReview}
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
