import { describe, it, expect } from "vitest";
import type { TempImage } from "@/types/temp-image";
import { deriveIntakeWorkflow } from "@/hooks/useIntakeAnalysis";

function makeImage(partial: Partial<TempImage>): TempImage {
  return {
    local_id: "img-1",
    display_name: "photo.jpg",
    thumbnail_blob: new Blob([], { type: "image/webp" }),
    upload_status: "pending",
    ...partial,
  } as TempImage;
}

describe("deriveIntakeWorkflow", () => {
  it("A: Report Issue + boiler equipment metadata does not suggest compliance", () => {
    const result = deriveIntakeWorkflow(
      [
        makeImage({
          rawAnalysis: {
            ocr_text: "",
            detected_labels: ["boiler", "pipe", "hvac"],
            detected_objects: [{ type: "boiler", label: "Boiler", confidence: 0.9 }],
            metadata: {
              router_mode: false,
              intake_stage: "full",
              normalized_document_type: "None",
              document_classification: { type: "None" },
            },
          },
        }),
      ],
      0,
      "",
      false,
      "report_issue"
    );

    expect(result.hasStrongDocumentEvidence).toBe(false);
    expect(result.hint).not.toBe("compliance");
    expect(result.confidence).toBeLessThan(0.8);
  });

  it("A2: Report Issue + leaking in OCR biases to task with issue signals", () => {
    const result = deriveIntakeWorkflow(
      [
        makeImage({
          aiOcrText: "Water leaking from boiler pipe connection",
          rawAnalysis: {
            ocr_text: "Water leaking from boiler pipe connection",
            detected_labels: ["boiler", "leak"],
            detected_objects: [],
            metadata: { router_mode: true, workflow_hint: "compliance", workflow_confidence: 0.9 },
          },
        }),
      ],
      0,
      "",
      false,
      "report_issue"
    );

    expect(result.hasIssueSignals).toBe(true);
    expect(result.hint).toBe("task");
  });

  it("B: Report Issue + gas safety certificate signals strong document evidence", () => {
    const result = deriveIntakeWorkflow(
      [
        makeImage({
          display_name: "gas-safety-certificate-2024.pdf",
          aiOcrText: "Gas Safety Certificate expiry 2025-04-01",
          rawAnalysis: {
            ocr_text: "Gas Safety Certificate expiry 2025-04-01",
            detected_labels: ["certificate", "gas safe"],
            detected_objects: [],
            metadata: {
              router_mode: true,
              workflow_hint: "compliance",
              workflow_confidence: 0.92,
              normalized_document_type: "Gas Safety Certificate",
            },
          },
        }),
      ],
      0,
      "",
      false,
      "report_issue"
    );

    expect(result.hasStrongDocumentEvidence).toBe(true);
    expect(result.hasIssueSignals).toBe(false);
    expect(result.hint).toBe("compliance");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("D: Add Record + broken pipe issue signals suggest task path", () => {
    const result = deriveIntakeWorkflow(
      [
        makeImage({
          aiOcrText: "Broken pipe with water damage",
          rawAnalysis: {
            ocr_text: "Broken pipe with water damage",
            detected_labels: ["pipe", "damage"],
            detected_objects: [],
            metadata: { router_mode: true, workflow_hint: "task", workflow_confidence: 0.85 },
          },
        }),
      ],
      0,
      "",
      false,
      "add_record"
    );

    expect(result.hasIssueSignals).toBe(true);
    expect(result.hasStrongDocumentEvidence).toBe(false);
    expect(result.hint).toBe("task");
  });

  it("E: Report Issue + boiler only stays task/uncertain without compliance banner signals", () => {
    const result = deriveIntakeWorkflow(
      [
        makeImage({
          rawAnalysis: {
            ocr_text: "",
            detected_labels: ["boiler"],
            detected_objects: [{ type: "boiler", label: "Boiler" }],
            metadata: {
              router_mode: true,
              workflow_hint: "compliance",
              workflow_confidence: 0.7,
            },
          },
        }),
      ],
      0,
      "",
      false,
      "report_issue"
    );

    expect(result.hasStrongDocumentEvidence).toBe(false);
    expect(["task", "uncertain"]).toContain(result.hint);
  });
});
