import { describe, expect, it } from "vitest";
import {
  isIntakeCompliancePreset,
  inferExpiryFromOcrText,
  hintsFromImageAnalysis,
  mapIntakeDocumentType,
  normalizeIntakeExpiryDate,
  sanitizeScanTitle,
} from "@/lib/mapIntakeDocumentType";

describe("mapIntakeDocumentType", () => {
  it("maps aliases onto Add Record presets", () => {
    expect(mapIntakeDocumentType("eicr")?.type).toBe("EICR");
    expect(mapIntakeDocumentType("Gas Safe")?.isOther).toBe(false);
    expect(mapIntakeDocumentType("CP12")?.type).toBe("Gas Safety Certificate");
    expect(mapIntakeDocumentType("portable appliance test")?.type).toBe("PAT Test");
  });

  it("keeps unknown meaningful types as custom Other text", () => {
    const mapped = mapIntakeDocumentType("Heat Pump Service Invoice");
    expect(mapped).toEqual({ type: "Heat Pump Service Invoice", isOther: true });
    expect(isIntakeCompliancePreset(mapped!.type)).toBe(false);
  });

  it("ignores meaningless model output instead of inventing a type", () => {
    expect(mapIntakeDocumentType("none")).toBeNull();
    expect(mapIntakeDocumentType("unknown")).toBeNull();
    expect(mapIntakeDocumentType("  ")).toBeNull();
  });
});

describe("normalizeIntakeExpiryDate", () => {
  it("keeps ISO dates and converts UK numeric dates without inventing", () => {
    expect(normalizeIntakeExpiryDate("2027-04-01")).toBe("2027-04-01");
    expect(normalizeIntakeExpiryDate("01/04/2027")).toBe("2027-04-01");
    expect(normalizeIntakeExpiryDate("01/03/26")).toBe("2026-03-01");
    expect(normalizeIntakeExpiryDate("1 Mar 2026")).toBe("2026-03-01");
    expect(normalizeIntakeExpiryDate("not-a-date")).toBeNull();
    expect(normalizeIntakeExpiryDate("1800-01-01")).toBeNull();
    expect(normalizeIntakeExpiryDate("32/01/2027")).toBeNull();
  });

  it("swaps to month-first only when the UK reading is impossible", () => {
    expect(normalizeIntakeExpiryDate("01/13/2027")).toBe("2027-01-13");
  });
});

describe("inferExpiryFromOcrText", () => {
  it("reads next-due from a service certificate table, not the service date", () => {
    const ocr = `
      FIRE EXTINGUISHER SERVICE CERTIFICATE
      Service date            04/05/26
      Next service due        04/05/27
    `;
    expect(inferExpiryFromOcrText(ocr)).toBe("2027-05-04");
  });

  it("does not treat an unlabeled date as expiry", () => {
    expect(inferExpiryFromOcrText("Printed 01/03/26")).toBeNull();
  });
});

describe("hintsFromImageAnalysis", () => {
  it("reads top-level classification the edge function actually returns", () => {
    const hints = hintsFromImageAnalysis({
      ocr_text: "",
      metadata: {
        normalized_expiry: "04/05/27",
        normalized_document_type: "Fire Extinguisher Service Certificate",
      },
      document_classification: {
        type: "Fire Extinguisher Service Certificate",
        expiry_date: "04/05/27",
      },
    });
    expect(hints.documentType).toBe("Fire Extinguisher Service Certificate");
    expect(hints.expiryDate).toBe("2027-05-04");
  });
});

describe("sanitizeScanTitle", () => {
  it("trims and bounds titles without fabricating them", () => {
    expect(sanitizeScanTitle("  Heat pump service invoice  ")).toBe("Heat pump service invoice");
    expect(sanitizeScanTitle("ab")).toBeNull();
  });
});
