/**
 * CreateTask Input Simulator — Dev Harness
 *
 * Runs the chip extraction pipeline on an arbitrary string and returns
 * full diagnostic output: detected entities, suggested chips, boost
 * reasoning, and final chip ranking.
 *
 * Used by:
 *   - Unit tests (no React required)
 *   - AI Debug Panel (runtime introspection)
 */

import { extractChipsFromText } from "@/services/ai/ruleBasedExtractor";
import {
  evaluateProfile,
  evaluateProfileForChipBoosts,
} from "@/services/propertyIntelligence/ruleEvaluator";
import type { PropertyProfile } from "@/services/propertyIntelligence/types";
import type {
  ChipSuggestionContext,
  SuggestedChip,
  GhostCategory,
} from "@/types/chip-suggestions";

interface SimulationEntities {
  spaces?: Array<{ id: string; name: string; property_id: string }>;
  members?: Array<{ id: string; user_id: string; display_name: string }>;
  teams?: Array<{ id: string; name: string }>;
  categories?: Array<{ id: string; name: string }>;
}

export interface CreateTaskSimulationResult {
  input: string;
  timestamp: number;

  ruleExtraction: {
    chips: SuggestedChip[];
    ghostCategories: GhostCategory[];
    complianceMode: boolean;
  };

  profileBoosts: Array<{
    ruleId: string;
    chipType: string;
    score: number;
    rationale: string;
  }>;

  finalChips: SuggestedChip[];
  finalGhostCategories: GhostCategory[];

  diagnostics: {
    extractionTimeMs: number;
    profileBoostTimeMs: number;
    totalTimeMs: number;
    chipCount: number;
    ghostCategoryCount: number;
    complianceMode: boolean;
  };
}

export function simulateCreateTask(
  input: string,
  options?: {
    propertyId?: string;
    propertyProfile?: PropertyProfile;
    entities?: SimulationEntities;
  }
): CreateTaskSimulationResult {
  const entities = {
    spaces: options?.entities?.spaces ?? [],
    members: options?.entities?.members ?? [],
    teams: options?.entities?.teams ?? [],
    categories: options?.entities?.categories ?? [],
  };

  const context: ChipSuggestionContext = {
    description: input,
    propertyId: options?.propertyId,
    propertyProfile: options?.propertyProfile,
  };

  const t0 = performance.now();

  const ruleResult = extractChipsFromText(context, entities);

  const t1 = performance.now();

  const profileBoosts: CreateTaskSimulationResult["profileBoosts"] = [];
  if (options?.propertyProfile) {
    const boosts = evaluateProfileForChipBoosts(options.propertyProfile);
    for (const b of boosts) {
      if (b.output.kind === "chip_boost") {
        profileBoosts.push({
          ruleId: b.ruleId,
          chipType: b.output.chipType,
          score: b.output.score,
          rationale: b.rationale,
        });
      }
    }
  }

  const t2 = performance.now();

  const profileBoostMap = new Map<string, number>();
  for (const b of profileBoosts) {
    const existing = profileBoostMap.get(b.chipType) ?? 0;
    profileBoostMap.set(b.chipType, Math.max(existing, b.score));
  }

  const finalChips: SuggestedChip[] = ruleResult.chips.map((chip) => {
    const boost = profileBoostMap.get(chip.type);
    return boost != null ? { ...chip, score: Math.max(chip.score, boost) } : chip;
  });

  for (const [chipType, boostScore] of profileBoostMap.entries()) {
    if (!finalChips.some((c) => c.type === chipType) && boostScore >= 0.5) {
      finalChips.push({
        id: `profile-boost-${chipType}`,
        type: chipType as SuggestedChip["type"],
        value: chipType,
        label: chipType,
        score: boostScore,
        source: "rule",
        metadata: { reason: "property_profile_boost" },
      });
    }
  }

  const filteredChips = finalChips.filter((c) => c.score >= 0.5);
  const filteredGhosts = ruleResult.ghostCategories.filter((c) => c.score >= 0.5);

  const t3 = performance.now();

  return {
    input,
    timestamp: Date.now(),
    ruleExtraction: {
      chips: ruleResult.chips,
      ghostCategories: ruleResult.ghostCategories,
      complianceMode: ruleResult.complianceMode,
    },
    profileBoosts,
    finalChips: filteredChips,
    finalGhostCategories: filteredGhosts,
    diagnostics: {
      extractionTimeMs: Math.round((t1 - t0) * 100) / 100,
      profileBoostTimeMs: Math.round((t2 - t1) * 100) / 100,
      totalTimeMs: Math.round((t3 - t0) * 100) / 100,
      chipCount: filteredChips.length,
      ghostCategoryCount: filteredGhosts.length,
      complianceMode: ruleResult.complianceMode,
    },
  };
}

export function evaluateProfileDiagnostics(profile: PropertyProfile) {
  const t0 = performance.now();
  const result = evaluateProfile(profile);
  const t1 = performance.now();

  return {
    result,
    evaluationTimeMs: Math.round((t1 - t0) * 100) / 100,
    summary: {
      complianceCount: result.complianceRecommendations.length,
      chipBoostCount: result.chipBoosts.length,
      warningCount: result.warnings.length,
      complianceTypes: result.complianceRecommendations
        .filter((r) => r.output.kind === "suggest_compliance")
        .map((r) =>
          r.output.kind === "suggest_compliance"
            ? r.output.complianceType
            : ""
        ),
      boostTypes: result.chipBoosts
        .filter((r) => r.output.kind === "chip_boost")
        .map((r) =>
          r.output.kind === "chip_boost" ? r.output.chipType : ""
        ),
    },
  };
}
