import { describe, expect, it } from "vitest";
import {
  hasReviewableKnowledgeBody,
  isOpaqueKnowledgeTitle,
  titleFromResearchContext,
} from "../../../../supabase/functions/_shared/knowledgeTitleQuality.ts";

describe("knowledgeTitleQuality", () => {
  it("flags filename and path stubs", () => {
    expect(isOpaqueKnowledgeTitle("fr.txt")).toBe(true);
    expect(isOpaqueKnowledgeTitle("F20744.txt")).toBe(true);
    expect(isOpaqueKnowledgeTitle("fr")).toBe(true);
    expect(isOpaqueKnowledgeTitle("F20744")).toBe(true);
    expect(isOpaqueKnowledgeTitle("Chimney sweeping — France")).toBe(false);
    expect(isOpaqueKnowledgeTitle("Landlord responsibilities")).toBe(false);
  });

  it("resolves a human title from research context", () => {
    expect(
      titleFromResearchContext({
        proposalTitle: "fr.txt",
        sourceTitle: "Approved Document J",
        topic: "Chimney and flue sweeping",
        jurisdiction: "England",
      })
    ).toBe("Approved Document J");

    expect(
      titleFromResearchContext({
        proposalTitle: "F20744.txt",
        topic: "Before the heating season",
        jurisdiction: "France",
      })
    ).toBe("Before the heating season — France");

    expect(
      titleFromResearchContext({
        proposalTitle: "landlords-duties.htm",
        sourceTitle: "Landlords' duties",
        sourceUrl: "https://www.hse.gov.uk/gas/landlords/landlords-duties.htm",
        topic: "Before the heating season",
        jurisdiction: "England",
      })
    ).toBe("Landlord gas-appliance and flue maintenance — England");
  });

  it("requires reviewable body substance", () => {
    expect(hasReviewableKnowledgeBody({ summary: null, body: null })).toBe(false);
    expect(
      hasReviewableKnowledgeBody({
        summary: "Short",
        body: "Still too short",
      })
    ).toBe(false);
    expect(
      hasReviewableKnowledgeBody({
        summary:
          "Chimneys and flue-pipes should be swept at least annually when smokeless solid fuel is burnt.",
        body: null,
      })
    ).toBe(true);
  });
});
