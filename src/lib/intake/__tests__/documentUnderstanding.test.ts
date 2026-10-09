import { describe, expect, it } from "vitest";
import { buildIntakeDocumentBriefing } from "@/lib/intakeDocumentBriefing";
import { decideIntake } from "@/lib/intake/intakeDecision";
import { interpretDocument } from "@/lib/intake/documentUnderstanding";
import type { IntakeSourceArtifact } from "@/types/intake-item";

const AS_OF = new Date(2026, 9, 7);
const GREYSKULL = {
  propertyName: "Greyskull",
  propertyAddress: "23 The Boltons, London SW10 9SU",
  asOf: AS_OF,
};

function artifact(partial: Partial<IntakeSourceArtifact>): IntakeSourceArtifact {
  return {
    intakeItemId: "item-1",
    storagePath: "org/x/file.pdf",
    fileName: "certificate.pdf",
    mimeType: "application/pdf",
    aiClassification: null,
    aiExtracted: null,
    ...partial,
  };
}

function read(text: string, fileName = "certificate.pdf") {
  return buildIntakeDocumentBriefing(
    artifact({
      fileName,
      aiExtracted: { metadata: { stub: true }, ocr_text: text, outcome: "valid" },
    }),
    null,
    GREYSKULL
  );
}

describe("document understanding", () => {
  it("A. treats a current certificate as valid when nothing contradicts it", () => {
    const briefing = read(
      [
        "Energy Performance Certificate",
        "Property: 23 The Boltons, London",
        "Assessment date: 12 March 2024",
        "Certificate valid until: 11 March 2034",
      ].join("\n"),
      "epc.pdf"
    );
    expect(briefing.outcome).toBe("valid");
    expect(briefing.expiryDate).toBe("2034-03-11");
    expect(briefing.understanding.applicability).toBe("matches");
    expect(briefing.understanding.statusLabel).toBeNull();
    expect(briefing.summary.toLowerCase()).not.toContain("this is an");
    expect(briefing.summary.toLowerCase()).toContain("current certificate");
  });

  it("does not recap an unsatisfactory outcome; it says what that means", () => {
    const briefing = read(
      [
        "Electrical Installation Condition Report",
        "Property: 23 The Boltons, London",
        "Overall assessment: Unsatisfactory",
        "C2 observation recorded at the consumer unit; remedial work required.",
      ].join("\n"),
      "eicr.pdf"
    );
    expect(briefing.outcome).toBe("unsatisfactory");
    expect(briefing.summary.toLowerCase()).not.toContain("the outcome is");
    expect(briefing.summary.toLowerCase()).toContain("c2");
    expect(briefing.summary.toLowerCase()).toContain("remedial");
  });

  it("B. does not treat a future date as validity when the document says it is not valid", () => {
    const briefing = read(
      [
        "SYNTHETIC TEST DOCUMENT - NOT VALID",
        "Energy Performance Certificate",
        "18 Birch Lane, Bristol, BS6 4QJ",
        "Certificate valid until: 11 March 2034",
      ].join("\n"),
      "04_energy_performance_certificate_valid.pdf"
    );
    expect(briefing.outcome).not.toBe("valid");
    expect(briefing.expiryDate).toBeNull();
    expect(briefing.understanding.statusLabel).toBe("Not valid");
    expect(briefing.understanding.withheldExpiry).toBe("2034-03-11");
    expect(briefing.understanding.contradictions.join(" ").toLowerCase()).toContain("not valid");
    expect(briefing.summary.toLowerCase()).not.toContain("appears current");
  });

  it("C. marks an applicable certificate expired when the valid-until date has passed", () => {
    const briefing = read(
      [
        "Energy Performance Certificate",
        "Property: 23 The Boltons, London",
        "Certificate valid until: 1 January 2020",
      ].join("\n")
    );
    expect(briefing.outcome).toBe("expired");
    expect(briefing.expiryDate).toBe("2020-01-01");
  });

  it("D. does not treat a draft as a final certificate", () => {
    const briefing = read(
      ["DRAFT", "Energy Performance Certificate", "Certificate valid until: 11 March 2034"].join("\n")
    );
    expect(briefing.outcome).not.toBe("valid");
    expect(briefing.expiryDate).toBeNull();
    expect(briefing.understanding.statusLabel).toBe("Draft");
  });

  it("E. keeps a superseded document from being the current record", () => {
    const briefing = read(
      [
        "SUPERSEDED",
        "This certificate is replaced by the 2025 EPC.",
        "Energy Performance Certificate",
        "Certificate valid until: 11 March 2034",
      ].join("\n")
    );
    expect(briefing.outcome).not.toBe("valid");
    expect(briefing.expiryDate).toBeNull();
    expect(briefing.understanding.statusLabel).toBe("Superseded");
    expect(briefing.understanding.authority).toBe("superseded");
  });

  it("F. does not apply a different property's certificate to Greyskull", () => {
    const briefing = read(
      [
        "Energy Performance Certificate",
        "18 Birch Lane, Bristol",
        "Certificate valid until: 11 March 2034",
      ].join("\n")
    );
    expect(briefing.understanding.applicability).toBe("other");
    expect(briefing.outcome).not.toBe("valid");
    expect(briefing.expiryDate).toBeNull();
    const decision = decideIntake({ briefing, mimeType: "application/pdf" });
    expect(decision.recommended_action).toBe("ask");
    expect(decision.clarifying_question).toMatch(/different property/i);
  });

  it("G. records a warranty mentioned on an invoice without calling the invoice a warranty", () => {
    const text = "Invoice 1042. Includes replacement pump with five-year manufacturer warranty.";
    const briefing = read(text, "invoice.pdf");
    expect(briefing.documentType).toBe("Invoice");
    expect(briefing.documentType?.toLowerCase()).not.toContain("warrant");
    expect(briefing.understanding.warrantyStatement?.toLowerCase()).toContain("warranty");
    expect(briefing.summary.toLowerCase()).toContain("invoice");
  });

  it("H. does not treat required servicing as a completed service", () => {
    const understood = interpretDocument({
      text: "Service report\nBoiler requires servicing.",
      asOf: AS_OF,
    });
    expect(understood.serviceCompletedOn).toBeNull();
    expect(understood.promotedOutcome).not.toBe("satisfactory");
    expect(understood.summary.toLowerCase()).toContain("required");
  });

  it("I. can record a completed service when the document says the work was done", () => {
    const understood = interpretDocument({
      text: "Service report\nProperty: 23 The Boltons\nAnnual boiler service completed on 12 September 2026.",
      propertyAddress: GREYSKULL.propertyAddress,
      asOf: AS_OF,
    });
    expect(understood.serviceCompletedOn).toBe("2026-09-12");
    expect(understood.applicability).toBe("matches");
  });

  it("J. does not use a previous certificate's date as this document's expiry", () => {
    const briefing = read(
      [
        "Energy Performance Certificate",
        "Property: 23 The Boltons, London",
        "The previous certificate was valid until 30 June 2024.",
      ].join("\n")
    );
    expect(briefing.expiryDate).not.toBe("2024-06-30");
    expect(briefing.expiryDate).toBeNull();
    expect(briefing.outcome).not.toBe("expired");

    const both = read(
      [
        "Energy Performance Certificate",
        "Property: 23 The Boltons, London",
        "The previous certificate was valid until 30 June 2024.",
        "Certificate valid until: 11 March 2034",
      ].join("\n")
    );
    expect(both.expiryDate).toBe("2034-03-11");
    expect(both.outcome).toBe("valid");
  });
});
