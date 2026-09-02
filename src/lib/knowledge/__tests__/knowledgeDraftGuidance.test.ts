import { describe, expect, it } from "vitest";
import {
  needsGuidanceGeneration,
  resolveImportedDraftGuidance,
} from "@/lib/knowledge/knowledgeDraftGuidance";
import { applyColumnMapping, suggestColumnMapping } from "@/lib/knowledge/knowledgeColumnMapping";

describe("resolveImportedDraftGuidance", () => {
  it("prefers existing summary over action", () => {
    const r = resolveImportedDraftGuidance({
      summary: "Keep trees protected before works.",
      body: null,
      attributes: { action: "Something else" },
    });
    expect(r.summary).toMatch(/trees protected/i);
    expect(r.source).toBe("summary");
    expect(r.isDraft).toBe(false);
  });

  it("promotes owner action when summary/body empty", () => {
    const r = resolveImportedDraftGuidance({
      summary: "1087",
      body: "1058",
      attributes: {
        action: "Check TPO status before pruning or felling",
      },
    });
    expect(r.summary).toMatch(/TPO/i);
    expect(r.source).toBe("imported_action");
    expect(r.isDraft).toBe(true);
    expect(r.supportedBy).toContain("attributes.action");
  });

  it("never uses URLs or IDs as guidance", () => {
    expect(
      resolveImportedDraftGuidance({
        summary: "https://www.gov.uk/guidance/trees",
        attributes: { action: "PM-UK-TREE-001" },
      }).isEmpty
    ).toBe(true);
  });

  it("marks empty when nothing usable", () => {
    expect(
      needsGuidanceGeneration({
        summary: null,
        body: null,
        attributes: { requirement_id: "FR-WATER-001" },
      })
    ).toBe(true);
  });
});

describe("applyColumnMapping draft promotion", () => {
  it("fills summary from Owner action for TREE/OIL style rows", () => {
    const headers = ["Title", "Owner action", "Guidance", "Official Source URL", "Country"];
    const mapping = suggestColumnMapping(headers);
    const drafts = applyColumnMapping(
      {
        headers,
        rows: [
          [
            "PM-UK-TREE-001",
            "Check protection status before tree work",
            "1087",
            "https://www.gov.uk/guidance/tree-preservation-orders-and-trees-in-conservation-areas",
            "GB-ENG",
          ],
          [
            "PM-UK-OIL-001",
            "Inspect tank, bund and pipework for leaks",
            "1058",
            "https://www.gov.uk/guidance/storing-oil-at-home",
            "GB-ENG",
          ],
          [
            "Private sanitation / SPANC",
            "Maintain and allow SPANC inspection",
            "",
            "https://www.service-public.fr/particuliers/vosdroits/F447",
            "FR",
          ],
          [
            "Rainwater network separation",
            "Keep complete separation from potable network",
            "",
            "https://www.service-public.fr/particuliers/vosdroits/F31481",
            "FR",
          ],
        ],
      },
      mapping
    );

    const tree = drafts.find((d) => d.title.includes("TREE"));
    const oil = drafts.find((d) => d.title.includes("OIL"));
    const septic = drafts.find((d) => d.title.includes("SPANC"));
    const water = drafts.find((d) => d.title.includes("Rainwater"));

    expect(tree?.summary).toMatch(/protection status/i);
    expect(tree?.provenance.guidance_draft?.source).toBe("imported_action");
    expect(oil?.summary).toMatch(/Inspect tank/i);
    expect(septic?.summary).toMatch(/SPANC/i);
    expect(water?.summary).toMatch(/separation/i);
    expect(tree?.provenance.source_url).toMatch(/gov\.uk/);
  });
});
