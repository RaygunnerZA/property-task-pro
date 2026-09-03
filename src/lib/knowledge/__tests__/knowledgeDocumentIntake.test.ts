import { describe, expect, it } from "vitest";
import {
  proposalsFromDocAnalysis,
  isKnowledgeDocumentFile,
  isSpreadsheetFile,
  type KnowledgeSourceProvenance,
} from "@/lib/knowledge/knowledgeDocumentIntake";

const source: KnowledgeSourceProvenance = {
  source_document: "guide.pdf",
  retrieved_date: "2026-08-24T00:00:00.000Z",
  intake_mode: "upload",
  extractor: "ai-doc-analyse",
};

describe("knowledgeDocumentIntake", () => {
  it("prefers model knowledge_proposals when present", () => {
    const proposals = proposalsFromDocAnalysis(
      {
        title: "Doc title",
        knowledge_proposals: [
          { title: "Fact A", summary: "One", body: "Detail A" },
          { title: "Fact B", summary: "Two", body: "Detail B" },
        ],
      },
      source
    );
    expect(proposals).toHaveLength(2);
    expect(proposals[0].title).toBe("Fact A");
    expect(proposals[1].title).toBe("Fact B");
    expect(proposals[0].provenance.source_document).toBe("guide.pdf");
    expect(proposals[0].selected).toBe(true);
  });

  it("preserves extractor claims including explicit unknowns", () => {
    const proposals = proposalsFromDocAnalysis(
      {
        knowledge_proposals: [
          {
            title: "Smoke alarms — France",
            summary: "Residential smoke alarm duties",
            claims: [
              {
                text: "At least one compliant smoke alarm is required",
                category: "obligation",
                established: true,
              },
              {
                text: "Replacement interval not stated",
                category: "replacement",
                established: false,
              },
            ],
          },
        ],
      },
      source
    );
    expect(proposals[0].claims).toHaveLength(2);
    expect(proposals[0].claims[0].verification_status).toBe("extracted");
    expect(proposals[0].claims[1].verification_status).toBe("unknown");
  });

  it("splits recommendations into separate candidates when main row exists", () => {
    const proposals = proposalsFromDocAnalysis(
      {
        title: "Inspection report",
        findings: ["Gas meter must be accessible at all times for safety checks"],
        compliance_recommendations: ["Install CO alarm in every habitable room annually"],
      },
      source
    );
    expect(proposals.length).toBeGreaterThanOrEqual(2);
    const combined = proposals.map((p) => `${p.title} ${p.body}`).join(" ");
    expect(combined).toMatch(/Gas meter/i);
    expect(combined).toMatch(/CO alarm/i);
  });

  it("caps at eight proposals", () => {
    const proposals = proposalsFromDocAnalysis(
      {
        knowledge_proposals: Array.from({ length: 12 }, (_, i) => ({
          title: `Item ${i}`,
          body: "x",
        })),
      },
      source
    );
    expect(proposals).toHaveLength(8);
  });

  it("classifies upload file types", () => {
    expect(isSpreadsheetFile(new File(["a"], "data.csv", { type: "text/csv" }))).toBe(true);
    expect(isSpreadsheetFile(new File(["a"], "book.xlsx"))).toBe(true);
    expect(isKnowledgeDocumentFile(new File(["a"], "doc.pdf"))).toBe(true);
    expect(isKnowledgeDocumentFile(new File(["a"], "photo.jpg"))).toBe(true);
    expect(isKnowledgeDocumentFile(new File(["a"], "data.csv"))).toBe(false);
  });
});
