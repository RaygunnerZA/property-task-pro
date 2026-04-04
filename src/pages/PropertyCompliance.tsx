import { useState, useMemo, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { useComplianceRecommendations } from "@/hooks/useComplianceRecommendations";
import { StandardPageWithBack } from "@/components/design-system/StandardPageWithBack";
import { LoadingState } from "@/components/design-system/LoadingState";
import { FrameworkEmptyState } from "@/components/property-framework";
import { ComplianceCard } from "@/components/compliance/ComplianceCard";
import { ComplianceSuggestionsCard } from "@/components/compliance/ComplianceSuggestionsCard";
import { ComplianceRecommendationCard } from "@/components/compliance/ComplianceRecommendationCard";
import { ComplianceRulesSection } from "@/components/compliance/ComplianceRulesSection";
import { ComplianceRuleModal } from "@/components/compliance/ComplianceRuleModal";
import { ComplianceAutomationPanel } from "@/components/compliance/ComplianceAutomationPanel";
import { ComplianceRecommendationDrawer } from "@/components/compliance/ComplianceRecommendationDrawer";
import { ComplianceScoreHeroCard, StatusGroupedSection } from "@/components/property-framework";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Shield, Zap } from "lucide-react";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { usePropertyAutoTasks } from "@/hooks/usePropertyAutoTasks";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { PropertyIntelligencePanel } from "@/components/properties/PropertyIntelligencePanel";
import { usePropertyProfile } from "@/hooks/usePropertyProfile";
import { evaluateProfile, normalizePropertyProfile } from "@/services/propertyIntelligence/ruleEvaluator";
import { supabase } from "@/integrations/supabase/client";

