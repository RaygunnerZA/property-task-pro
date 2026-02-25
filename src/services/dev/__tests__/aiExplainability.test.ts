/**
 * AI Explainability — Unit Tests
 *
 * Run: npx vitest src/services/dev/__tests__/aiExplainability.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  explainComplianceSuggestion,
  explainChipBoost,
  explainWarnings,
  explainFullProfile,
  handleDevQuestion,
} from "../aiExplainability";
import { normalizePropertyProfile } from "@/services/propertyIntelligence/ruleEvaluator";

const commercialProfile = normalizePropertyProfile({
  propertyId: "p1",
  siteType: "commercial",
  ownershipType: "leased",
  presentAssetTypes: ["Boiler", "HVAC Units", "Passenger Lifts"],
});

const residentialProfile = normalizePropertyProfile({
  propertyId: "p2",
  siteType: "residential",
  ownershipType: "leased",
  presentAssetTypes: ["Boiler"],
});

const listedProfile = normalizePropertyProfile({
  propertyId: "p3",
  siteType: "commercial",
  ownershipType: "owned",
  isListed: true,
  listingGrade: "II*",
});

describe("explainComplianceSuggestion", () => {
  it("explains a suggested compliance type with rationale", () => {
    const result = explainComplianceSuggestion("Gas Safety", commercialProfile);
    expect(result.answer).toContain("Gas Safety");
    expect(result.relatedRules.length).toBeGreaterThan(0);
  });

  it("explains when compliance type already present", () => {
    const profile = normalizePropertyProfile({
      propertyId: "p1",
      siteType: "commercial",
      ownershipType: "leased",
      presentComplianceTypes: ["Gas Safety Certificate"],
      presentAssetTypes: ["Boiler"],
    });
    const result = explainComplianceSuggestion("Gas Safety Certificate", profile);
    expect(result.answer).toContain("already exists");
    expect(result.metadata.reason).toBe("already_present");
  });

  it("explains when conditions are not met", () => {
    const landProfile = normalizePropertyProfile({
      propertyId: "p1",
      siteType: "land",
      ownershipType: "owned",
    });
    const result = explainComplianceSuggestion("Fire Risk Assessment", landProfile);
    expect(result.answer).toContain("NOT recommended");
    expect(result.metadata.reason).toBe("conditions_not_met");
  });

  it("handles unknown compliance types", () => {
    const result = explainComplianceSuggestion("Nonexistent Certificate", commercialProfile);
    expect(result.answer).toContain("No template found");
    expect(result.metadata.reason).toBe("no_template");
  });
});

describe("explainChipBoost", () => {
  it("explains compliance chip boost for commercial property", () => {
    const result = explainChipBoost("compliance", commercialProfile);
    expect(result.answer).toContain("compliance");
    expect(result.relatedRules.length).toBeGreaterThan(0);
  });

  it("explains asset chip boost when high-maintenance assets present", () => {
    const result = explainChipBoost("asset", commercialProfile);
    expect(result.answer).toContain("asset");
  });

  it("explains when no boost applies", () => {
    const noBoostProfile = normalizePropertyProfile({
      propertyId: "p1",
      siteType: "residential",
      ownershipType: "owned",
    });
    const result = explainChipBoost("compliance", noBoostProfile);
    expect(result.answer).toContain("No chip boost");
    expect(result.metadata.reason).toBe("no_boost");
  });
});

describe("explainWarnings", () => {
  it("explains listed building warning", () => {
    const result = explainWarnings(listedProfile);
    expect(result.answer).toContain("listed building");
    expect(result.relatedRules.length).toBeGreaterThan(0);
  });

  it("explains when no warnings exist", () => {
    const result = explainWarnings(commercialProfile);
    expect(result.answer).toContain("No warnings");
  });
});

describe("explainFullProfile", () => {
  it("produces a full intelligence report", () => {
    const result = explainFullProfile(commercialProfile);
    expect(result.answer).toContain("Property Intelligence Report");
    expect(result.answer).toContain("Compliance Recommendations");
    expect(result.answer).toContain("Chip Boosts");
    expect(result.answer).toContain("Warnings");
    expect(result.metadata.counts).toBeDefined();
  });
});

describe("handleDevQuestion", () => {
  it("matches 'why was Gas Safety suggested' pattern", () => {
    const result = handleDevQuestion("Why was Gas Safety suggested?", commercialProfile);
    expect(result).not.toBeNull();
    expect(result!.answer).toContain("Gas Safety");
  });

  it("matches 'what rule triggered' pattern", () => {
    const result = handleDevQuestion("What rule triggered Fire Risk Assessment?", commercialProfile);
    expect(result).not.toBeNull();
  });

  it("matches 'which repairing scope' pattern", () => {
    const result = handleDevQuestion("Which repairing scope applied?", residentialProfile);
    expect(result).not.toBeNull();
    expect(result!.answer).toContain("chase_landlord");
  });

  it("matches 'full profile' pattern", () => {
    const result = handleDevQuestion("Show full profile report", commercialProfile);
    expect(result).not.toBeNull();
    expect(result!.answer).toContain("Property Intelligence Report");
  });

  it("returns null for unmatched questions", () => {
    const result = handleDevQuestion("What is the weather like?", commercialProfile);
    expect(result).toBeNull();
  });
});
