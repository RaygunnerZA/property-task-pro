/**
 * ComplianceRulesSection
 *
 * Content for the Rules tab in PropertyCompliance.
 * Lists all active compliance_rules for a property.
 * Header row: "Compliance Rules" + "Add Rule" button (activates Sprint 3 modal).
 */

import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/design-system/LoadingState";
import { FrameworkEmptyState } from "@/components/property-framework";
import { ComplianceRuleRow } from "./ComplianceRuleRow";
import { useComplianceRules } from "@/hooks/useComplianceRules";
import type { ComplianceRuleWithStatus } from "@/hooks/useComplianceRules";

interface ComplianceRulesSectionProps {
  propertyId: string;
  /** Triggered when user clicks Add Rule or Edit on a row */
  onAddRule?: () => void;
  onEditRule?: (rule: ComplianceRuleWithStatus) => void;
}

export function ComplianceRulesSection({
  propertyId,
  onAddRule,
  onEditRule,
}: ComplianceRulesSectionProps) {
  const { data: rules = [], isLoading } = useComplianceRules(propertyId);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4 text-primary" />
          Compliance Rules
          {rules.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              ({rules.length})
            </span>
          )}
        </h2>
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
        <FrameworkEmptyState
          icon={Shield}
          title="No compliance rules yet"
          description="Add rules to track recurring compliance obligations for this property"
        />
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <ComplianceRuleRow
              key={rule.id}
              rule={rule}
              onEdit={onEditRule}
            />
          ))}
        </div>
      )}
    </div>
  );
}
