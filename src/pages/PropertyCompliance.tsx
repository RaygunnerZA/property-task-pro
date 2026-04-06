import { useState, useMemo, useEffect } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { propertyHubPath, propertySubPath } from "@/lib/propertyRoutes";
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
import { Shield, Zap, Plus, FileUp } from "lucide-react";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { usePropertyAutoTasks } from "@/hooks/usePropertyAutoTasks";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { PropertyIntelligencePanel } from "@/components/properties/PropertyIntelligencePanel";
import { usePropertyProfile } from "@/hooks/usePropertyProfile";
import { evaluateProfile, normalizePropertyProfile } from "@/services/propertyIntelligence/ruleEvaluator";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  PropertyWorkspaceLayout,
  WorkspaceSurfaceCard,
  WorkspaceSectionHeading,
  WorkspaceTabList,
  WorkspaceTabTrigger,
} from "@/components/property-workspace";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { PropertyPageScopeBar } from "@/components/properties/PropertyPageScopeBar";

type ComplianceWorkView = "due_soon" | "overdue" | "rules" | "history";

export default function PropertyCompliance() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: properties = [] } = usePropertiesQuery();
  const headerAccent =
    (
      properties.find((p: { id: string }) => p.id === id) as
        | { icon_color_hex?: string | null }
        | undefined
    )?.icon_color_hex?.trim() || "#8EC9CE";
  const { orgId } = useActiveOrg();
  const { data: compliance = [], isLoading } = useComplianceQuery(id || undefined);
  const { data: recommendations = [] } = useComplianceRecommendations(id || undefined);
  const { data: autoTasks = [] } = usePropertyAutoTasks(id || undefined);
  const { data: assetsData = [] } = useAssetsQuery(id || undefined);
  const { data: rawProfile } = usePropertyProfile(id || undefined);
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [workView, setWorkView] = useState<ComplianceWorkView>("due_soon");

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
    const {
      data: { session },
    } = await supabase.auth.getSession();
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
    const valid = compliance.filter(
      (c: any) => c.expiry_status === "valid" || c.expiry_status === "none"
    ).length;
    return Math.round((valid / compliance.length) * 100);
  }, [compliance]);

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

  const contextColumn = id ? (
    <div className="space-y-4">
      <ComplianceScoreHeroCard
        scorePercent={complianceScore}
        criticalCount={sortedExpired.length}
        dueSoonCount={sortedExpiring.length}
        onViewCritical={sortedExpired.length > 0 ? () => setWorkView("overdue") : undefined}
      />
      <WorkspaceSurfaceCard title="Posture" description="Rules and obligations on this property">
        <ul className="text-xs text-muted-foreground space-y-2">
          <li>
            <span className="font-medium text-foreground">{compliance.length}</span> active items in schedule
          </li>
          <li>
            <span className="font-medium text-foreground">{sortedExpired.length}</span> overdue
          </li>
          <li>
            <span className="font-medium text-foreground">{sortedExpiring.length}</span> due within 30 days
          </li>
          {autoTasks.length > 0 && (
            <li>
              <span className="font-medium text-foreground">{autoTasks.length}</span> automation-backed tasks
            </li>
          )}
        </ul>
      </WorkspaceSurfaceCard>
      <ComplianceSuggestionsCard propertyId={id} />
    </div>
  ) : null;

  const compliancePageHeading = (
    <header className="mb-5 min-w-0 border-b border-border/15 pb-4">
      <div className="flex items-start gap-3">
        <Shield className="h-8 w-8 shrink-0 text-primary mt-0.5" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight text-foreground heading-l">Property Compliance</h1>
          <p className="text-sm mt-1 text-muted-foreground">What is due, overdue, and what to do next</p>
        </div>
      </div>
    </header>
  );

  const workColumnInner = (
    <div className="flex flex-col gap-5">
      {compliancePageHeading}
      <div>
        <WorkspaceSectionHeading>Operational view</WorkspaceSectionHeading>
        <WorkspaceTabList>
          <WorkspaceTabTrigger selected={workView === "due_soon"} onClick={() => setWorkView("due_soon")}>
            Due soon
          </WorkspaceTabTrigger>
          <WorkspaceTabTrigger selected={workView === "overdue"} onClick={() => setWorkView("overdue")}>
            Overdue
          </WorkspaceTabTrigger>
          <WorkspaceTabTrigger selected={workView === "rules"} onClick={() => setWorkView("rules")}>
            Rules
          </WorkspaceTabTrigger>
          <WorkspaceTabTrigger selected={workView === "history"} onClick={() => setWorkView("history")}>
            Scheduled
          </WorkspaceTabTrigger>
        </WorkspaceTabList>
      </div>

      {workView === "due_soon" && (
        <div className="space-y-6">
          <PropertyIntelligencePanel
            assetVectors={assetVectors}
            complianceVectors={complianceVectors}
            intelligenceResult={intelligenceResult}
          />
          {recommendations.length > 0 && (
            <section>
              <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-primary" />
                Suggested actions ({recommendations.length})
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
          <StatusGroupedSection
            severity="warning"
            title={`Due soon (${sortedExpiring.length})`}
            items={sortedExpiring.map((item) => (
              <ComplianceCard key={item.id} compliance={item} />
            ))}
            emptyMessage="No items due within 30 days"
          />
        </div>
      )}

      {workView === "overdue" && (
        <StatusGroupedSection
          severity="critical"
          title={`Overdue (${sortedExpired.length})`}
          items={sortedExpired.map((item) => (
            <ComplianceCard key={item.id} compliance={item} />
          ))}
          emptyMessage="No expired items"
        />
      )}

      {workView === "rules" && id && (
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

      {workView === "history" && (
        <>
          {compliance.length === 0 ? (
            <FrameworkEmptyState
              icon={Shield}
              title="No compliance items"
              description="Compliance items for this property will appear here"
            />
          ) : (
            <div className="space-y-4">
              <StatusGroupedSection
                severity="neutral"
                title={`Scheduled & valid (${sortedUpcoming.length})`}
                items={sortedUpcoming.map((item) => (
                  <ComplianceCard key={item.id} compliance={item} />
                ))}
                emptyMessage="No upcoming items"
              />
            </div>
          )}
        </>
      )}
    </div>
  );

  const actionColumn = id ? (
    <div className="space-y-4">
      <WorkspaceSurfaceCard title="Add & ingest" description="Create obligations or attach evidence">
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="w-full btn-accent-vibrant justify-center gap-2"
            onClick={() => {
              setEditingRule(null);
              setRuleModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add compliance rule
          </Button>
          <Button variant="outline" className="w-full btn-neomorphic justify-center gap-2" asChild>
            <Link to={`/properties/${id}/documents?upload=1`}>
              <FileUp className="h-4 w-4" />
              Upload document
            </Link>
          </Button>
        </div>
      </WorkspaceSurfaceCard>
      <ComplianceAutomationPanel propertyId={id} />
    </div>
  ) : null;

  return (
    <StandardPageWithBack
      title="Property Compliance"
      subtitle={undefined}
      backTo={id ? propertyHubPath(id) : "/"}
      icon={<Shield className="h-6 w-6" />}
      maxWidth="full"
      contentClassName="max-w-[1480px]"
      headerAccentColor={headerAccent}
      hideHeaderBack
      hideTitleInHeader
      belowGradientRow={
        id ? (
          <PropertyPageScopeBar
            propertyId={id}
            hrefForProperty={(pid) => propertySubPath(pid, "compliance")}
          />
        ) : null
      }
    >
      {isLoading ? (
        <div className="max-w-[660px] w-full min-w-0">
          {compliancePageHeading}
          <LoadingState message="Loading property compliance..." />
        </div>
      ) : (
        <>
          <div className="workspace:block hidden">
            <PropertyWorkspaceLayout
              contextColumn={contextColumn}
              workColumn={workColumnInner}
              actionColumn={actionColumn}
            />
          </div>
          <div className="workspace:hidden flex flex-col gap-6 max-w-[660px]">
            {actionColumn}
            {workColumnInner}
            {contextColumn}
          </div>
        </>
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
