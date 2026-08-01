import { useEffect, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { Bot, Shield } from "lucide-react";
import { StandardPageWithBack } from "@/components/design-system/StandardPageWithBack";
import { PropertyPageScopeBar } from "@/components/properties/PropertyPageScopeBar";
import { ComplianceRulesSection } from "@/components/compliance/ComplianceRulesSection";
import { ComplianceRuleModal } from "@/components/compliance/ComplianceRuleModal";
import { ComplianceRulesContext } from "@/components/compliance/ComplianceRuleTemplates";
import { WorkspaceSectionHeading } from "@/components/property-workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useComplianceRules } from "@/hooks/useComplianceRules";
import type { ComplianceRuleWithStatus } from "@/hooks/useComplianceRules";
import type { ComplianceRuleFormValues } from "@/hooks/useUpsertComplianceRule";
import type { ComplianceRuleTemplate } from "@/data/complianceRuleTemplates";
import {
  propertyComplianceSetupPath,
  propertyHubRecordsPath,
} from "@/lib/propertyRoutes";

/**
 * Property compliance setup — recurring rules for this property.
 * Portfolio / certificates live in Records; org automation lives in Settings.
 */
export default function PropertyCompliance() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const propertyId = id ?? "";
  const { data: properties = [] } = usePropertiesQuery();
  const { data: rules = [] } = useComplianceRules(propertyId || undefined);

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ComplianceRuleWithStatus | null>(null);
  const [draftValues, setDraftValues] = useState<ComplianceRuleFormValues | null>(null);

  const property = properties.find((p: { id: string }) => p.id === propertyId) as
    | { name?: string; icon_color_hex?: string | null }
    | undefined;
  const headerAccent = property?.icon_color_hex?.trim() || "#8EC9CE";
  const automatedRuleCount = rules.filter((r) => r.auto_create).length;

  const openCreateModal = (initial?: ComplianceRuleFormValues | null) => {
    setEditingRule(null);
    setDraftValues(initial ?? null);
    setRuleModalOpen(true);
  };

  const handleUseTemplate = (template: ComplianceRuleTemplate) => {
    openCreateModal(template.values);
  };

  useEffect(() => {
    if (!propertyId || searchParams.get("addRule") !== "1") return;
    setEditingRule(null);
    setDraftValues(null);
    setRuleModalOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("addRule");
    setSearchParams(next, { replace: true });
  }, [propertyId, searchParams, setSearchParams]);

  if (!id) {
    return <Navigate to="/properties" replace />;
  }

  return (
    <StandardPageWithBack
      title="Compliance rules"
      subtitle={
        property?.name
          ? `Recurring obligations for ${property.name}`
          : "Recurring obligations for this property"
      }
      backTo={propertyHubRecordsPath(propertyId, "compliance")}
      icon={<Shield className="h-6 w-6" />}
      maxWidth="md"
      headerAccentColor={headerAccent}
      hideHeaderBack
      belowGradientRow={
        <PropertyPageScopeBar
          propertyId={propertyId}
          hrefForProperty={(pid) => propertyComplianceSetupPath(pid)}
          backHref={propertyHubRecordsPath(propertyId, "compliance")}
        />
      }
    >
      <div className="space-y-6">
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
            onUseTemplate={handleUseTemplate}
          />
        </section>

        <section className="space-y-3">
          <WorkspaceSectionHeading>Automation</WorkspaceSectionHeading>
          <Card className="shadow-e1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                Organisation automation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Auto-create tasks, overdue alerts, and contractor assignment are organisation-wide —
                not per property.
              </p>
              {rules.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{automatedRuleCount}</span> of{" "}
                  <span className="font-medium text-foreground">{rules.length}</span> rule
                  {rules.length !== 1 ? "s" : ""} on this property set to auto-create tasks
                </p>
              )}
              <Link
                to="/settings/automation"
                className="inline-flex text-sm font-medium text-primary hover:underline"
              >
                Open Automation &amp; AI settings
              </Link>
            </CardContent>
          </Card>
        </section>
      </div>

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
    </StandardPageWithBack>
  );
}
