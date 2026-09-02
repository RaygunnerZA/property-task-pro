import { describe, expect, it } from "vitest";
import { hintsFromImageAnalysis } from "@/lib/hintsFromImageAnalysis";

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

  it("does not treat OCR-labelled collected/issued dates as primary expiry", () => {
    const hints = hintsFromImageAnalysis({
      ocr_text: "Collected: 20/08/2026\nReceived: 21/08/2026\nReport issued: 22/08/2026",
      document_classification: {
        type: "Water Hygiene Laboratory Report",
        expiry_date: "2026-08-20",
      },
      metadata: {
        normalized_document_type: "Water Hygiene Laboratory Report",
        normalized_expiry: "2026-08-20",
      },
    });
    expect(hints.documentType).toBe("Water Hygiene Laboratory Report");
    expect(hints.expiryDate).toBeNull();
  });

  it("prefers next-due from important_dates over a mislabelled classification expiry", () => {
    const hints = hintsFromImageAnalysis({
      ocr_text: "",
      document_classification: {
        type: "Water Hygiene Laboratory Report",
        expiry_date: "2026-08-20",
      },
      metadata: {
        important_dates: [
          { label: "Collected", date: "2026-08-20", kind: "collected" },
          { label: "Next due", date: "2026-11-20", kind: "next_due" },
        ],
      },
    });
    expect(hints.expiryDate).toBe("2026-11-20");
  });
});
