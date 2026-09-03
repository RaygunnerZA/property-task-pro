/**
 * Pre-save intake scans are best-effort. When AI is slow or unavailable,
 * allow Add Record to save attachments and queue analysis for later.
 */

import type { TempImage } from "@/types/temp-image";
import type { PendingIntakeFile } from "@/utils/ingestIntakeMediaFiles";

/** Max time to wait for pre-save scans before saving without hints. */
export const INTAKE_PRE_SCAN_WAIT_MS = 22_000;

export const INTAKE_DEFERRED_SCAN_NOTIFICATION = {
  title: "Record saved — scan queued",
  description:
    "Document reading is temporarily unavailable. Your file is saved and Filla will extract details when AI is back.",
} as const;

export class IntakeScanTimeoutError extends Error {
  constructor() {
    super("intake_scan_timeout");
    this.name = "IntakeScanTimeoutError";
  }
}

export async function withIntakeScanTimeout<T>(
  promise: Promise<T>,
  timeoutMs = INTAKE_PRE_SCAN_WAIT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new IntakeScanTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function waitWithTimeout(
  promise: Promise<void>,
  timeoutMs: number
): Promise<"completed" | "timed_out"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      promise.then(() => "completed" as const),
      new Promise<"timed_out">((resolve) => {
        timer = setTimeout(() => resolve("timed_out"), timeoutMs);
      }),
    ]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function waitForIntakePreScans(options: {
  waitForDocumentScans: () => Promise<void>;
  waitForImageAnalysis: () => Promise<void>;
  timeoutMs?: number;
}): Promise<{ timedOut: boolean }> {
  const timeoutMs = options.timeoutMs ?? INTAKE_PRE_SCAN_WAIT_MS;
  const [doc, img] = await Promise.all([
    waitWithTimeout(options.waitForDocumentScans(), timeoutMs),
    waitWithTimeout(options.waitForImageAnalysis(), timeoutMs),
  ]);
  return { timedOut: doc === "timed_out" || img === "timed_out" };
}

/** True when uploaded attachments will trigger post-save AI analysis. */
export function intakeAttachmentsWillProcessLater(
  files: PendingIntakeFile[],
  images: TempImage[]
): boolean {
  const unscannedFiles = files.some(
    (file) => file.scanStatus !== "done" && file.scanStatus !== "skipped"
  );

  const unscannedImages = images.some((img) => {
    const meta = img.rawAnalysis?.metadata as Record<string, unknown> | undefined;
    const stage = meta?.intake_stage;
    if (img.intakeFullAnalysisPending) return true;
    if (stage === "full" && meta?.full_analysis_failed !== true) return false;
    return Boolean(img.optimized_blob || img.thumbnail_blob);
  });

  return unscannedFiles || unscannedImages;
}
