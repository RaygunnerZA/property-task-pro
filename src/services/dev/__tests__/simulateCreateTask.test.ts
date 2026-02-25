/**
 * CreateTask Simulator — Unit Tests
 *
 * Tests the diagnostic harness that wraps the chip extraction pipeline.
 * Ensures timing, diagnostics shape, and profile evaluation are correct.
 *
 * Run: npx vitest src/services/dev/__tests__/simulateCreateTask.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  simulateCreateTask,
  evaluateProfileDiagnostics,
} from "../simulateCreateTask";
import { normalizePropertyProfile } from "@/services/propertyIntelligence/ruleEvaluator";

// ─── simulateCreateTask ─────────────────────────────────────────────────────

describe("simulateCreateTask", () => {
  it("returns full diagnostics structure", () => {
    const result = simulateCreateTask("Fix the boiler in the kitchen");

    expect(result).toHaveProperty("input");
    expect(result).toHaveProperty("timestamp");
    expect(result).toHaveProperty("ruleExtraction");
    expect(result).toHaveProperty("profileBoosts");
    expect(result).toHaveProperty("finalChips");
    expect(result).toHaveProperty("finalGhostCategories");
    expect(result).toHaveProperty("diagnostics");
  });

  it("diagnostics includes timing information", () => {
    const result = simulateCreateTask("Urgent leak in the bathroom");

    expect(result.diagnostics.extractionTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.diagnostics.profileBoostTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.diagnostics.totalTimeMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.diagnostics.chipCount).toBe("number");
    expect(typeof result.diagnostics.complianceMode).toBe("boolean");
  });

  it("preserves input in result", () => {
    const input = "Frank must fix the boiler before 15 March";
    const result = simulateCreateTask(input);
    expect(result.input).toBe(input);
  });

  it("detects compliance mode for compliance text", () => {
    const result = simulateCreateTask("Schedule gas safety certificate inspection");
    expect(result.diagnostics.complianceMode).toBe(true);
  });

  it("does not trigger compliance mode for non-compliance text", () => {
    const result = simulateCreateTask("Paint the bedroom walls");
    expect(result.diagnostics.complianceMode).toBe(false);
  });

  it("includes profile boosts when profile is provided", () => {
    const profile = normalizePropertyProfile({
      propertyId: "p1",
      siteType: "commercial",
      ownershipType: "leased",
      presentAssetTypes: ["Passenger Lifts"],
    });

    const result = simulateCreateTask("Fix the lift motor", {
      propertyProfile: profile,
    });

    expect(result.profileBoosts.length).toBeGreaterThan(0);
  });

  it("returns empty profile boosts when no profile is provided", () => {
    const result = simulateCreateTask("Fix the door");
    expect(result.profileBoosts).toHaveLength(0);
  });

  it("entities parameter flows through to extraction", () => {
    const result = simulateCreateTask("Frank must fix the boiler", {
      entities: {
        members: [
          { id: "m1", user_id: "u1", display_name: "Frank Smith" },
        ],
      },
    });

    const people = result.finalChips.filter((c) => c.type === "person");
    expect(people.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── evaluateProfileDiagnostics ─────────────────────────────────────────────

describe("evaluateProfileDiagnostics", () => {
  it("returns result and timing for commercial profile", () => {
    const profile = normalizePropertyProfile({
      propertyId: "p1",
      siteType: "commercial",
      ownershipType: "leased",
      presentAssetTypes: ["Boiler", "HVAC Units"],
    });

    const diag = evaluateProfileDiagnostics(profile);

    expect(diag).toHaveProperty("result");
    expect(diag).toHaveProperty("evaluationTimeMs");
    expect(diag).toHaveProperty("summary");
    expect(diag.evaluationTimeMs).toBeGreaterThanOrEqual(0);
    expect(diag.summary.complianceCount).toBeGreaterThan(0);
  });

  it("summary includes compliance types array", () => {
    const profile = normalizePropertyProfile({
      propertyId: "p1",
      siteType: "commercial",
      ownershipType: "owned",
      presentAssetTypes: ["Boiler"],
    });

    const diag = evaluateProfileDiagnostics(profile);
    expect(Array.isArray(diag.summary.complianceTypes)).toBe(true);
    expect(diag.summary.complianceTypes.length).toBe(diag.summary.complianceCount);
  });

  it("empty profile returns zero counts and no errors", () => {
    const profile = normalizePropertyProfile({ propertyId: "p1" });
    const diag = evaluateProfileDiagnostics(profile);

    expect(diag.summary.complianceCount).toBe(0);
    expect(diag.summary.warningCount).toBe(0);
  });

  it("first run → N rules; second run with full coverage → 0 rules", () => {
    const profile = normalizePropertyProfile({
      propertyId: "p1",
      siteType: "residential",
      ownershipType: "leased",
      presentAssetTypes: ["Boiler"],
    });

    const first = evaluateProfileDiagnostics(profile);
    expect(first.summary.complianceCount).toBeGreaterThan(0);

    const fullCoverage = normalizePropertyProfile({
      ...profile,
      presentComplianceTypes: first.summary.complianceTypes,
    });

    const second = evaluateProfileDiagnostics(fullCoverage);
    expect(second.summary.complianceCount).toBe(0);
  });

  it("profile change → delta rules only (adding asset reveals new rule)", () => {
    const baseProfile = normalizePropertyProfile({
      propertyId: "p1",
      siteType: "commercial",
      ownershipType: "leased",
      presentAssetTypes: [],
    });

    const baseResult = evaluateProfileDiagnostics(baseProfile);
    const baseTypes = new Set(baseResult.summary.complianceTypes);

    const withBoiler = normalizePropertyProfile({
      ...baseProfile,
      presentAssetTypes: ["Boiler"],
    });

    const boilerResult = evaluateProfileDiagnostics(withBoiler);
    const newTypes = boilerResult.summary.complianceTypes.filter(
      (t) => !baseTypes.has(t)
    );

    expect(newTypes).toContain("Gas Safety Certificate");
  });
});
