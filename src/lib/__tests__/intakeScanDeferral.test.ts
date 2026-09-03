import { describe, expect, it } from "vitest";
import {
  intakeAttachmentsWillProcessLater,
  waitForIntakePreScans,
  waitWithTimeout,
} from "@/lib/intakeScanDeferral";
import type { TempImage } from "@/types/temp-image";
import type { PendingIntakeFile } from "@/utils/ingestIntakeMediaFiles";

function pendingFile(overrides: Partial<PendingIntakeFile> = {}): PendingIntakeFile {
  return {
    local_id: "f1",
    file: new File(["x"], "cert.pdf", { type: "application/pdf" }),
    display_name: "cert.pdf",
    file_size: 10,
    file_type: "application/pdf",
    ...overrides,
  };
}

function tempImage(overrides: Partial<TempImage> = {}): TempImage {
  return {
    local_id: "i1",
    display_name: "photo.jpg",
    thumbnail_blob: new Blob(["x"], { type: "image/webp" }),
    optimized_blob: new Blob(["x"], { type: "image/webp" }),
    annotation_json: [],
    ...overrides,
  };
}

describe("intakeScanDeferral", () => {
  it("waitWithTimeout resolves completed when the promise finishes first", async () => {
    await expect(waitWithTimeout(Promise.resolve(), 50)).resolves.toBe("completed");
  });

  it("waitWithTimeout resolves timed_out when the promise is slow", async () => {
    await expect(
      waitWithTimeout(new Promise<void>(() => undefined), 20)
    ).resolves.toBe("timed_out");
  });

  it("waitForIntakePreScans reports timeout when either scan pipeline stalls", async () => {
    const result = await waitForIntakePreScans({
      waitForDocumentScans: () => new Promise(() => undefined),
      waitForImageAnalysis: () => Promise.resolve(),
      timeoutMs: 20,
    });
    expect(result.timedOut).toBe(true);
  });

  it("intakeAttachmentsWillProcessLater is true for in-flight or failed scans", () => {
    expect(
      intakeAttachmentsWillProcessLater([pendingFile({ scanStatus: "scanning" })], [])
    ).toBe(true);
    expect(
      intakeAttachmentsWillProcessLater([pendingFile({ scanStatus: "error" })], [])
    ).toBe(true);
    expect(
      intakeAttachmentsWillProcessLater([], [tempImage({ intakeFullAnalysisPending: true })])
    ).toBe(true);
    expect(
      intakeAttachmentsWillProcessLater(
        [],
        [
          tempImage({
            rawAnalysis: {
              ocr_text: "",
              metadata: { intake_stage: "full", full_analysis_failed: true },
            },
          }),
        ]
      )
    ).toBe(true);
  });

  it("intakeAttachmentsWillProcessLater is false when scans succeeded", () => {
    expect(
      intakeAttachmentsWillProcessLater([pendingFile({ scanStatus: "done" })], [])
    ).toBe(false);
    expect(
      intakeAttachmentsWillProcessLater(
        [],
        [
          tempImage({
            rawAnalysis: {
              ocr_text: "Gas Safety",
              metadata: { intake_stage: "full" },
            },
          }),
        ]
      )
    ).toBe(false);
  });
});
