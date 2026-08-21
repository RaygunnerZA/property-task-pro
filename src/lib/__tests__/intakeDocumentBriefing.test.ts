import { describe, expect, it } from "vitest";
import {
  buildIntakeDocumentBriefing,
  humanizeIntakeFileStem,
  inferOutcomeFromText,
  intakeInboxCardCopy,
} from "@/lib/intakeDocumentBriefing";
import { wordXmlToText } from "@/lib/officeDocumentText";
import type { IntakeSourceArtifact } from "@/types/intake-item";

function artifact(partial: Partial<IntakeSourceArtifact>): IntakeSourceArtifact {
  return {
    intakeItemId: "item-1",
    storagePath: "org/x/file.docx",
    fileName: "03_electrical_condition_report_unsatisfactory.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    aiClassification: "EICR",
    aiExtracted: {
      title: "03_electrical_condition_report_unsatisfactory",
      document_type: "EICR",
      confidence: 0.3,
      metadata: { stub: true },
    },
    ...partial,
  };
}

describe("intake document briefing", () => {
  it("humanizes indexed filenames and strips outcome words from the title", () => {
    expect(humanizeIntakeFileStem("03_electrical_condition_report_unsatisfactory.docx")).toBe(
      "Electrical Condition Report Unsatisfactory"
    );
  });

  it("reads unsatisfactory from the filename even when AI only stubbed EICR", () => {
    const briefing = buildIntakeDocumentBriefing(artifact({}));
    expect(briefing.documentType).toBe("EICR");
    expect(briefing.outcome).toBe("unsatisfactory");
    expect(briefing.needsFollowUp).toBe(true);
    expect(briefing.title.toLowerCase()).toContain("electrical");
    expect(briefing.title.toLowerCase()).not.toContain("unsatisfactory");
    expect(briefing.summary.toLowerCase()).toContain("unsatisfactory");
    expect(briefing.provenance).toBe("filename");
  });

  it("treats extracted Word text as a real document read", () => {
    const briefing = buildIntakeDocumentBriefing(
      artifact({}),
      "ELECTRICAL INSTALLATION CONDITION REPORT\nOverall assessment: Unsatisfactory\nC2 defects require remedial action."
    );
    expect(briefing.provenance).toBe("document");
    expect(briefing.excerpt).toMatch(/Unsatisfactory/);
  });

  it("surfaces at least one document insight on pending-review cards", () => {
    const eicr = intakeInboxCardCopy({
      id: "1",
      storage_path: "p",
      file_name: "03_electrical_condition_report_unsatisfactory.docx",
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      raw_text: null,
      ai_classification: "EICR",
      ai_extracted: { document_type: "EICR", metadata: { stub: true } },
      status: "ready",
    });
    expect(eicr.insight.toLowerCase()).toContain("unsatisfactory");

    const invoice = intakeInboxCardCopy({
      id: "2",
      storage_path: "p",
      file_name: "JustinPlunkett_Design Invoice-ZAG 5.docx.pdf",
      mime_type: "application/pdf",
      raw_text: null,
      ai_classification: "Misc",
      ai_extracted: { document_type: "Other", metadata: { stub: true } },
      status: "ready",
    });
    expect(invoice.insight.toLowerCase()).toContain("invoice");

    const photo = intakeInboxCardCopy({
      id: "3",
      storage_path: "p",
      file_name: "$.57.JPG",
      mime_type: "image/jpeg",
      raw_text: null,
      ai_classification: "uncertain",
      ai_extracted: null,
      status: "ready",
    });
    expect(photo.insight.length).toBeGreaterThan(8);
    expect(photo.title.toLowerCase()).not.toContain("uncertain");
  });
});

describe("inferOutcomeFromText", () => {
  it("detects inspection outcomes", () => {
    expect(inferOutcomeFromText("report unsatisfactory C2")).toBe("unsatisfactory");
    expect(inferOutcomeFromText("overall satisfactory")).toBe("satisfactory");
  });
});

describe("wordXmlToText", () => {
  it("turns Word XML into readable paragraphs", () => {
    const xml =
      "<w:p><w:r><w:t>Electrical Installation Condition Report</w:t></w:r></w:p><w:p><w:r><w:t>Unsatisfactory</w:t></w:r></w:p>";
    expect(wordXmlToText(xml)).toBe("Electrical Installation Condition Report\nUnsatisfactory");
  });
});
