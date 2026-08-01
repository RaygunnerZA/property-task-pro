/**
 * ComplianceRulesSection
 *
 * Lists active compliance_rules for a property.
 * Used on PropertyCompliance setup (`/properties/:id/compliance`).
 */

import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/design-system/LoadingState";
import { PanelSectionTitle } from "@/components/ui/panel-section-title";
import { ComplianceRuleRow } from "./ComplianceRuleRow";
import {
  ComplianceRulesEmptyWithTemplates,
  ComplianceRuleTemplatePicker,
} from "./ComplianceRuleTemplates";
import { useComplianceRules } from "@/hooks/useComplianceRules";
import type { ComplianceRuleWithStatus } from "@/hooks/useComplianceRules";
import {
  availableComplianceRuleTemplates,
  type ComplianceRuleTemplate,
} from "@/data/complianceRuleTemplates";

interface ComplianceRulesSectionProps {
  propertyId: string;
  /** Triggered when user clicks Add Rule or Edit on a row */
  onAddRule?: () => void;
  onEditRule?: (rule: ComplianceRuleWithStatus) => void;
  /** Prefill create modal from a starter template */
  onUseTemplate?: (template: ComplianceRuleTemplate) => void;
}

export function ComplianceRulesSection({
  propertyId,
  onAddRule,
  onEditRule,
  onUseTemplate,
}: ComplianceRulesSectionProps) {
  const { data: rules = [], isLoading } = useComplianceRules(propertyId);
  const templates = availableComplianceRuleTemplates(rules.map((r) => r.name ?? ""));

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between gap-2">
        <PanelSectionTitle as="h2" className="mb-0 flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" aria-hidden />
          Compliance Rules
          {rules.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              ({rules.length})
            </span>
          )}
        </PanelSectionTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={onAddRule}
          disabled={!onAddRule}
          className="gap-1.5"
        >
          Add Rule
        </Button>
      </div>

      {isLoading ? (
        <LoadingState message="Loading compliance rules…" />
      ) : rules.length === 0 ? (
        <ComplianceRulesEmptyWithTemplates
          templates={templates}
          onSelectTemplate={(t) => {
            if (onUseTemplate) onUseTemplate(t);
            else onAddRule?.();
          }}
          onAddCustom={() => onAddRule?.()}
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {rules.map((rule) => (
              <ComplianceRuleRow
                key={rule.id}
                rule={rule}
                onEdit={onEditRule}
              />
            ))}
          </div>
          {onUseTemplate && templates.length > 0 && (
            <ComplianceRuleTemplatePicker
              templates={templates}
              onSelect={onUseTemplate}
            />
          )}
        </div>
      )}
    </div>
  );
}
