import { describe, expect, it } from "vitest";
import {
  extractImportantDatesFromOcr,
  mergeImportantDates,
  normalizeImportantDates,
  normalizeNextSteps,
  primaryExpiryFromDates,
} from "@/lib/intakeDocumentDates";
import { intakeScanMessageAt, INTAKE_DOC_SCAN_MESSAGES } from "@/lib/intakeScanProgress";
import { aggregateIntakeScanReview } from "@/lib/aggregateIntakeScanReview";
import type { PendingIntakeFile } from "@/utils/ingestIntakeMediaFiles";

describe("intakeDocumentDates", () => {
  it("extracts labelled dates from water hygiene style OCR", () => {
    const ocr = `
      Collected: 18 August 2026 08:20
      Received: 18 August 2026 12:14
      Report issued: 20 August 2026
      Next due / re-sample by 20 September 2026
    `;
    const dates = extractImportantDatesFromOcr(ocr);
    expect(dates.some((d) => d.kind === "collected" && d.date === "2026-08-18")).toBe(true);
    expect(dates.some((d) => d.kind === "issued" && d.date === "2026-08-20")).toBe(true);
    expect(dates.some((d) => d.remindByDefault)).toBe(true);
  });

  it("normalises AI important_dates and prefers next_due as primary", () => {
    const dates = normalizeImportantDates(
      [
        { label: "Collected", date: "18/08/2026", kind: "collected" },
        { label: "Next due", date: "2026-09-20", kind: "next_due" },
      ],
      "2026-08-20"
    );
    expect(primaryExpiryFromDates(dates)).toBe("2026-09-20");
    expect(dates.length).toBeGreaterThanOrEqual(2);
  });

  it("builds next steps from findings and recommendations", () => {
    const steps = normalizeNextSteps(
      ["Take the shower out of service immediately."],
      ["Arrange system disinfection and risk assessment."],
      "action_required"
    );
    expect(steps).toHaveLength(2);
    expect(steps[0]?.selectedByDefault).toBe(true);
  });

  it("merges model and OCR dates without duplicates", () => {
    const merged = mergeImportantDates(
      normalizeImportantDates([{ label: "Issued", date: "2026-08-20", kind: "issued" }]),
      extractImportantDatesFromOcr("Report issued: 20 August 2026")
    );
    expect(merged.filter((d) => d.date === "2026-08-20")).toHaveLength(1);
  });
});

describe("intakeScanProgress", () => {
  it("rotates messages over time", () => {
    const t0 = 1_000_000;
    const a = intakeScanMessageAt(INTAKE_DOC_SCAN_MESSAGES, t0, t0);
    const b = intakeScanMessageAt(INTAKE_DOC_SCAN_MESSAGES, t0, t0 + 3200);
    expect(a).toBe(INTAKE_DOC_SCAN_MESSAGES[0]);
    expect(b).toBe(INTAKE_DOC_SCAN_MESSAGES[1]);
  });
});

describe("aggregateIntakeScanReview", () => {
  it("groups dates and steps across multiple scanned files", () => {
    const files: PendingIntakeFile[] = [
      {
        local_id: "a",
        file: new File([""], "a.pdf"),
        display_name: "a.pdf",
        file_size: 10,
        file_type: "application/pdf",
        scanStatus: "done",
        scanTitle: "Water Hygiene Laboratory Report",
        scanImportantDates: [
          {
            id: "d1",
            label: "Report issued",
            date: "2026-08-20",
            kind: "issued",
            remindByDefault: false,
          },
        ],
        scanNextSteps: [
          {
            id: "s1",
            text: "Take the shower out of service immediately.",
            selectedByDefault: true,
          },
        ],
        scanOutcome: "action_required",
      },
      {
        local_id: "b",
        file: new File([""], "b.pdf"),
        display_name: "b.pdf",
        file_size: 10,
        file_type: "application/pdf",
        scanStatus: "done",
        scanTitle: "Gas Safety",
        scanImportantDates: [
          {
            id: "d2",
            label: "Expiry",
            date: "2027-01-01",
            kind: "expiry",
            remindByDefault: true,
          },
        ],
        scanNextSteps: [],
      },
    ];
    const review = aggregateIntakeScanReview(files);
    expect(review.fileCountWithScan).toBe(2);
    expect(review.dates.length).toBe(2);
    expect(review.nextSteps.length).toBe(1);
    expect(review.remindersLabel).toMatch(/follow-up|reminders/i);
  });
});
