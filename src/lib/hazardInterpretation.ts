/**
 * Phase 9: Hazard → recommended action mapping
 * Used by ai-doc-analyse, ComplianceRecommendationDrawer, and portfolio hazard filters
 */

import type { HazardCategory } from "./hazards";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface HazardInterpretation {
  riskLevel: RiskLevel;
  recommendedAction: string;
}

export const HAZARD_INTERPRETATIONS: Record<HazardCategory, HazardInterpretation> = {
  fire: { riskLevel: "high", recommendedAction: "Fire Extinguisher Service" },
  electrical: { riskLevel: "high", recommendedAction: "Schedule EICR" },
  slip: { riskLevel: "medium", recommendedAction: "Review slip/trip hazards" },
  water: { riskLevel: "medium", recommendedAction: "Review Legionella Report" },
  structural: { riskLevel: "critical", recommendedAction: "Immediate assessment recommended" },
  obstruction: { riskLevel: "medium", recommendedAction: "Clear obstruction and reassess" },
  hygiene: { riskLevel: "medium", recommendedAction: "Hygiene inspection recommended" },
  ventilation: { riskLevel: "medium", recommendedAction: "Ventilation assessment" },
  unknown: { riskLevel: "low", recommendedAction: "Further investigation recommended" },
};

export function getHazardInterpretation(hazard: string): HazardInterpretation {
  return HAZARD_INTERPRETATIONS[hazard as HazardCategory] ?? HAZARD_INTERPRETATIONS.unknown;
}

export function getRiskLevelFromHazards(hazards: string[]): RiskLevel {
  if (hazards.length === 0) return "low";
  const levels = hazards.map((h) => getHazardInterpretation(h).riskLevel);
  if (levels.includes("critical")) return "critical";
  if (levels.includes("high")) return "high";
  if (levels.includes("medium")) return "medium";
  return "low";
}

export function getPrimaryRecommendationFromHazards(hazards: string[]): string | null {
  if (hazards.length === 0) return null;
  const critical = hazards.find((h) => getHazardInterpretation(h).riskLevel === "critical");
  if (critical) return getHazardInterpretation(critical).recommendedAction;
  const high = hazards.find((h) => getHazardInterpretation(h).riskLevel === "high");
  if (high) return getHazardInterpretation(high).recommendedAction;
  return getHazardInterpretation(hazards[0]).recommendedAction;
}
