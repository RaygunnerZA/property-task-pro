/**
 * In-Records Compliance tab — recurring rules for the scoped property
 * (replaces the old Manage chip that navigated away).
 */

import { useEffect, useState } from "react";
import { Bot, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { ComplianceRulesSection } from "@/components/compliance/ComplianceRulesSection";
import { ComplianceRuleModal } from "@/components/compliance/ComplianceRuleModal";
import { ComplianceRulesContext } from "@/components/compliance/ComplianceRuleTemplates";
import { WorkspaceSectionHeading } from "@/components/property-workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useComplianceRules } from "@/hooks/useComplianceRules";
import type { ComplianceRuleWithStatus } from "@/hooks/useComplianceRules";
import type { ComplianceRuleFormValues } from "@/hooks/useUpsertComplianceRule";
import type { ComplianceRuleTemplate } from "@/data/complianceRuleTemplates";

type RecordsCompliancePanelProps = {
  propertyId: string;
  /** Open the create-rule modal once on mount / when this nonce changes. */
  openCreateNonce?: number;
};

export function RecordsCompliancePanel({
  propertyId,
  openCreateNonce = 0,
}: RecordsCompliancePanelProps) {
  const { data: rules = [] } = useComplianceRules(propertyId || undefined);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ComplianceRuleWithStatus | null>(null);
  const [draftValues, setDraftValues] = useState<ComplianceRuleFormValues | null>(null);

  const automatedRuleCount = rules.filter((r) => r.auto_create).length;

  const openCreateModal = (initial?: ComplianceRuleFormValues | null) => {
    setEditingRule(null);
    setDraftValues(initial ?? null);
    setRuleModalOpen(true);
  };

  useEffect(() => {
    if (!openCreateNonce) return;
    openCreateModal(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once per nonce
  }, [openCreateNonce]);

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-2">
      <ComplianceRulesContext />

      <section className="space-y-3">
        <WorkspaceSectionHeading>Rules</WorkspaceSectionHeading>
        <ComplianceRulesSection
          propertyId={propertyId}
          onAddRule={() => openCreateModal(null)}
          onEditRule={(rule) => {
            setDraftValues(null);
            setEditingRule(rule);
            setRuleModalOpen(true);
          }}
          onUseTemplate={(template: ComplianceRuleTemplate) => openCreateModal(template.values)}
        />
      </section>

      <section className="space-y-3">
        <WorkspaceSectionHeading>Automation</WorkspaceSectionHeading>
        <Card className="shadow-e1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-primary" />
              Organisation automation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Auto-create tasks, overdue alerts, and contractor assignment are organisation-wide —
              not per property.
            </p>
            {rules.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{automatedRuleCount}</span> of{" "}
                <span className="font-medium text-foreground">{rules.length}</span> rule
                {rules.length !== 1 ? "s" : ""} on this property set to auto-create tasks
              </p>
            ) : null}
            <Link
              to="/settings/automation"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <LinkIcon className="h-3.5 w-3.5" aria-hidden />
              Open Automation &amp; AI settings
            </Link>
          </CardContent>
        </Card>
      </section>

      <ComplianceRuleModal
        open={ruleModalOpen}
        onOpenChange={(open) => {
          setRuleModalOpen(open);
          if (!open) {
            setEditingRule(null);
            setDraftValues(null);
          }
        }}
        propertyId={propertyId}
        editRule={editingRule}
        initialValues={draftValues}
      />
    </div>
  );
}
