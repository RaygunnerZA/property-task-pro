import { describe, expect, it } from "vitest";
import {
  COMPLIANCE_RULE_TEMPLATES,
  availableComplianceRuleTemplates,
  getComplianceRuleTemplate,
} from "@/data/complianceRuleTemplates";

describe("complianceRuleTemplates", () => {
  it("exposes a small set of easy defaults", () => {
    expect(COMPLIANCE_RULE_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    expect(COMPLIANCE_RULE_TEMPLATES.length).toBeLessThanOrEqual(6);
  });

  it("maps each template to creatable form values", () => {
    for (const template of COMPLIANCE_RULE_TEMPLATES) {
      expect(template.values.name.trim().length).toBeGreaterThan(0);
      expect(template.values.frequency).toBeTruthy();
      expect(template.values.scope_type).toBe("property");
    }
  });

  it("looks up by id", () => {
    const first = COMPLIANCE_RULE_TEMPLATES[0];
    expect(getComplianceRuleTemplate(first.id)?.name).toBe(first.name);
    expect(getComplianceRuleTemplate("missing")).toBeUndefined();
  });

  it("hides templates that already match an existing rule name", () => {
    const taken = COMPLIANCE_RULE_TEMPLATES[0].name;
    const available = availableComplianceRuleTemplates([taken, "  " + taken.toUpperCase()]);
    expect(available.every((t) => t.name !== taken)).toBe(true);
    expect(available.length).toBe(COMPLIANCE_RULE_TEMPLATES.length - 1);
  });
});
