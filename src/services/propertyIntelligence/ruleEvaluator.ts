/**
 * Property Intelligence — Rule Evaluator
 *
 * Pure functions. No side effects. No DB queries. No React.
 *
 * Public API:
 *   normalizePropertyProfile(profile)  — boundary guard, safe defaults
 *   evaluateProfile(profile)           — single pass, all outputs
 *
 * The three sub-evaluators are private. All consumers call evaluateProfile()
 * and destructure the IntelligenceResult. This ensures one scan of the
 * templates per evaluation, preventing rule drift between callers.
 *
 * repairingScope logic:
 *   'owned'  → user is owner-occupier or freehold landlord → tenant-scoped rules apply
 *   'leased' | 'rented' → user is a tenant FM:
 *       - landlord-scoped rules change task title to "Chase landlord re: [type]"
 *       - both-scoped rules keep standard title
 *   'managed' | 'other' → treat as tenant for conservative default
 *
 * Testing strategy:
 *   normalizePropertyProfile and evaluateProfile are pure — inject mock profiles,
 *   assert outputs. No mocking required.
 */

import { COMPLIANCE_TEMPLATES } from "./complianceTemplates";
import type {
  PropertyProfile,
  ComplianceTemplate,
  EvaluatedRule,
  RuleOutput,
  IntelligenceResult,
  SiteType,
} from "./types";

// ─── Public: Profile Normalizer ───────────────────────────────────────────────

/**
 * Coerces a raw PropertyProfile (which may contain nulls from DB reads) into
 * a shape with safe defaults. Call this at the boundary before passing the
 * profile to evaluateProfile().
 *
 * This is not runtime schema validation — it's a defensive normalizer that
 * ensures the evaluation layer never operates on partial or unexpected shapes.
 */
export function normalizePropertyProfile(
  raw: Partial<PropertyProfile> & Pick<PropertyProfile, "propertyId">
): PropertyProfile {
  return {
    propertyId: raw.propertyId,
    siteType: raw.siteType ?? null,
    ownershipType: raw.ownershipType ?? null,
    isListed: raw.isListed ?? false,
    listingGrade: raw.listingGrade ?? null,
    leaseStart: raw.leaseStart ?? null,
    leaseEnd: raw.leaseEnd ?? null,
    purchaseDate: raw.purchaseDate ?? null,
    presentAssetTypes: Array.isArray(raw.presentAssetTypes) ? raw.presentAssetTypes : [],
    presentComplianceTypes: Array.isArray(raw.presentComplianceTypes)
      ? raw.presentComplianceTypes
      : [],
    utilities: Array.isArray(raw.utilities) ? raw.utilities : [],
  };
}

// ─── Public: Single-Pass Evaluator ───────────────────────────────────────────

/**
 * Evaluate the property profile once and return all intelligence outputs.
 *
 * Call normalizePropertyProfile() before calling this function when the
 * profile comes from a DB read (may contain nulls).
 */
export function evaluateProfile(profile: PropertyProfile): IntelligenceResult {
  return {
    complianceRecommendations: evaluateCompliance(profile),
    chipBoosts: evaluateChipBoosts(profile),
    warnings: evaluateWarnings(profile),
  };
}

// ─── Private: Compliance Evaluator ───────────────────────────────────────────

function evaluateCompliance(profile: PropertyProfile): EvaluatedRule[] {
  const isTenant =
    profile.ownershipType === "leased" ||
    profile.ownershipType === "rented" ||
    profile.ownershipType === "managed";

  const applicable = COMPLIANCE_TEMPLATES.filter((template) =>
    templateApplies(template, profile)
  ).filter((template) => !profile.presentComplianceTypes.includes(template.complianceType));

  return applicable
    .sort((a, b) => {
      // Listed building rules surface first
      if (a.conditions.listedOnly && !b.conditions.listedOnly) return -1;
      if (!a.conditions.listedOnly && b.conditions.listedOnly) return 1;
      return b.defaultLeadDays - a.defaultLeadDays;
    })
    .map((template) => {
      // repairingScope branching: for tenant users, landlord-scoped rules
      // become "chase" tasks rather than "book" tasks.
      const isLandlordResponsible =
        isTenant && template.repairingScope === "landlord";

      return {
        ruleId: template.id,
        output: buildComplianceOutput(template, isLandlordResponsible),
        rationale: buildRationale(template, profile, isLandlordResponsible),
      };
    });
}

// ─── Private: Chip Boost Evaluator ───────────────────────────────────────────

