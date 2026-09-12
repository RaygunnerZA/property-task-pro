import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Upload,
  PenLine,
  ScanLine,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getStepType,
  showsExecuteCheckbox,
  type SubtaskData,
} from "@/components/tasks/subtasks/stepTypes";
import { STEP_TYPE_CONFIG } from "@/components/tasks/subtasks/SubtaskCard";
import type { ChecklistStepResponseInput } from "@/lib/checklistStepResponse";
import { responseLabelForType } from "@/lib/checklistStepResponse";
import { SignaturePad } from "@/components/tasks/subtasks/SignaturePad";
import { Input } from "@/components/ui/input";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

type StepExecuteControlsProps = {
  subtask: SubtaskData;
  busy?: boolean;
  /** Incremented when the alignment circle is hovered/clicked — bumps action controls. */
  actionBumpKey?: number;
  onSubmit: (response: ChecklistStepResponseInput) => void | Promise<void>;
};

/**
 * Assignee-facing controls that capture a real compliance response per step type.
 */
export function StepExecuteControls({
  subtask,
  busy = false,
  actionBumpKey = 0,
  onSubmit,
}: StepExecuteControlsProps) {
  const stepType = getStepType(subtask);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [textValue, setTextValue] = useState(subtask.response_value ?? "");
  const [numberValue, setNumberValue] = useState(
    stepType === "number" ? (subtask.response_value ?? "") : ""
  );
  const [scanValue, setScanValue] = useState(
    stepType === "scan" ? (subtask.response_value ?? "") : ""
  );
  const [showSignature, setShowSignature] = useState(false);
  const [evidencePreviewOpen, setEvidencePreviewOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [bumpActive, setBumpActive] = useState(false);

  useEffect(() => {
    if (!actionBumpKey) return;
    setBumpActive(false);
    let timer: number | undefined;
    const frame = requestAnimationFrame(() => {
      setBumpActive(true);
      timer = window.setTimeout(() => setBumpActive(false), 450);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [actionBumpKey]);

  const recorded = responseLabelForType(stepType, subtask.response_value);
  const done = Boolean(subtask.is_completed);
  const indentClass = showsExecuteCheckbox(stepType) ? "pl-[22px]" : "pl-0";
  const bumpClass = bumpActive ? "animate-action-bump" : undefined;

  if (stepType === "title" || stepType === "note" || stepType === "divider") {
    return null;
  }

  if (done && recorded) {
    const fileUrl =
      typeof subtask.response_json?.file_url === "string"
        ? subtask.response_json.file_url
        : null;
    const looksLikeImage =
      (Boolean(fileUrl) &&
        /\.(png|jpe?g|gif|webp|heic|bmp)(\?|$)/i.test(fileUrl!)) ||
      stepType === "photo" ||
      stepType === "signature";
    return (
      <>
        <div className={cn("mt-1 flex flex-wrap items-center gap-2 text-2xs", indentClass)}>
          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary-deep">
            <Check className="h-3 w-3" />
            {STEP_TYPE_CONFIG[stepType].label}: {recorded}
          </span>
          {fileUrl ? (
            looksLikeImage ? (
              <button
                type="button"
                onClick={() => setEvidencePreviewOpen(true)}
                className="text-primary underline-offset-2 hover:underline"
              >
                View evidence
              </button>
            ) : (
              <a
                href={fileUrl}
                download
                className="text-primary underline-offset-2 hover:underline"
              >
                View evidence
              </a>
            )
          ) : null}
          {subtask.completed_at ? (
            <span className="text-muted-foreground">
              {new Date(subtask.completed_at).toLocaleString(undefined, {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : null}
        </div>
        {fileUrl && looksLikeImage ? (
          <ImageLightbox
            open={evidencePreviewOpen}
            images={[{ src: fileUrl, alt: "Evidence" }]}
            index={0}
            title="Evidence"
            onClose={() => setEvidencePreviewOpen(false)}
          />
        ) : null}
      </>
    );
  }

  // Plain check steps complete from the circle — no duplicate Mark done button.
  if (stepType === "check") return null;

  const submit = async (response: ChecklistStepResponseInput) => {
    setLocalError(null);
    try {
      await onSubmit(response);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Couldn't save response");
    }
  };

  return (
    <div className={cn("mt-1 space-y-1.5", indentClass, bumpClass)}>
      {stepType === "yes_no" && (
        <div className="inline-flex items-center gap-1 rounded-lg bg-muted/40 p-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit({ value: "no", metadata: { answer: "no" } })}
            className="h-7 rounded-md bg-card px-3 text-2xs font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          >
            No
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit({ value: "yes", metadata: { answer: "yes" } })}
            className="h-7 rounded-md bg-card px-3 text-2xs font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          >
            Yes
          </button>
        </div>
      )}

      {stepType === "pass_fail" && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit({ value: "pass", metadata: { result: "pass" } })}
            className="h-7 rounded-lg bg-card px-3 text-2xs font-medium uppercase tracking-wider text-emerald-600 shadow-sm"
          >
            Pass
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit({ value: "fail", metadata: { result: "fail" } })}
            className="h-7 rounded-lg bg-card px-3 text-2xs font-medium uppercase tracking-wider text-destructive shadow-sm"
          >
            Fail
          </button>
        </div>
      )}

      {stepType === "text" && (
        <div className="flex items-center gap-2">
          <Input
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="Type your answer…"
            className="h-8 max-w-sm text-sm"
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy || !textValue.trim()}
            onClick={() => void submit({ value: textValue.trim() })}
            className="h-8 rounded-md bg-primary px-2.5 text-2xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}

      {stepType === "number" && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            value={numberValue}
            onChange={(e) => setNumberValue(e.target.value)}
            placeholder="Enter number…"
            className="h-8 w-28 text-sm tabular-nums"
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy || numberValue.trim() === ""}
            onClick={() =>
              void submit({
                value: numberValue.trim(),
                metadata: { numeric_value: Number(numberValue) },
              })
            }
            className="h-8 rounded-md bg-primary px-2.5 text-2xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}

      {stepType === "photo" && (
        <>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              void submit({ value: "photo", file, metadata: { evidence_kind: "photo" } });
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => photoRef.current?.click()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-card px-2.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground shadow-sm"
          >
            <Camera className="h-3.5 w-3.5" />
            Upload photo
          </button>
        </>
      )}

      {stepType === "file" && (
        <>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              void submit({ value: "file", file, metadata: { evidence_kind: "file" } });
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-card px-2.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground shadow-sm"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload file
          </button>
        </>
      )}

      {stepType === "signature" && (
        showSignature ? (
          <SignaturePad
            busy={busy}
            onCancel={() => setShowSignature(false)}
            onSave={(dataUrl) => {
              setShowSignature(false);
              void submit({
                value: "signed",
                signatureDataUrl: dataUrl,
                metadata: { evidence_kind: "signature" },
              });
            }}
          />
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowSignature(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-card px-2.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground shadow-sm"
          >
            <PenLine className="h-3.5 w-3.5" />
            Sign
          </button>
        )
      )}

      {stepType === "scan" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            placeholder="Scan or enter code…"
            className="h-8 max-w-xs font-mono text-sm"
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy || !scanValue.trim()}
            onClick={() =>
              void submit({
                value: scanValue.trim(),
                metadata: { evidence_kind: "scan", entry: "manual_or_device" },
              })
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-2xs font-medium text-primary-foreground disabled:opacity-50"
          >
            <ScanLine className="h-3.5 w-3.5" />
            Record
          </button>
        </div>
      )}

      {localError ? <p className="text-2xs text-destructive">{localError}</p> : null}
    </div>
  );
}
