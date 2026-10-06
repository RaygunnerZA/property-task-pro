import { useEffect, useState, lazy, Suspense } from "react";
import { Plus, FileText } from "lucide-react";
import type { IntakeMode } from "@/types/intake";
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
import { LazyIntakeModal as IntakeModal } from "@/components/intake/LazyIntakeModal";

const AudioRecorder = lazy(() =>
  import("@/components/audio/AudioRecorder").then((m) => ({ default: m.AudioRecorder }))
);

type CreateActionDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Create Task / Add Record / Record Audio.
 * Shared by the phone centre button and the desktop rail Create New action.
 */
export function CreateActionDrawer({ open, onOpenChange }: CreateActionDrawerProps) {
  const [createView, setCreateView] = useState<"menu" | "task" | "audio">("menu");
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("report_issue");

  useEffect(() => {
    if (open) setCreateView("menu");
  }, [open]);

  const close = () => {
    onOpenChange(false);
    window.setTimeout(() => setCreateView("menu"), 200);
  };

  return (
    <>
      {createView === "menu" && (
        <Drawer open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="border-b border-border">
              <DrawerTitle>Create</DrawerTitle>
              <DrawerDescription>Choose what you&apos;d like to create</DrawerDescription>
            </DrawerHeader>
            <div className="space-y-3 p-4">
              <button
                type="button"
                onClick={() => {
                  setIntakeMode("report_issue");
                  setCreateView("task");
                }}
                className={intakeReportIssueDrawerCardClassName}
              >
                <div className="flex items-center gap-3">
                  <div className={intakeDrawerIconWrapReportClassName}>
                    <Plus className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold">Create Task</div>
                    <div className="text-sm text-white/85">Capture a problem or maintenance need</div>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIntakeMode("add_record");
                  setCreateView("task");
                }}
                className={intakeAddRecordDrawerCardClassName}
              >
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
              <button
                type="button"
                onClick={() => setCreateView("audio")}
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

      {open && createView === "task" && (
        <IntakeModal
          open
          onOpenChange={(next) => {
            if (!next) close();
          }}
          initialIntakeMode={intakeMode}
        />
      )}

      {open && createView === "audio" && (
        <Suspense fallback={null}>
          <AudioRecorder
            open
            onOpenChange={(next) => {
              if (!next) close();
            }}
          />
        </Suspense>
      )}
    </>
  );
}
