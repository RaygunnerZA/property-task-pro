/**
 * Property Intelligence — Compliance Templates
 *
 * Typed constants encoding which statutory compliance types apply to a property,
 * based on site type, asset presence, and building characteristics.
 *
 * Design decisions:
 *   - These are TypeScript constants, not a DB table. They are version-controlled,
 *     unit-testable, and deployable without migrations.
 *   - Phase 3 will migrate these to a compliance_templates DB table for org-level
 *     overrides. The ruleEvaluator interface will remain identical.
 *   - Legal references are UK-specific. Adjust per jurisdiction if needed.
 *   - defaultLeadDays = how far ahead the renewal task should fire before expiry.
 */

import type { ComplianceTemplate } from "./types";

export const COMPLIANCE_TEMPLATES: ComplianceTemplate[] = [
  // ─── Fire & Life Safety ─────────────────────────────────────────────────────

  {
    id: "ct-fire-risk-assessment",
    complianceType: "Fire Risk Assessment",
    frequency: "annual",
    legalRef: "Regulatory Reform (Fire Safety) Order 2005",
    defaultLeadDays: 60,
    conditions: { siteTypes: ["commercial", "mixed_use", "industrial"] },
    repairingScope: "tenant",
  },
  {
    id: "ct-fire-risk-residential",
    complianceType: "Fire Risk Assessment",
    frequency: "annual",
    legalRef: "Regulatory Reform (Fire Safety) Order 2005 / Building Safety Act 2022",
    defaultLeadDays: 60,
    conditions: { siteTypes: ["residential"] },
    repairingScope: "landlord",
  },
  {
    id: "ct-fire-alarm-servicing",
    complianceType: "Fire Alarm Servicing",
    frequency: "6_monthly",
    legalRef: "BS 5839-1:2017",
    defaultLeadDays: 30,
    conditions: { siteTypes: ["commercial", "mixed_use", "industrial"] },
    repairingScope: "tenant",
  },
  {
    id: "ct-fire-extinguisher-service",
    complianceType: "Fire Extinguisher Service",
    frequency: "annual",
    legalRef: "BS 5306-3:2017",
    defaultLeadDays: 30,
    conditions: { siteTypes: ["residential", "commercial", "mixed_use", "industrial"] },
    repairingScope: "tenant",
  },
  {
    id: "ct-fire-door-inspection",
    complianceType: "Fire Door Inspection",
    frequency: "6_monthly",
    legalRef: "Fire Safety (England) Regulations 2022",
    defaultLeadDays: 30,
    conditions: { siteTypes: ["commercial", "mixed_use", "industrial", "residential"] },
    repairingScope: "tenant",
  },
  {
    id: "ct-sprinkler-servicing",
    complianceType: "Sprinkler System Servicing",
    frequency: "annual",
    legalRef: "BS EN 12845",
    defaultLeadDays: 45,
    conditions: { requiredAssetType: "Sprinklers" },
    repairingScope: "tenant",
  },
  {
    id: "ct-smoke-vent-servicing",
    complianceType: "Smoke Vent Servicing",
    frequency: "6_monthly",
    legalRef: "BS 7346-8",
    defaultLeadDays: 30,
    conditions: { requiredAssetType: "Smoke Vents" },
    repairingScope: "tenant",
  },

  // ─── Electrical ─────────────────────────────────────────────────────────────

  {
    id: "ct-eicr-commercial",
    complianceType: "EICR",
    frequency: "5_yearly",
    legalRef: "Electricity at Work Regulations 1989",
    defaultLeadDays: 90,
    conditions: { siteTypes: ["commercial", "mixed_use", "industrial"] },
    repairingScope: "tenant",
  },
  {
    id: "ct-eicr-residential",
    complianceType: "EICR",
    frequency: "5_yearly",
    legalRef: "Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020",
    defaultLeadDays: 90,
    conditions: { siteTypes: ["residential"], ownershipTypes: ["leased", "rented"] },
    repairingScope: "landlord",
  },
  {
    id: "ct-emergency-lighting",
    complianceType: "Emergency Lighting Test",
    frequency: "annual",
    legalRef: "BS 5266-1:2016",
    defaultLeadDays: 30,
    conditions: { siteTypes: ["commercial", "mixed_use", "industrial"] },
    repairingScope: "tenant",
  },
  {
    id: "ct-pat-testing",
    complianceType: "PAT Testing",
    frequency: "annual",
    legalRef: "IET Code of Practice for In-service Inspection and Testing",
    defaultLeadDays: 30,
    conditions: { siteTypes: ["commercial", "mixed_use", "industrial"] },
    repairingScope: "tenant",
  },
  {
    id: "ct-lightning-protection",
    complianceType: "Lightning Protection Test",
    frequency: "annual",
    legalRef: "BS EN 62305",
    defaultLeadDays: 45,
    conditions: { requiredAssetType: "Lightning Protection" },
    repairingScope: "tenant",
  },

  // ─── Mechanical / Gas ───────────────────────────────────────────────────────

  {
    id: "ct-gas-safety-residential",
    complianceType: "Gas Safety Certificate",
    frequency: "annual",
    legalRef: "Gas Safety (Installation and Use) Regulations 1998",
    defaultLeadDays: 30,
    conditions: { requiredAssetType: "Boiler", ownershipTypes: ["leased", "rented"] },
    repairingScope: "landlord",
  },
  {
    id: "ct-gas-safety-commercial",
    complianceType: "Gas Safety Certificate",
    frequency: "annual",
    legalRef: "Gas Safety (Installation and Use) Regulations 1998",
    defaultLeadDays: 30,
    conditions: {
      requiredAssetType: "Boiler",
      siteTypes: ["commercial", "mixed_use", "industrial"],
    },
    repairingScope: "tenant",
  },
  {
    id: "ct-hvac-servicing",
    complianceType: "HVAC Servicing",
    frequency: "annual",
    legalRef: "HSG202 / CIBSE Guide M",
    defaultLeadDays: 45,
    conditions: { requiredAssetType: "HVAC Units" },
    repairingScope: "tenant",
  },
  {
    id: "ct-fgas",
    complianceType: "F-Gas Checks",
    frequency: "annual",
    legalRef: "F-Gas Regulation (EU) 517/2014 (retained UK law)",
    defaultLeadDays: 45,
    conditions: { requiredAssetType: "HVAC Units", siteTypes: ["commercial", "mixed_use", "industrial"] },
    repairingScope: "tenant",
  },
  {
    id: "ct-loler-lift",
    complianceType: "LOLER Inspection",
    frequency: "6_monthly",
    legalRef: "Lifting Operations and Lifting Equipment Regulations 1998",
    defaultLeadDays: 30,
    conditions: { requiredAssetType: "Passenger Lifts" },
    repairingScope: "both",
  },
  {
    id: "ct-loler-goods-lift",
    complianceType: "LOLER Inspection",
    frequency: "6_monthly",
    legalRef: "Lifting Operations and Lifting Equipment Regulations 1998",
    defaultLeadDays: 30,
    conditions: { requiredAssetType: "Goods Lifts" },
    repairingScope: "both",
  },
  {
    id: "ct-pressure-vessel",
    complianceType: "Pressure Vessel Inspection",
    frequency: "annual",
    legalRef: "Pressure Systems Safety Regulations 2000",
    defaultLeadDays: 45,
    conditions: { requiredAssetType: "Compressors" },
    repairingScope: "tenant",
  },

  // ─── Water Hygiene ──────────────────────────────────────────────────────────

  {
    id: "ct-legionella",
    complianceType: "Legionella L8 Risk Assessment",
    frequency: "2_yearly",
    legalRef: "HSE ACOP L8 / HSG274",
    defaultLeadDays: 60,
    conditions: { siteTypes: ["commercial", "mixed_use", "industrial"] },
    repairingScope: "tenant",
  },
  {
    id: "ct-water-temp-checks",
    complianceType: "Monthly Water Temperature Checks",
    frequency: "monthly",
    legalRef: "HSE ACOP L8",
    defaultLeadDays: 7,
    conditions: {
      siteTypes: ["commercial", "mixed_use", "industrial"],
      requiredAssetType: "Calorifiers",
    },
    repairingScope: "tenant",
  },
  {
    id: "ct-tank-inspection",
    complianceType: "Quarterly Tank Inspection",
    frequency: "quarterly",
    legalRef: "HSE ACOP L8",
    defaultLeadDays: 14,
    conditions: { requiredAssetType: "Tanks / Cisterns" },
    repairingScope: "tenant",
  },

  // ─── Asbestos ───────────────────────────────────────────────────────────────

  {
    id: "ct-asbestos-survey",
    complianceType: "Asbestos Management Survey",
    frequency: "on_change",
    legalRef: "Control of Asbestos Regulations 2012",
    defaultLeadDays: 90,
    conditions: { siteTypes: ["commercial", "mixed_use", "industrial"] },
    repairingScope: "tenant",
  },
  {
    id: "ct-asbestos-reinspection",
    complianceType: "Asbestos Reinspection",
    frequency: "annual",
    legalRef: "Control of Asbestos Regulations 2012",
    defaultLeadDays: 60,
    conditions: { siteTypes: ["commercial", "mixed_use", "industrial"] },
    repairingScope: "tenant",
  },

  // ─── Energy & Accessibility ─────────────────────────────────────────────────

  {
    id: "ct-epc",
    complianceType: "Energy Performance Certificate",
    frequency: "10_yearly",
    legalRef: "Energy Performance of Buildings (England and Wales) Regulations 2012",
    defaultLeadDays: 90,
    conditions: { siteTypes: ["residential", "commercial", "mixed_use", "industrial"] },
    repairingScope: "landlord",
  },
  {
    id: "ct-accessibility-audit",
    complianceType: "Accessibility Audit",
    frequency: "5_yearly",
    legalRef: "Equality Act 2010",
    defaultLeadDays: 90,
    conditions: { siteTypes: ["commercial", "mixed_use"] },
    repairingScope: "tenant",
  },

  // ─── Listed Building ────────────────────────────────────────────────────────

  {
    id: "ct-listed-building-consent",
    complianceType: "Listed Building Consent Review",
    frequency: "on_change",
    legalRef: "Planning (Listed Buildings and Conservation Areas) Act 1990",
    defaultLeadDays: 60,
    conditions: { listedOnly: true },
    repairingScope: "both",
  },

  // ─── UPS / Generator ────────────────────────────────────────────────────────

  {
    id: "ct-ups-service",
    complianceType: "UPS Service",
    frequency: "annual",
    legalRef: "BS EN 62040",
    defaultLeadDays: 45,
    conditions: { requiredAssetType: "UPS" },
    repairingScope: "tenant",
  },
];

/**
 * Lookup a template by ID.
 */
export function getTemplateById(id: string): ComplianceTemplate | undefined {
  return COMPLIANCE_TEMPLATES.find((t) => t.id === id);
}

/**
 * Return all unique compliance types defined in the templates.
 * Useful for populating dropdowns without hardcoding strings elsewhere.
 */
export function getAllComplianceTypes(): string[] {
  return [...new Set(COMPLIANCE_TEMPLATES.map((t) => t.complianceType))].sort();
}
