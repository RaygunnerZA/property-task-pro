import { describe, expect, it } from "vitest";
import { buildIntakeDocumentBriefing } from "@/lib/intakeDocumentBriefing";
import { decideIntake } from "@/lib/intake/intakeDecision";
import type { IntakeSourceArtifact } from "@/types/intake-item";

function artifact(partial: Partial<IntakeSourceArtifact>): IntakeSourceArtifact {
  return {
    intakeItemId: "item-1",
    storagePath: "org/x/file",
    fileName: "upload.bin",
    mimeType: "application/octet-stream",
    aiClassification: null,
    aiExtracted: null,
    ...partial,
  };
}

describe("decideIntake", () => {
  it("does not treat a filename EPC as understood while the file is still being read", () => {
    const briefing = buildIntakeDocumentBriefing(
      artifact({
        fileName: "04_energy_performance_certificate_valid.pdf",
        mimeType: "application/pdf",
        aiExtracted: { metadata: { stub: true }, outcome: "valid" },
      })
    );
    const decision = decideIntake({ briefing, mimeType: "application/pdf", scanStillRunning: true });
    expect(briefing.typeEvidence).toBe("filename");
    expect(decision.action_confidence).toBe("insufficient");
    expect(decision.recommended_action).toBe("ask");
    expect(decision.understanding.evidence).toBe("filename");
    expect(decision.reason.toLowerCase()).toContain("file name");
  });

  it("asks before filing a filename-only EPC once reading has finished", () => {
    const briefing = buildIntakeDocumentBriefing(
      artifact({
        fileName: "04_energy_performance_certificate_valid.pdf",
        mimeType: "application/pdf",
        aiExtracted: { metadata: { stub: true }, outcome: "valid" },
      })
    );
    const decision = decideIntake({ briefing, mimeType: "application/pdf", scanStillRunning: false });
    expect(decision.action_confidence).toBe("ambiguous");
    expect(decision.clarifying_question).toMatch(/energy performance certificate/i);
    expect(decision.recommended_action).toBe("ask");
  });

  it("files an EPC once the document text supports it", () => {
    const briefing = buildIntakeDocumentBriefing(
      artifact({
        fileName: "04_energy_performance_certificate_valid.pdf",
        mimeType: "application/pdf",
        aiExtracted: {
          metadata: { stub: true },
          ocr_text: "Energy Performance Certificate\nCertificate valid until: 11 March 2034",
        },
      })
    );
    const decision = decideIntake({ briefing, mimeType: "application/pdf" });
    expect(decision.action_confidence).toBe("sufficient");
    expect(decision.recommended_action).toBe("file_record");
    expect(decision.alternative_actions).toContain("create_task");
    expect(decision.alternative_actions[0]).not.toBe(decision.recommended_action);
  });

  it("asks to confirm an asbestos register found in a short extract", () => {
    const briefing = buildIntakeDocumentBriefing(
      artifact({
        fileName: "07_asbestos_register_mixed_risk.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        aiClassification: "unclear",
        aiExtracted: {
          document_type: "unclear",
          summary: "This is an unclear.",
          ocr_text: "Asbestos register",
        },
      })
    );
    expect(briefing.summary.toLowerCase()).not.toContain("this is an unclear");
    expect(briefing.typeEvidence).toBe("inference");
    const decision = decideIntake({
      briefing,
      mimeType: artifact({}).mimeType,
      allowKnowledge: true,
    });
    expect(decision.action_confidence).toBe("ambiguous");
    expect(decision.clarifying_question).toMatch(/asbestos register/i);
    expect(decision.clarifying_options.map((option) => option.label)).toEqual([
      "Yes, asbestos register",
      "Something else",
    ]);
  });

  it("asks what an unidentified photo is", () => {
    const briefing = buildIntakeDocumentBriefing(
      artifact({
        fileName: "$_57.JPG",
        mimeType: "image/jpeg",
        aiClassification: "uncertain",
        aiExtracted: null,
      })
    );
    const decision = decideIntake({ briefing, mimeType: "image/jpeg" });
    expect(decision.action_confidence).toBe("insufficient");
    expect(decision.clarifying_question).toBe("What is this?");
    expect(decision.clarifying_options.map((option) => option.action)).toEqual([
      "file_record",
      "create_task",
    ]);
  });
});
