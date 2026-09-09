import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DemoContentLabel } from "@/components/dashboard/issues/IssuesSignalListParts";
import { NeomorphicButton } from "@/components/design-system/NeomorphicButton";
import {
  getSampleContentLesson,
  type SampleContentLesson,
  type SampleContentSection,
} from "@/lib/onboardingEducation";

export type SampleContentLessonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Activity area this sample belongs to. */
  section: SampleContentSection;
  /** Sample row/card title shown in the dialog. */
  itemTitle: string;
  /** Optional lesson copy overrides. */
  lesson?: Partial<Omit<SampleContentLesson, "section">>;
  /**
   * Called when the user confirms — hide this sample (and never show it again
   * for this property / dismiss key).
   */
  onConfirmHide: () => void;
  confirmLabel?: string;
};

/**
 * Instructive gate for sample / demo content.
 * Explains section purpose, that the item is only a sample, and that confirming
 * permanently phases it out of the UI.
 */
export function SampleContentLessonDialog({
  open,
  onOpenChange,
  section,
  itemTitle,
  lesson: lessonOverrides,
  onConfirmHide,
  confirmLabel = "Got it — hide this sample",
}: SampleContentLessonDialogProps) {
  const lesson = getSampleContentLesson(section, lessonOverrides);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="space-y-3 border-b border-border/20 px-5 py-4 text-left">
          <div className="flex items-center gap-2">
            <DemoContentLabel />
            <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
              Sample content
            </span>
          </div>
          <DialogTitle className="font-display text-xl font-semibold leading-tight tracking-tight text-foreground">
            {itemTitle}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            This is teaching material — not live data for your organisation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <section className="space-y-1.5">
            <h3 className="font-mono text-caption font-semibold uppercase tracking-wider text-muted-foreground">
              What this section is for
            </h3>
            <p className="text-sm leading-relaxed text-foreground">{lesson.purpose}</p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-mono text-caption font-semibold uppercase tracking-wider text-muted-foreground">
              Why you are seeing this
            </h3>
            <p className="text-sm leading-relaxed text-foreground">
              {lesson.sampleExplanation}
            </p>
          </section>

          <section className="rounded-xl bg-card/80 px-3.5 py-3 shadow-e1">
            <h3 className="font-mono text-caption font-semibold uppercase tracking-wider text-primary-deep">
              Phase-out
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
              {lesson.phaseOut}
            </p>
          </section>
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-border/20 bg-muted/20 px-5 py-4 sm:flex-col sm:space-x-0">
          <NeomorphicButton
            type="button"
            className="w-full justify-center"
            onClick={() => {
              onConfirmHide();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </NeomorphicButton>
          <button
            type="button"
            className="w-full py-2 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Keep showing for now
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
