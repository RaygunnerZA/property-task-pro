import { describe, expect, it } from "vitest";
import {
  claimsFromKnowledgeAttributes,
  claimsForContentGrounding,
  mergeClaimsWithAttributeFallback,
  normalizeKnowledgeClaim,
  normalizeKnowledgeClaims,
} from "@/lib/knowledge/knowledgeClaims";

describe("knowledgeClaims", () => {
  it("drops empty or invented-looking blanks", () => {
    expect(normalizeKnowledgeClaim({ claim_text: "  " })).toBeNull();
    expect(normalizeKnowledgeClaim({ claim_text: "ab" })).toBeNull();
  });

  it("marks unestablished details as unknown instead of extracted facts", () => {
    const claim = normalizeKnowledgeClaim({
      claim_text: "Replacement interval not stated in the source",
      category: "replacement",
      established: false,
    });
    expect(claim?.verification_status).toBe("unknown");
    expect(claim?.category).toBe("unknown");
  });

  it("preserves spreadsheet attributes as extracted claims", () => {
    const claims = claimsFromKnowledgeAttributes({
      legal_status: "Mandatory",
      applies_when: "Specified residential accommodation in France",
      responsible_party: "Occupier for maintenance",
      app_logic: "skip me",
    });
    expect(claims.map((c) => c.category).sort()).toEqual(
      ["applicability", "obligation", "responsibility"].sort()
    );
    expect(claims.every((c) => c.verification_status === "extracted")).toBe(true);
  });

  it("prefers explicit extractor claims over attribute fallback", () => {
    const merged = mergeClaimsWithAttributeFallback(
      [{ text: "Device must meet NF EN 14604", category: "standard" }],
      { legal_status: "Mandatory" }
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].category).toBe("standard");
  });

  it("separates packaging facts from unknown gaps for SEO grounding", () => {
    const claims = normalizeKnowledgeClaims([
      {
        claim_text: "At least one compliant smoke alarm is required",
        category: "obligation",
        verification_status: "verified",
      },
      {
        claim_text: "Replacement interval not stated",
        category: "replacement",
        established: false,
      },
      {
        claim_text: "Still awaiting human verify",
        category: "testing",
        verification_status: "extracted",
      },
    ]);
    const grounded = claimsForContentGrounding(claims);
    expect(grounded.verified).toHaveLength(1);
    expect(grounded.unknown).toHaveLength(1);
  });
});
