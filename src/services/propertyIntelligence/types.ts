/**
 * Property Intelligence Engine — Core Types
 *
 * These interfaces form the typed contract between:
 *   - Data layer (usePropertyProfile)
 *   - Rule evaluation (ruleEvaluator)
 *   - Chip suggestion engine (chipSuggestionEngine)
 *   - Confirmation hook (usePropertyIntelligenceSeed)
 *
 * Constraints:
 *   - site_type enum values match DB exactly: residential | commercial | mixed_use | industrial | land
 *   - ownership_type enum values match DB exactly: owned | leased | rented | managed | other
 *   - No freeform condition strings. Every condition is a typed discriminated union.
 */

import type { ChipType } from "@/types/chip-suggestions";
import type { CreateTaskPrefill } from "@/components/tasks/CreateTaskModal";

// ─── Property Profile ──────────────────────────────────────────────────────────
// Aggregated shape built from existing DB tables. Rule evaluators receive this;
// they never query individual tables directly.

export type SiteType = "residential" | "commercial" | "mixed_use" | "industrial" | "land";
export type OwnershipType = "owned" | "leased" | "rented" | "managed" | "other";

export interface PropertyProfile {
  propertyId: string;
  siteType: SiteType | null;
  ownershipType: OwnershipType | null;
  isListed: boolean;
  listingGrade: string | null;
  // Lease (from property_legal)
  leaseStart: string | null;
  leaseEnd: string | null;
  purchaseDate: string | null;
  // Asset presence (distinct asset_type values from assets table)
  presentAssetTypes: string[];
  // Compliance presence (distinct document_type values from compliance_documents)
  presentComplianceTypes: string[];
  // Utility presence (from property_utilities)
  utilities: PropertyUtilityProfile[];
}

export interface PropertyUtilityProfile {
  type: string;
  supplier: string | null;
  contractEnd: string | null; // null until Phase 2 schema addition
}

// ─── Rule Triggers ─────────────────────────────────────────────────────────────
// Discriminated union. Every branch is evaluable without string parsing.

export type RuleTrigger =
  | { kind: "site_type"; values: SiteType[] }
  | { kind: "asset_present"; assetType: string }
  | { kind: "asset_absent"; assetType: string }
  | { kind: "is_listed" }
  | { kind: "ownership_type"; values: OwnershipType[] }
  | { kind: "lease_end_within_days"; days: number }
  | { kind: "document_expiry_within_days"; documentType: string; days: number }
  | { kind: "compliance_absent"; complianceType: string }
  | { kind: "utility_contract_expiry_within_days"; utilityType: string; days: number };

// ─── Rule Outputs ──────────────────────────────────────────────────────────────

export type ClarityWarningLevel = "info" | "warning" | "blocking";

export type RuleOutput =
  | {
      kind: "suggest_compliance";
      complianceType: string;
      frequency: string;
      legalRef: string;
      /**
       * When set to 'chase_landlord', the seed hook generates a
       * "Chase landlord re: [type]" task instead of "Schedule [type]".
       * Set by the evaluator when repairingScope = 'landlord' and the
       * current property ownershipType indicates a tenant context.
       */
      taskPrefix?: "chase_landlord";
    }
  | {
      kind: "create_task_prefill";
      prefill: CreateTaskPrefill;
      isCompliance: boolean;
      complianceType?: string;
    }
  | {
      kind: "chip_boost";
      chipType: ChipType;
      label: string;
      score: number;
    }
  | {
      kind: "clarity_warning";
      message: string;
      severity: ClarityWarningLevel;
    };

// ─── Intelligence Rule ─────────────────────────────────────────────────────────

export interface IntelligenceRule {
  id: string;
  description: string;
  trigger: RuleTrigger;
  output: RuleOutput;
  /**
   * Who is responsible. Affects task assignment and whether the rule fires
   * for the current user context.
   * null = applies universally.
   */
  repairingScope: "landlord" | "tenant" | "both" | null;
  /** Days before a date-based trigger fires. */
  leadDays?: number;
}

// ─── Evaluated Rule ────────────────────────────────────────────────────────────
// Output of ruleEvaluator — adds rationale text for the confirmation UI.

export interface EvaluatedRule {
  ruleId: string;
  output: RuleOutput;
  /**
   * Human-readable explanation shown in the confirmation UI.
   * e.g. "Because this is a commercial property with a Passenger Lift asset"
   */
  rationale: string;
}

// ─── Intelligence Result ───────────────────────────────────────────────────────
// Single output from evaluateProfile(). One evaluation pass; all consumers
// read from this shape rather than calling separate evaluator functions.

export interface IntelligenceResult {
  /** Compliance types not yet present that should be added to the property schedule. */
  complianceRecommendations: EvaluatedRule[];
  /** Score boosts for the chip suggestion engine. */
  chipBoosts: EvaluatedRule[];
  /** Warnings to surface in context (listed building, etc.). Not seeded as tasks. */
  warnings: EvaluatedRule[];
}

// ─── Compliance Template ───────────────────────────────────────────────────────
// Used by complianceTemplates.ts constants and (Phase 3) the DB table.

export interface TemplateConditions {
  /** Applies only if property.siteType is in this list. Null = all site types. */
  siteTypes?: SiteType[];
  /** Applies only if this asset_type exists on the property. Null = unconditional. */
  requiredAssetType?: string;
  /** Applies only if property is a listed building. */
  listedOnly?: boolean;
  /** Applies only if ownership type is in this list. Null = all. */
  ownershipTypes?: OwnershipType[];
}

export interface ComplianceTemplate {
  id: string;
  complianceType: string;
  frequency: string;
  legalRef: string;
  defaultLeadDays: number;
  conditions: TemplateConditions;
  repairingScope: "landlord" | "tenant" | "both";
}
