/**
 * Rule Evaluator — Unit Tests
 *
 * These tests verify that the intelligence engine is deterministic.
 * Every case documents a specific business rule.
 *
 * Run: npx vitest src/services/propertyIntelligence/__tests__/ruleEvaluator.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  evaluateProfile,
  normalizePropertyProfile,
} from "../ruleEvaluator";
import type { PropertyProfile } from "../types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_PROPERTY_ID = "prop-test-001";

function makeProfile(overrides: Partial<PropertyProfile> = {}): PropertyProfile {
  return normalizePropertyProfile({
    propertyId: BASE_PROPERTY_ID,
    ...overrides,
  });
}

// ─── normalizePropertyProfile ─────────────────────────────────────────────────

describe("normalizePropertyProfile", () => {
  it("fills missing arrays with empty arrays", () => {
    const profile = normalizePropertyProfile({ propertyId: "p1" });
    expect(profile.presentAssetTypes).toEqual([]);
    expect(profile.presentComplianceTypes).toEqual([]);
    expect(profile.utilities).toEqual([]);
  });

  it("defaults isListed to false", () => {
    const profile = normalizePropertyProfile({ propertyId: "p1" });
    expect(profile.isListed).toBe(false);
  });

  it("preserves explicit false for isListed", () => {
    const profile = normalizePropertyProfile({ propertyId: "p1", isListed: false });
    expect(profile.isListed).toBe(false);
  });

  it("preserves existing arrays without mutation", () => {
    const assets = ["Boiler", "HVAC Units"];
    const profile = normalizePropertyProfile({ propertyId: "p1", presentAssetTypes: assets });
    expect(profile.presentAssetTypes).toEqual(["Boiler", "HVAC Units"]);
    // Original array not mutated
    expect(assets).toEqual(["Boiler", "HVAC Units"]);
  });
});

// ─── Compliance Recommendations ───────────────────────────────────────────────

describe("evaluateProfile — compliance recommendations", () => {

  it("commercial property with Passenger Lift → LOLER appears", () => {
    const profile = makeProfile({
      siteType: "commercial",
      ownershipType: "leased",
      presentAssetTypes: ["Passenger Lifts"],
    });

    const result = evaluateProfile(profile);
    const types = result.complianceRecommendations
      .filter((r) => r.output.kind === "suggest_compliance")
      .map((r) => r.output.kind === "suggest_compliance" ? r.output.complianceType : "");

    expect(types).toContain("LOLER Inspection");
  });

  it("residential property with no boiler → Gas Safety does NOT appear", () => {
    const profile = makeProfile({
      siteType: "residential",
      ownershipType: "leased",
      presentAssetTypes: [],
    });

    const result = evaluateProfile(profile);
    const types = result.complianceRecommendations
      .filter((r) => r.output.kind === "suggest_compliance")
      .map((r) => r.output.kind === "suggest_compliance" ? r.output.complianceType : "");

    expect(types).not.toContain("Gas Safety Certificate");
  });

  it("residential property with boiler and leased ownership → Gas Safety appears", () => {
    const profile = makeProfile({
      siteType: "residential",
      ownershipType: "leased",
      presentAssetTypes: ["Boiler"],
    });

    const result = evaluateProfile(profile);
    const types = result.complianceRecommendations
      .filter((r) => r.output.kind === "suggest_compliance")
      .map((r) => r.output.kind === "suggest_compliance" ? r.output.complianceType : "");

    expect(types).toContain("Gas Safety Certificate");
  });

  it("commercial property with already-present EICR → EICR does NOT appear again", () => {
    const profile = makeProfile({
      siteType: "commercial",
      ownershipType: "leased",
      presentComplianceTypes: ["EICR"],
    });

    const result = evaluateProfile(profile);
    const types = result.complianceRecommendations
      .filter((r) => r.output.kind === "suggest_compliance")
      .map((r) => r.output.kind === "suggest_compliance" ? r.output.complianceType : "");

    expect(types).not.toContain("EICR");
  });

  it("industrial property without HVAC asset → F-Gas does NOT appear", () => {
    const profile = makeProfile({
      siteType: "industrial",
      ownershipType: "owned",
      presentAssetTypes: [],
    });

    const result = evaluateProfile(profile);
    const types = result.complianceRecommendations
      .filter((r) => r.output.kind === "suggest_compliance")
      .map((r) => r.output.kind === "suggest_compliance" ? r.output.complianceType : "");

    expect(types).not.toContain("F-Gas Checks");
  });

  it("industrial property with HVAC asset → F-Gas appears", () => {
    const profile = makeProfile({
      siteType: "industrial",
      ownershipType: "owned",
      presentAssetTypes: ["HVAC Units"],
    });

    const result = evaluateProfile(profile);
    const types = result.complianceRecommendations
      .filter((r) => r.output.kind === "suggest_compliance")
      .map((r) => r.output.kind === "suggest_compliance" ? r.output.complianceType : "");

    expect(types).toContain("F-Gas Checks");
  });

  it("land site type → no compliance recommendations", () => {
    const profile = makeProfile({
      siteType: "land",
      ownershipType: "owned",
      presentAssetTypes: [],
    });

    const result = evaluateProfile(profile);
    expect(result.complianceRecommendations).toHaveLength(0);
  });

  it("null site type → site-type-gated rules do not appear", () => {
    const profile = makeProfile({
      siteType: null,
      ownershipType: "owned",
      presentAssetTypes: [],
    });

    const result = evaluateProfile(profile);
    // EPC has no siteType condition, so it may appear.
    // Fire Risk Assessment requires siteType — should not appear.
    const types = result.complianceRecommendations
      .filter((r) => r.output.kind === "suggest_compliance")
      .map((r) => r.output.kind === "suggest_compliance" ? r.output.complianceType : "");

    expect(types).not.toContain("Fire Risk Assessment");
  });

  it("EICR for residential leased property → EICR appears (landlord-scoped rule)", () => {
    const profile = makeProfile({
      siteType: "residential",
      ownershipType: "leased",
      presentAssetTypes: [],
    });

    const result = evaluateProfile(profile);
    const types = result.complianceRecommendations
      .filter((r) => r.output.kind === "suggest_compliance")
      .map((r) => r.output.kind === "suggest_compliance" ? r.output.complianceType : "");

    expect(types).toContain("EICR");
  });

  it("EICR for residential owned property → EICR does NOT appear (ownership condition not met)", () => {
    const profile = makeProfile({
      siteType: "residential",
      ownershipType: "owned",
      presentAssetTypes: [],
    });

    const result = evaluateProfile(profile);
    const types = result.complianceRecommendations
      .filter((r) => r.output.kind === "suggest_compliance")
      .map((r) => r.output.kind === "suggest_compliance" ? r.output.complianceType : "");

    expect(types).not.toContain("EICR");
  });
});

// ─── repairingScope Branching ─────────────────────────────────────────────────

describe("evaluateProfile — repairingScope branching", () => {

  it("leased property with boiler → Gas Safety gets taskPrefix chase_landlord", () => {
    const profile = makeProfile({
      siteType: "residential",
      ownershipType: "leased",
      presentAssetTypes: ["Boiler"],
    });

    const result = evaluateProfile(profile);
    const gasRule = result.complianceRecommendations.find(
      (r) => r.output.kind === "suggest_compliance" && r.output.complianceType === "Gas Safety Certificate"
    );

    expect(gasRule).toBeDefined();
    expect(gasRule!.output.kind).toBe("suggest_compliance");
    if (gasRule!.output.kind === "suggest_compliance") {
      expect(gasRule!.output.taskPrefix).toBe("chase_landlord");
    }
  });

  it("owned commercial property with boiler → Gas Safety has no taskPrefix", () => {
    const profile = makeProfile({
      siteType: "commercial",
      ownershipType: "owned",
      presentAssetTypes: ["Boiler"],
    });

    const result = evaluateProfile(profile);
    const gasRule = result.complianceRecommendations.find(
      (r) => r.output.kind === "suggest_compliance" && r.output.complianceType === "Gas Safety Certificate"
    );

    expect(gasRule).toBeDefined();
    if (gasRule!.output.kind === "suggest_compliance") {
      expect(gasRule!.output.taskPrefix).toBeUndefined();
    }
  });

  it("leased property → rationale contains 'Chase landlord'", () => {
    const profile = makeProfile({
      siteType: "residential",
      ownershipType: "leased",
      presentAssetTypes: ["Boiler"],
    });

    const result = evaluateProfile(profile);
    const gasRule = result.complianceRecommendations.find(
      (r) => r.output.kind === "suggest_compliance" && r.output.complianceType === "Gas Safety Certificate"
    );

    expect(gasRule!.rationale).toContain("Chase landlord");
  });
});

// ─── Listed Building Warnings ─────────────────────────────────────────────────

describe("evaluateProfile — warnings", () => {

  it("listed building → warning appears", () => {
    const profile = makeProfile({ isListed: true, listingGrade: "II" });

    const result = evaluateProfile(profile);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].output.kind).toBe("clarity_warning");
  });

  it("non-listed building → no warnings", () => {
    const profile = makeProfile({ isListed: false });

    const result = evaluateProfile(profile);
    expect(result.warnings).toHaveLength(0);
  });

  it("listed building warning includes the grade in the message", () => {
    const profile = makeProfile({ isListed: true, listingGrade: "I" });

    const result = evaluateProfile(profile);
    const warning = result.warnings[0];
    expect(warning.output.kind).toBe("clarity_warning");
    if (warning.output.kind === "clarity_warning") {
      expect(warning.output.message).toContain("I");
      expect(warning.output.severity).toBe("warning");
    }
  });

  it("listed building also gets listed_building_consent compliance rule", () => {
    const profile = makeProfile({ isListed: true, listingGrade: "II*" });

    const result = evaluateProfile(profile);
    const types = result.complianceRecommendations
      .filter((r) => r.output.kind === "suggest_compliance")
      .map((r) => r.output.kind === "suggest_compliance" ? r.output.complianceType : "");

    expect(types).toContain("Listed Building Consent Review");
  });
});

// ─── Chip Boosts ─────────────────────────────────────────────────────────────

describe("evaluateProfile — chip boosts", () => {

  it("commercial property → compliance chip boost emitted", () => {
    const profile = makeProfile({ siteType: "commercial" });

    const result = evaluateProfile(profile);
    const boostTypes = result.chipBoosts
      .filter((r) => r.output.kind === "chip_boost")
      .map((r) => r.output.kind === "chip_boost" ? r.output.chipType : "");

    expect(boostTypes).toContain("compliance");
  });

  it("residential property → no compliance chip boost", () => {
    const profile = makeProfile({ siteType: "residential" });

    const result = evaluateProfile(profile);
    const boostTypes = result.chipBoosts
      .filter((r) => r.output.kind === "chip_boost")
      .map((r) => r.output.kind === "chip_boost" ? r.output.chipType : "");

    expect(boostTypes).not.toContain("compliance");
  });

  it("property with Passenger Lift → asset chip boost emitted", () => {
    const profile = makeProfile({ presentAssetTypes: ["Passenger Lifts"] });

    const result = evaluateProfile(profile);
    const boostTypes = result.chipBoosts
      .filter((r) => r.output.kind === "chip_boost")
      .map((r) => r.output.kind === "chip_boost" ? r.output.chipType : "");

    expect(boostTypes).toContain("asset");
  });

  it("property with lease ending in 30 days → date chip boost emitted", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const profile = makeProfile({ leaseEnd: soon.toISOString() });

    const result = evaluateProfile(profile);
    const boostTypes = result.chipBoosts
      .filter((r) => r.output.kind === "chip_boost")
      .map((r) => r.output.kind === "chip_boost" ? r.output.chipType : "");

    expect(boostTypes).toContain("date");
  });

  it("property with expired lease → no date chip boost (past lease is not actionable)", () => {
    const past = new Date();
    past.setFullYear(past.getFullYear() - 1);
    const profile = makeProfile({ leaseEnd: past.toISOString() });

    const result = evaluateProfile(profile);
    const boostTypes = result.chipBoosts
      .filter((r) => r.output.kind === "chip_boost")
      .map((r) => r.output.kind === "chip_boost" ? r.output.chipType : "");

    expect(boostTypes).not.toContain("date");
  });
});

// ─── Output Shape Stability ───────────────────────────────────────────────────

describe("evaluateProfile — output shape", () => {

  it("always returns all three result keys", () => {
    const profile = makeProfile();
    const result = evaluateProfile(profile);

    expect(result).toHaveProperty("complianceRecommendations");
    expect(result).toHaveProperty("chipBoosts");
    expect(result).toHaveProperty("warnings");
  });

  it("is deterministic — same input returns same output", () => {
    const profile = makeProfile({
      siteType: "commercial",
      ownershipType: "owned",
      presentAssetTypes: ["Passenger Lifts", "HVAC Units"],
    });

    const result1 = evaluateProfile(profile);
    const result2 = evaluateProfile(profile);

    expect(result1.complianceRecommendations.map((r) => r.ruleId))
      .toEqual(result2.complianceRecommendations.map((r) => r.ruleId));
  });

  it("empty profile returns empty arrays, no throws", () => {
    const profile = makeProfile();
    expect(() => evaluateProfile(profile)).not.toThrow();
    const result = evaluateProfile(profile);
    expect(Array.isArray(result.complianceRecommendations)).toBe(true);
    expect(Array.isArray(result.chipBoosts)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});
