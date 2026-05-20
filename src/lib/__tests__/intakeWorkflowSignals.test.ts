import { describe, it, expect } from "vitest";
import {
  isMeaningfulSuggestedType,
  textHasIssueSignals,
  textHasComplianceDocumentSignals,
  labelsSuggestComplianceDocument,
} from "@/lib/intakeWorkflowSignals";

describe("intakeWorkflowSignals", () => {
  it("rejects meaningless suggested types", () => {
    expect(isMeaningfulSuggestedType("None")).toBe(false);
    expect(isMeaningfulSuggestedType("unknown")).toBe(false);
    expect(isMeaningfulSuggestedType("Gas Safety Certificate")).toBe(true);
  });

  it("detects issue signals", () => {
    expect(textHasIssueSignals("leaking boiler")).toBe(true);
    expect(textHasIssueSignals("boiler room")).toBe(false);
  });

  it("does not treat equipment labels alone as compliance", () => {
    expect(labelsSuggestComplianceDocument("boiler pipe hvac")).toBe(false);
    expect(labelsSuggestComplianceDocument("gas safe certificate")).toBe(true);
  });

  it("detects compliance text in OCR", () => {
    expect(textHasComplianceDocumentSignals("Gas Safety Certificate expiry 2025")).toBe(true);
    expect(textHasComplianceDocumentSignals("wall mounted boiler")).toBe(false);
  });
});
