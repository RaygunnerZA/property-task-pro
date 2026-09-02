import { describe, expect, it } from "vitest";
import {
  extractImportantDatesFromOcr,
  mergeImportantDates,
  normalizeFindings,
  normalizeImportantDates,
  normalizeRequiredActions,
  primaryActionDeadlineFromDates,
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

  it("extracts corrective deadlines as action_deadline, not next_due", () => {
    const dates = extractImportantDatesFromOcr(
      "Repair required before 31/07/2026. Next inspection 16/07/2027."
    );
    expect(dates.some((d) => d.kind === "action_deadline" && d.date === "2026-07-31")).toBe(true);
    expect(dates.some((d) => d.kind === "next_due" && d.date === "2027-07-16")).toBe(true);
  });

  it("maps model kind synonyms for corrective deadlines", () => {
    const dates = normalizeImportantDates([
      { label: "Repair by", date: "2026-07-31", kind: "corrective_deadline" },
    ]);
    expect(dates[0]?.kind).toBe("action_deadline");
    expect(dates[0]?.remindByDefault).toBe(true);
  });

  it("collapses duplicate interpretations of the same date, keeping the higher-priority kind", () => {
    const merged = mergeImportantDates(
      normalizeImportantDates([{ label: "Next inspection", date: "2027-07-16", kind: "next_due" }]),
      normalizeImportantDates([{ label: "Expiry", date: "2027-07-16", kind: "expiry" }])
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.kind).toBe("expiry");
  });

  it("sorts corrective deadlines ahead of later renewal dates", () => {
    const merged = mergeImportantDates(
      normalizeImportantDates([
        { label: "Next inspection", date: "2027-07-16", kind: "next_due" },
        { label: "Repair by", date: "2026-07-31", kind: "action_deadline" },
        { label: "Inspection date", date: "2026-07-17", kind: "service" },
      ]),
      []
    );
    expect(merged[0]?.kind).toBe("action_deadline");
  });

  it("keeps corrective deadlines out of the record's primary expiry", () => {
    const dates = normalizeImportantDates([
      { label: "Repair by", date: "2026-07-31", kind: "action_deadline" },
      { label: "Next inspection", date: "2027-07-16", kind: "next_due" },
    ]);
    expect(primaryExpiryFromDates(dates)).toBe("2027-07-16");
    expect(primaryActionDeadlineFromDates(dates)).toBe("2026-07-31");
  });

  it("merges model and OCR dates without duplicates", () => {
    const merged = mergeImportantDates(
      normalizeImportantDates([{ label: "Issued", date: "2026-08-20", kind: "issued" }]),
      extractImportantDatesFromOcr("Report issued: 20 August 2026")
    );
    expect(merged.filter((d) => d.date === "2026-08-20")).toHaveLength(1);
  });

  it("classifies findings as pass/fail/info without turning them into actions", () => {
    const findings = normalizeFindings([
      "Overall result: NON CONFORME — anomalie majeure",
      "Emergency lighting: Conforme",
      "Cabin levelling 8 mm acceptable",
      { text: "Machine room access acceptable", status: "pass" },
    ]);
    expect(findings.find((f) => /NON CONFORME/i.test(f.text))?.status).toBe("fail");
    expect(findings.find((f) => /Emergency lighting/.test(f.text))?.status).toBe("pass");
    expect(findings.find((f) => /levelling/.test(f.text))?.status).toBe("pass");
    expect(findings.find((f) => /Machine room/.test(f.text))?.status).toBe("pass");
  });

  it("builds required actions with parsed deadlines and immediate flags", () => {
    const actions = normalizeRequiredActions(
      [
        "Take lift out of service or arrange compensatory surveillance immediately.",
        "Repair emergency communication system before 31/07/2026.",
      ],
      "action_required"
    );
    expect(actions).toHaveLength(2);
    expect(actions[0]?.immediate).toBe(true);
    expect(actions[1]?.deadline).toBe("2026-07-31");
    expect(actions.every((a) => a.selectedByDefault)).toBe(true);
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

function liftInspectionFile(): PendingIntakeFile {
  return {
    local_id: "lift",
    file: new File([""], "lift.pdf"),
    display_name: "lift.pdf",
    file_size: 10,
    file_type: "application/pdf",
    scanStatus: "done",
    scanTitle: "Periodic Lift Inspection — LIFT-02",
    scanOutcome: "action_required",
    scanImportantDates: normalizeImportantDates([
      { label: "Inspection date", date: "2026-07-17", kind: "service" },
      { label: "Repair by", date: "2026-07-31", kind: "action_deadline" },
      { label: "Next inspection", date: "2027-07-16", kind: "next_due" },
      // Duplicate semantic interpretation of the same date — must collapse.
      { label: "Expiry", date: "2027-07-16", kind: "expiry" },
    ]),
    scanFindings: normalizeFindings([
      "Emergency communication system does not reliably connect to the intervention service.",
      "Emergency lighting: Conforme",
      "Cabin levelling 8 mm acceptable",
      "Machine room access acceptable",
    ]),
    scanActions: normalizeRequiredActions(
      [
        "Take lift out of service or arrange compensatory surveillance immediately.",
        "Repair emergency communication system before 31/07/2026.",
      ],
      "action_required"
    ),
  };
}

describe("aggregateIntakeScanReview (lift inspection acceptance case)", () => {
  it("produces a semantic summary: outcome, issue, prioritised dates, confirmable actions", () => {
    const review = aggregateIntakeScanReview([liftInspectionFile()]);

    expect(review.outcomeSeverity).toBe("critical");
    expect(review.outcome).toMatch(/action required/i);
    expect(review.primaryIssue).toMatch(/does not reliably connect/i);

    // 16 Jul 2027 collapsed to one row; corrective deadline listed first.
    expect(review.dates.filter((d) => d.date === "2027-07-16")).toHaveLength(1);
    expect(review.dates[0]?.kind).toBe("action_deadline");
    expect(review.dates[0]?.date).toBe("2026-07-31");
    expect(review.actionDeadline).toBe("2026-07-31");

    // Inspection date retained as a fact, not an action.
    expect(review.dates.some((d) => d.kind === "service" && d.date === "2026-07-17")).toBe(true);

    // Two corrective actions + one renewal reminder, all confirmable.
    const taskActions = review.actions.filter((a) => a.kind === "action");
    const reminders = review.actions.filter((a) => a.kind === "reminder");
    expect(taskActions).toHaveLength(2);
    expect(taskActions[0]?.immediate).toBe(true);
    expect(taskActions[1]?.deadline).toBe("2026-07-31");
    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.deadline).toBe("2027-07-16");

    // Conforming observations recorded but separated from the primary issue.
    expect(review.failFindings.length).toBeGreaterThanOrEqual(1);
    expect(review.otherFindings.length).toBeGreaterThanOrEqual(3);
  });

  it("still aggregates simple renewal documents into a reminder action", () => {
    const files: PendingIntakeFile[] = [
      {
        local_id: "gas",
        file: new File([""], "gas.pdf"),
        display_name: "gas.pdf",
        file_size: 10,
        file_type: "application/pdf",
        scanStatus: "done",
        scanTitle: "Gas Safety",
        scanImportantDates: normalizeImportantDates([
          { label: "Expiry", date: "2027-01-01", kind: "expiry" },
        ]),
      },
    ];
    const review = aggregateIntakeScanReview(files);
    expect(review.fileCountWithScan).toBe(1);
    expect(review.outcomeSeverity).toBeNull();
    expect(review.actions).toHaveLength(1);
    expect(review.actions[0]?.kind).toBe("reminder");
    expect(review.actions[0]?.deadline).toBe("2027-01-01");
  });
});