function evaluateChipBoosts(profile: PropertyProfile): EvaluatedRule[] {
  const boosts: EvaluatedRule[] = [];

  if (
    profile.siteType &&
    (["commercial", "mixed_use", "industrial"] as SiteType[]).includes(profile.siteType)
  ) {
    boosts.push({
      ruleId: "boost-compliance-chip",
      output: { kind: "chip_boost", chipType: "compliance", label: "Compliance", score: 0.75 },
      rationale: `${formatSiteType(profile.siteType)} property — compliance tasks are common`,
    });
  }

  if (profile.leaseEnd) {
    const daysUntilEnd = daysBetween(new Date(), new Date(profile.leaseEnd));
    if (daysUntilEnd > 0 && daysUntilEnd <= 365) {
      boosts.push({
        ruleId: "boost-date-lease",
        output: { kind: "chip_boost", chipType: "date", label: "Due date", score: 0.8 },
        rationale: `Lease ends in ${daysUntilEnd} days`,
      });
    }
  }

  const highMaintenanceAssets = [
    "Passenger Lifts",
    "Boiler",
    "HVAC Units",
    "UPS",
    "Generators",
  ];
  if (profile.presentAssetTypes.some((t) => highMaintenanceAssets.includes(t))) {
    boosts.push({
      ruleId: "boost-asset-chip",
      output: { kind: "chip_boost", chipType: "asset", label: "Asset", score: 0.7 },
      rationale: "High-maintenance assets present",
    });
  }

  return boosts;
}

// ─── Private: Warning Evaluator ──────────────────────────────────────────────

function evaluateWarnings(profile: PropertyProfile): EvaluatedRule[] {
  const warnings: EvaluatedRule[] = [];

  if (profile.isListed) {
    const grade = profile.listingGrade ?? "unknown grade";
    warnings.push({
      ruleId: "warn-listed-building",
      output: {
        kind: "clarity_warning",
        message: `This is a listed building (${grade}). Check Licence to Alter before any structural, external, or fabric works.`,
        severity: "warning",
      },
      rationale: `Listed building — ${grade}`,
    });
  }

  return warnings;
}

// ─── Condition Evaluation ────────────────────────────────────────────────────

function templateApplies(template: ComplianceTemplate, profile: PropertyProfile): boolean {
  const { conditions } = template;

  if (conditions.siteTypes) {
    if (!profile.siteType) return false;
    if (!conditions.siteTypes.includes(profile.siteType)) return false;
  }

  if (conditions.requiredAssetType) {
    if (!profile.presentAssetTypes.includes(conditions.requiredAssetType)) return false;
  }

  if (conditions.listedOnly === true) {
    if (!profile.isListed) return false;
  }

  if (conditions.ownershipTypes) {
    if (!profile.ownershipType) return false;
    if (!conditions.ownershipTypes.includes(profile.ownershipType)) return false;
  }

  return true;
}

// ─── Output Builders ─────────────────────────────────────────────────────────

function buildComplianceOutput(
  template: ComplianceTemplate,
  isLandlordResponsible: boolean
): RuleOutput {
  return {
    kind: "suggest_compliance",
    complianceType: template.complianceType,
    frequency: template.frequency,
    legalRef: template.legalRef,
    // isLandlordResponsible is carried here so the seed hook can set the
    // correct task title and assignment without re-evaluating repairingScope.
    ...(isLandlordResponsible ? { taskPrefix: "chase_landlord" } : {}),
  } as RuleOutput;
}

function buildRationale(
  template: ComplianceTemplate,
  profile: PropertyProfile,
  isLandlordResponsible: boolean
): string {
  const parts: string[] = [];

  if (template.conditions.siteTypes && profile.siteType) {
    parts.push(`${formatSiteType(profile.siteType)} property`);
  }
  if (template.conditions.requiredAssetType) {
    parts.push(`has ${template.conditions.requiredAssetType} asset`);
  }
  if (template.conditions.listedOnly && profile.isListed) {
    const grade = profile.listingGrade ? `Grade ${profile.listingGrade}` : "listed";
    parts.push(`${grade} listed building`);
  }
  if (template.conditions.ownershipTypes && profile.ownershipType) {
    parts.push(`${formatOwnershipType(profile.ownershipType)} property`);
  }

  const reason = parts.length > 0 ? parts.join(", ") : "standard requirement";
  const actionNote = isLandlordResponsible
    ? "Action: Chase landlord to arrange."
    : "Action: Book and manage directly.";

  return `Required because: ${reason}. Legal basis: ${template.legalRef}. ${actionNote}`;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatSiteType(siteType: SiteType): string {
  const labels: Record<SiteType, string> = {
    residential: "Residential",
    commercial: "Commercial",
    mixed_use: "Mixed-use",
    industrial: "Industrial",
    land: "Land",
  };
  return labels[siteType] ?? siteType;
}

function formatOwnershipType(ownershipType: string): string {
  const labels: Record<string, string> = {
    owned: "Owner-occupied",
    leased: "Leasehold",
    rented: "Rented",
    managed: "Managed",
    other: "Other tenure",
  };
  return labels[ownershipType] ?? ownershipType;
}

// Re-export for backward compat with chipSuggestionEngine which calls the
// chip-boost evaluator directly. Route through evaluateProfile internally.
export function evaluateProfileForChipBoosts(
  profile: PropertyProfile
): EvaluatedRule[] {
  return evaluateProfile(profile).chipBoosts;
}