export default function PropertyCompliance() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { orgId } = useActiveOrg();
  const { data: compliance = [], isLoading } = useComplianceQuery(id || undefined);
  const { data: recommendations = [], isLoading: recsLoading } = useComplianceRecommendations(id || undefined);
  const { data: autoTasks = [] } = usePropertyAutoTasks(id || undefined);
  const { data: assetsData = [] } = useAssetsQuery(id || undefined);
  const { data: rawProfile } = usePropertyProfile(id || undefined);
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);

  useEffect(() => {
    if (searchParams.get("addRule") !== "1") return;
    setEditingRule(null);
    setRuleModalOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("addRule");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const assetVectors = assetsData.map((a: any) => ({
    asset_type: a.asset_type,
    condition_score: a.condition_score,
    install_date: a.install_date,
  }));
  const complianceVectors = compliance.map((c: any) => ({
    document_type: c.document_type,
  }));

  const intelligenceResult = useMemo(() => {
    if (!rawProfile) return undefined;
    return evaluateProfile(normalizePropertyProfile(rawProfile));
  }, [rawProfile]);

  const selectedRec = useMemo(
    () => recommendations.find((r) => r.id === selectedRecId) ?? null,
    [recommendations, selectedRecId]
  );

  const handleReanalyse = async () => {
    if (!id || !orgId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-doc-reanalyse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ org_id: orgId, property_id: id, overwrite: true }),
    });
  };

  const { expired, expiring, upcoming } = useMemo(() => {
    const expired = compliance.filter((c: any) => c.expiry_status === "expired");
    const expiring = compliance.filter((c: any) => c.expiry_status === "expiring");
    const upcoming = compliance.filter(
      (c: any) => c.expiry_status === "valid" || c.expiry_status === "none"
    );
    return { expired, expiring, upcoming };
  }, [compliance]);

  const complianceScore = useMemo(() => {
    if (compliance.length === 0) return 100;
    const valid = compliance.filter((c: any) => c.expiry_status === "valid" || c.expiry_status === "none").length;
    return Math.round((valid / compliance.length) * 100);
  }, [compliance]);

  // Sort by urgency
  const sortedExpired = useMemo(
    () => [...expired].sort((a, b) => (a.days_until_expiry ?? 0) - (b.days_until_expiry ?? 0)),
    [expired]
  );
  const sortedExpiring = useMemo(
    () => [...expiring].sort((a, b) => (a.days_until_expiry ?? 0) - (b.days_until_expiry ?? 0)),
    [expiring]
  );
  const sortedUpcoming = useMemo(
    () => [...upcoming].sort((a, b) => (a.days_until_expiry ?? Infinity) - (b.days_until_expiry ?? Infinity)),
    [upcoming]
  );

  return (
    <StandardPageWithBack
      title="Property Compliance"
      backTo={`/properties/${id}`}
      icon={<Shield className="h-6 w-6" />}
      maxWidth="lg"
    >
      {isLoading ? (
        <LoadingState message="Loading property compliance..." />
      ) : (
        <Tabs defaultValue="schedule" className="w-full">
          <TabsList className="mb-6 w-full grid grid-cols-3">
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-6 mt-0">
            {/* Intelligence suggestions — shown when Filla detects compliance gaps */}
            {id && <ComplianceSuggestionsCard propertyId={id} />}

            {/* Compliance Score Hero - Framework V2 */}
            <ComplianceScoreHeroCard
              scorePercent={complianceScore}
              criticalCount={sortedExpired.length}
              dueSoonCount={sortedExpiring.length}
              onViewCritical={sortedExpired.length > 0 ? () => {} : undefined}
            />

            {/* Property Intelligence (Phase 11 + Sprint 2) */}
            <PropertyIntelligencePanel
              assetVectors={assetVectors}
              complianceVectors={complianceVectors}
              intelligenceResult={intelligenceResult}
            />

            {/* Automation Panel (Sprint 3) */}
            {id && <ComplianceAutomationPanel propertyId={id} />}

            {/* Intelligent Recommendations (Phase 11) — shown in PropertyIntelligencePanel above */}

            {/* Recommended Actions */}
            {recommendations.length > 0 && (
              <section>
                <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Recommended Actions ({recommendations.length})
                </h2>
                <div className="space-y-2">
                  {recommendations.map((rec) => (
                    <ComplianceRecommendationCard
                      key={rec.id}
                      recommendation={rec}
                      documentTitle={(rec as any)._doc?.title}
                      propertyName={(rec as any)._doc?.property_name}
                      expiryDate={(rec as any)._doc?.expiry_date}
                      nextDueDate={(rec as any)._doc?.next_due_date}
                      spaceCount={(rec as any)._doc?.space_ids?.length ?? 0}
                      assetCount={(rec as any)._doc?.linked_asset_ids?.length ?? 0}
                      onClick={() => setSelectedRecId(rec.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Required Actions - Framework V2 StatusGroupedSection */}
            <StatusGroupedSection
              severity="critical"
              title={`Critical (${sortedExpired.length})`}
              items={sortedExpired.map((item) => (
                <ComplianceCard key={item.id} compliance={item} />
              ))}
              emptyMessage="No expired items"
            />

            <StatusGroupedSection
              severity="warning"
              title={`Due Soon (${sortedExpiring.length})`}
              items={sortedExpiring.map((item) => (
                <ComplianceCard key={item.id} compliance={item} />
              ))}
              emptyMessage="No items due within 30 days"
            />

            <StatusGroupedSection
              severity="neutral"
              title={`Scheduled (${sortedUpcoming.length})`}
              items={sortedUpcoming.map((item) => (
                <ComplianceCard key={item.id} compliance={item} />
              ))}
              emptyMessage="No upcoming items"
            />
          </TabsContent>

          <TabsContent value="overview" className="space-y-4 mt-0">
            {compliance.length === 0 ? (
              <FrameworkEmptyState
                icon={Shield}
                title="No compliance items"
                description="Compliance items for this property will appear here"
              />
            ) : (
              <div className="space-y-2">
                {compliance.map((item) => (
                  <ComplianceCard key={item.id} compliance={item} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rules" className="mt-0">
            {id && (
              <ComplianceRulesSection
                propertyId={id}
                onAddRule={() => {
                  setEditingRule(null);
                  setRuleModalOpen(true);
                }}
                onEditRule={(rule) => {
                  setEditingRule(rule);
                  setRuleModalOpen(true);
                }}
              />
            )}
          </TabsContent>
        </Tabs>
      )}

      <ComplianceRecommendationDrawer
        open={!!selectedRec}
        onOpenChange={(o) => !o && setSelectedRecId(null)}
        recommendation={selectedRec}
        documentTitle={selectedRec ? (selectedRec as any)._doc?.title : undefined}
        propertyName={selectedRec ? (selectedRec as any)._doc?.property_name : undefined}
        propertyId={selectedRec?.property_id ?? id}
        expiryDate={selectedRec ? (selectedRec as any)._doc?.expiry_date : undefined}
        nextDueDate={selectedRec ? (selectedRec as any)._doc?.next_due_date : undefined}
        onReanalyse={id ? handleReanalyse : undefined}
      />

      {id && (
        <ComplianceRuleModal
          open={ruleModalOpen}
          onOpenChange={setRuleModalOpen}
          propertyId={id}
          editRule={editingRule}
        />
      )}
    </StandardPageWithBack>
  );
}
