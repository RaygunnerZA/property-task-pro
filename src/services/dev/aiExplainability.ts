/**
 * AI Explainability — Dev Mode Introspection
 *
 * Provides human-readable explanations for rule engine decisions.
 * Used by the Filla Chat in dev mode to answer "why" questions:
 *   - "Why was Gas Safety suggested?"
 *   - "Why did you boost this chip?"
 *   - "Why is this task priority HIGH?"
 *   - "What rule triggered this compliance?"
 *   - "Which repairing scope applied?"
 *
 * Does NOT expose secrets or DB queries — only rule evaluation output.
 */

import {
  evaluateProfile,
  normalizePropertyProfile,
  evaluateProfileForChipBoosts,
} from "@/services/propertyIntelligence/ruleEvaluator";
import { COMPLIANCE_TEMPLATES } from "@/services/propertyIntelligence/complianceTemplates";
import type { PropertyProfile, EvaluatedRule } from "@/services/propertyIntelligence/types";

export interface ExplainabilityQuery {
  question: string;
  propertyProfile?: PropertyProfile;
}

export interface ExplainabilityResult {
  answer: string;
  relatedRules: EvaluatedRule[];
  metadata: Record<string, unknown>;
}

export function explainComplianceSuggestion(
  complianceType: string,
  profile: PropertyProfile
): ExplainabilityResult {
  const result = evaluateProfile(profile);
  const matching = result.complianceRecommendations.filter(
    (r) =>
      r.output.kind === "suggest_compliance" &&
      r.output.complianceType.toLowerCase().includes(complianceType.toLowerCase())
  );

  if (matching.length > 0) {
    const rule = matching[0];
    const template = COMPLIANCE_TEMPLATES.find(
      (t) =>
        t.complianceType.toLowerCase() ===
        (rule.output.kind === "suggest_compliance"
          ? rule.output.complianceType.toLowerCase()
          : "")
    );

    return {
      answer: [
        `**${rule.output.kind === "suggest_compliance" ? rule.output.complianceType : ""}** was recommended because:`,
        "",
        rule.rationale,
        "",
        template
          ? `Template ID: ${template.id} | Frequency: ${template.frequency} | Legal: ${template.legalRef}`
          : "",
        template
          ? `Repairing scope: ${template.repairingScope}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      relatedRules: matching,
      metadata: { template: template ?? null },
    };
  }

  const presentAlready = profile.presentComplianceTypes.includes(complianceType);
  if (presentAlready) {
    return {
      answer: `**${complianceType}** was NOT suggested because it already exists in this property's compliance documents. The engine skips types already present to prevent duplicates.`,
      relatedRules: [],
      metadata: { reason: "already_present" },
    };
  }

  const templateExists = COMPLIANCE_TEMPLATES.find(
    (t) => t.complianceType.toLowerCase().includes(complianceType.toLowerCase())
  );

  if (templateExists) {
    return {
      answer: [
        `**${complianceType}** exists in the template library but was NOT recommended for this property.`,
        "",
        `Template conditions: ${JSON.stringify(templateExists.conditions)}`,
        "",
        `This property's profile does not satisfy those conditions.`,
        `Site type: ${profile.siteType ?? "null"}, Ownership: ${profile.ownershipType ?? "null"}`,
        `Assets: ${profile.presentAssetTypes.length > 0 ? profile.presentAssetTypes.join(", ") : "none"}`,
        `Listed: ${profile.isListed}`,
      ].join("\n"),
      relatedRules: [],
      metadata: { template: templateExists, reason: "conditions_not_met" },
    };
  }

  return {
    answer: `No template found for "${complianceType}". The rule engine does not have a definition for this compliance type.`,
    relatedRules: [],
    metadata: { reason: "no_template" },
  };
}

export function explainChipBoost(
  chipType: string,
  profile: PropertyProfile
): ExplainabilityResult {
  const boosts = evaluateProfileForChipBoosts(profile);
  const matching = boosts.filter(
    (r) =>
      r.output.kind === "chip_boost" &&
      r.output.chipType.toLowerCase() === chipType.toLowerCase()
  );

  if (matching.length > 0) {
    return {
      answer: matching
        .map(
          (r) =>
            `**${r.output.kind === "chip_boost" ? r.output.chipType : ""}** chip boosted (score: ${r.output.kind === "chip_boost" ? r.output.score : 0}):\n${r.rationale}`
        )
        .join("\n\n"),
      relatedRules: matching,
      metadata: {},
    };
  }

  return {
    answer: `No chip boost was applied for "${chipType}" on this property profile. Boosts are triggered by: commercial/industrial site type (compliance), lease ending within 365 days (date), high-maintenance assets like Lifts/Boilers/HVAC (asset).`,
    relatedRules: [],
    metadata: { reason: "no_boost" },
  };
}

export function explainWarnings(
  profile: PropertyProfile
): ExplainabilityResult {
  const result = evaluateProfile(profile);

  if (result.warnings.length > 0) {
    return {
      answer: result.warnings
        .map((w) =>
          w.output.kind === "clarity_warning"
            ? `[${w.output.severity}] ${w.output.message}`
            : w.rationale
        )
        .join("\n\n"),
      relatedRules: result.warnings,
      metadata: {},
    };
  }

  return {
    answer: "No warnings triggered for this property. Warnings fire for listed buildings (Grade I, II, II*) requiring Licence to Alter checks.",
    relatedRules: [],
    metadata: {},
  };
}

export function explainFullProfile(
  profile: PropertyProfile
): ExplainabilityResult {
  const result = evaluateProfile(profile);

  const lines = [
    `## Property Intelligence Report`,
    "",
    `**Site type:** ${profile.siteType ?? "not set"}`,
    `**Ownership:** ${profile.ownershipType ?? "not set"}`,
    `**Listed:** ${profile.isListed ? `Yes (Grade ${profile.listingGrade ?? "unknown"})` : "No"}`,
    `**Assets:** ${profile.presentAssetTypes.length > 0 ? profile.presentAssetTypes.join(", ") : "none"}`,
    `**Existing compliance:** ${profile.presentComplianceTypes.length > 0 ? profile.presentComplianceTypes.join(", ") : "none"}`,
    "",
    `### Compliance Recommendations (${result.complianceRecommendations.length})`,
    ...result.complianceRecommendations.map((r) =>
      r.output.kind === "suggest_compliance"
        ? `- **${r.output.complianceType}** (${r.output.frequency}) — ${r.rationale}`
        : `- ${r.ruleId}`
    ),
    "",
    `### Chip Boosts (${result.chipBoosts.length})`,
    ...result.chipBoosts.map((r) =>
      r.output.kind === "chip_boost"
        ? `- **${r.output.chipType}** +${r.output.score} — ${r.rationale}`
        : `- ${r.ruleId}`
    ),
    "",
    `### Warnings (${result.warnings.length})`,
    ...result.warnings.map((r) =>
      r.output.kind === "clarity_warning"
        ? `- [${r.output.severity}] ${r.output.message}`
        : `- ${r.ruleId}`
    ),
  ];

  return {
    answer: lines.join("\n"),
    relatedRules: [
      ...result.complianceRecommendations,
      ...result.chipBoosts,
      ...result.warnings,
    ],
    metadata: {
      counts: {
        compliance: result.complianceRecommendations.length,
        boosts: result.chipBoosts.length,
        warnings: result.warnings.length,
      },
    },
  };
}

const DEV_QUESTION_PATTERNS: Array<{
  pattern: RegExp;
  handler: (match: RegExpMatchArray, profile: PropertyProfile) => ExplainabilityResult;
}> = [
  {
    pattern: /why\s+(?:was|is)\s+(.+?)\s+suggested/i,
    handler: (match, profile) => explainComplianceSuggestion(match[1], profile),
  },
  {
    pattern: /why\s+(?:did you|was)\s+(?:boost|boosted?)\s+(?:this\s+)?(.+?)(?:\s+chip)?$/i,
    handler: (match, profile) => explainChipBoost(match[1], profile),
  },
  {
    pattern: /what\s+rule\s+triggered\s+(?:this\s+)?(.+)/i,
    handler: (match, profile) => explainComplianceSuggestion(match[1], profile),
  },
  {
    pattern: /which\s+repairing\s+scope/i,
    handler: (_match, profile) => {
      const result = evaluateProfile(profile);
      const withScope = result.complianceRecommendations.filter(
        (r) => r.output.kind === "suggest_compliance" && r.output.taskPrefix
      );
      if (withScope.length > 0) {
        return {
          answer: withScope
            .map(
              (r) =>
                `**${r.output.kind === "suggest_compliance" ? r.output.complianceType : ""}** — chase_landlord prefix applied. ${r.rationale}`
            )
            .join("\n\n"),
          relatedRules: withScope,
          metadata: {},
        };
      }
      return {
        answer: "No landlord-scoped chase tasks for this property. Repairing scope only produces chase_landlord prefixes for tenant contexts (leased/rented/managed) on landlord-scoped rules.",
        relatedRules: [],
        metadata: {},
      };
    },
  },
  {
    pattern: /full\s+(?:profile|report|intelligence)/i,
    handler: (_match, profile) => explainFullProfile(profile),
  },
];

export function handleDevQuestion(
  question: string,
  profile?: PropertyProfile
): ExplainabilityResult | null {
  const normalizedProfile = profile
    ? normalizePropertyProfile(profile)
    : normalizePropertyProfile({ propertyId: "unknown" });

  for (const { pattern, handler } of DEV_QUESTION_PATTERNS) {
    const match = question.match(pattern);
    if (match) {
      return handler(match, normalizedProfile);
    }
  }

  return null;
}
