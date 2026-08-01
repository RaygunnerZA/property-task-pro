/**
 * Easy default compliance rule templates for property setup.
 *
 * These are starting points only — UK-oriented common obligations.
 * Users should review before saving (see starterTemplateDisclaimer).
 */

import type { ComplianceRuleFormValues } from "@/hooks/useUpsertComplianceRule";
import type { ComplianceFrequency } from "@/services/propertyIntelligence/frequencyUtils";

export interface ComplianceRuleTemplate {
  id: string;
  /** Short label for chips / cards */
  name: string;
  /** One-line “why this exists” for the picker */
  summary: string;
  /** Example line shown in the context section */
  example: string;
  frequency: ComplianceFrequency;
  frequencyLabel: string;
  /** Stronger legal-positioning badge */
  isRegulatedArea?: boolean;
  values: ComplianceRuleFormValues;
}

export const COMPLIANCE_RULE_TEMPLATES: ComplianceRuleTemplate[] = [
  {
    id: "rule-gas-safety",
    name: "Gas Safety Certificate",
    summary: "Annual CP12 check for properties with gas appliances.",
    example: "Gas Safety — every year, remind 30 days before",
    frequency: "annual",
    frequencyLabel: "Annual",
    isRegulatedArea: true,
    values: {
      name: "Gas Safety Certificate",
      description:
        "Annual gas safety inspection (CP12). Common landlord obligation where gas appliances are present.",
      frequency: "annual",
      scope_type: "property",
      auto_create: true,
      template_config: {
        title_template: "Annual gas safety check",
        default_priority: "high",
      },
      notify_days_before: 30,
    },
  },
  {
    id: "rule-fire-risk",
    name: "Fire Risk Assessment",
    summary: "Periodic fire safety review for the whole property.",
    example: "Fire Risk Assessment — every year, remind 60 days before",
    frequency: "annual",
    frequencyLabel: "Annual",
    isRegulatedArea: true,
    values: {
      name: "Fire Risk Assessment",
      description:
        "Periodic fire risk assessment covering escape routes, alarms, and fire safety measures.",
      frequency: "annual",
      scope_type: "property",
      auto_create: true,
      template_config: {
        title_template: "Fire risk assessment",
        default_priority: "high",
      },
      notify_days_before: 60,
    },
  },
  {
    id: "rule-eicr",
    name: "Electrical Safety (EICR)",
    summary: "Electrical installation condition report on a 5-year cycle.",
    example: "EICR — every 5 years, remind 90 days before",
    frequency: "5_yearly",
    frequencyLabel: "Every 5 years",
    isRegulatedArea: true,
    values: {
      name: "Electrical Safety (EICR)",
      description:
        "Electrical Installation Condition Report. Often required every 5 years for rented dwellings; confirm for your property type.",
      frequency: "5_yearly",
      scope_type: "property",
      auto_create: true,
      template_config: {
        title_template: "Book EICR inspection",
        default_priority: "high",
      },
      notify_days_before: 90,
    },
  },
  {
    id: "rule-legionella",
    name: "Legionella Risk Assessment",
    summary: "Water hygiene risk review on a 2-year cycle.",
    example: "Legionella L8 — every 2 years, remind 60 days before",
    frequency: "2_yearly",
    frequencyLabel: "Every 2 years",
    isRegulatedArea: true,
    values: {
      name: "Legionella Risk Assessment",
      description:
        "Water hygiene risk assessment (HSE ACOP L8). Review frequency depends on system risk — adjust after your first assessment.",
      frequency: "2_yearly",
      scope_type: "property",
      auto_create: false,
      template_config: {
        title_template: "Legionella risk assessment",
        default_priority: "medium",
      },
      notify_days_before: 60,
    },
  },
];

export function getComplianceRuleTemplate(
  id: string
): ComplianceRuleTemplate | undefined {
  return COMPLIANCE_RULE_TEMPLATES.find((t) => t.id === id);
}

/** Templates whose name is not already covered by an existing rule. */
export function availableComplianceRuleTemplates(
  existingRuleNames: string[]
): ComplianceRuleTemplate[] {
  const taken = new Set(existingRuleNames.map((n) => n.trim().toLowerCase()));
  return COMPLIANCE_RULE_TEMPLATES.filter((t) => !taken.has(t.name.toLowerCase()));
}
