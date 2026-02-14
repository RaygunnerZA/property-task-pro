import { useState, useMemo } from "react";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { CompliancePortfolioSummary } from "@/components/compliance/CompliancePortfolioSummary";
import { CompliancePropertyRow } from "@/components/compliance/CompliancePropertyRow";
import { ComplianceDetailDrawer } from "@/components/compliance/ComplianceDetailDrawer";
import { ComplianceRecommendationCard } from "@/components/compliance/ComplianceRecommendationCard";
import { ComplianceRecommendationDrawer } from "@/components/compliance/ComplianceRecommendationDrawer";
import { HazardBadge } from "@/components/compliance/HazardBadge";
import { useCompliancePortfolioQuery } from "@/hooks/useCompliancePortfolioQuery";
import { useComplianceRecommendations } from "@/hooks/useComplianceRecommendations";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useContractorComplianceQuery } from "@/hooks/useContractorComplianceQuery";
import { Building2, Network, ChevronDown, ChevronUp, Zap, Bot } from "lucide-react";
import { HAZARD_CATEGORIES, getHazardLabel } from "@/lib/hazards";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useOrgAutoTasksStats } from "@/hooks/useOrgAutoTasksStats";

export default function PortfolioCompliance() {
  const [hazardFilter, setHazardFilter] = useState<string>("all");
  const [contractorFilter, setContractorFilter] = useState<string>("all");
  const [aiConfidenceFilter, setAiConfidenceFilter] = useState<string>("all");
  const { orgId } = useActiveOrg();
  const { data: portfolio = [], isLoading } = useCompliancePortfolioQuery();
  const { data: contractorItems = [] } = useContractorComplianceQuery();
  const { data: autoStats } = useOrgAutoTasksStats(orgId);
  const { data: recommendations = [] } = useComplianceRecommendations();
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);

  const selectedRec = useMemo(
    () => recommendations.find((r) => r.id === selectedRecId) ?? null,
    [recommendations, selectedRecId]
  );

  const recommendationsByProperty = useMemo(() => {
    const map = new Map<string, typeof recommendations>();
    for (const r of recommendations) {
      const pid = r.property_id || "__unassigned__";
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(r);
    }
    return map;
  }, [recommendations]);

  const contractorIds = useMemo(() => {
    const ids = new Set(contractorItems.map((c) => c.contractor_org_id));
    return Array.from(ids);
  }, [contractorItems]);

  const contractorNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contractorItems) {
      map.set(c.contractor_org_id, c.contractor_name);
    }
    return map;
  }, [contractorItems]);

  const contractorComplianceIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const c of contractorItems) {
      if (!map.has(c.contractor_org_id)) map.set(c.contractor_org_id, new Set());
      map.get(c.contractor_org_id)!.add(c.compliance_document_id);
    }
    return map;
  }, [contractorItems]);

  const filteredPortfolio = useMemo(() => {
    let items = portfolio;
    if (hazardFilter !== "all") {
      items = items.filter((p: any) => Array.isArray(p.hazards) && p.hazards.includes(hazardFilter));
    }
    if (contractorFilter !== "all") {
      const ids = contractorComplianceIds.get(contractorFilter);
      if (ids) items = items.filter((p: any) => ids.has(p.id));
      else items = [];
    }
    if (aiConfidenceFilter === "high" && items.length > 0) {
      items = items.filter((p: any) => (p.ai_confidence ?? 0) >= 0.8);
    } else if (aiConfidenceFilter === "medium" && items.length > 0) {
      items = items.filter((p: any) => {
        const c = p.ai_confidence ?? 0;
        return c >= 0.5 && c < 0.8;
      });
    } else if (aiConfidenceFilter === "low" && items.length > 0) {
      items = items.filter((p: any) => (p.ai_confidence ?? 0) < 0.5);
    }
    return items;
  }, [portfolio, hazardFilter, contractorFilter, aiConfidenceFilter, contractorComplianceIds]);
  const { data: properties = [] } = usePropertiesQuery();

  const propertyMap = useMemo(() => {
    const map = new Map<
      string,
      { expired: number; expiring: number; valid: number; total: number; hazardCount: number; assetLinksCount: number; spaceLinksCount: number }
    >();
    for (const item of filteredPortfolio) {
      const pid = item.property_id || "__unassigned__";
      const current = map.get(pid) || { expired: 0, expiring: 0, valid: 0, total: 0, hazardCount: 0, assetLinksCount: 0, spaceLinksCount: 0 };
      current.total += 1;
      if (item.expiry_state === "expired") current.expired += 1;
      else if (item.expiry_state === "expiring") current.expiring += 1;
      else if (item.expiry_state === "valid") current.valid += 1;
      const hazards = Array.isArray(item.hazards) ? item.hazards : [];
      if (hazards.length > 0) current.hazardCount += hazards.length;
      const assetIds = Array.isArray(item.linked_asset_ids) ? item.linked_asset_ids : [];
      current.assetLinksCount += assetIds.length;
      const spaceIds = Array.isArray(item.space_ids) ? item.space_ids : [];
      current.spaceLinksCount += spaceIds.length;
      map.set(pid, current);
    }
    return map;
  }, [filteredPortfolio]);

  const propertyRows = useMemo(() => {
    return properties
      .filter((p: any) => propertyMap.has(p.id))
      .map((p: any) => {
        const counts = propertyMap.get(p.id)!;
        return {
          id: p.id,
          name: p.nickname || p.address || "Unnamed",
          ...counts,
        };
      });
  }, [properties, propertyMap]);

  const unassignedCount = propertyMap.get("__unassigned__")?.total ?? 0;

  const [showItemsTable, setShowItemsTable] = useState(false);
  const [drawerCompliance, setDrawerCompliance] = useState<{
    id: string;
    title?: string | null;
    property_id?: string | null;
    property_name?: string | null;
    expiry_date?: string | null;
    next_due_date?: string | null;
    expiry_state?: string;
    document_type?: string | null;
    hazards?: string[] | null;
  } | null>(null);

  if (isLoading) {
    return <LoadingState message="Loading portfolio compliance..." />;
  }

  return (
    <div className="space-y-6">
      <CompliancePortfolioSummary items={filteredPortfolio} />

      {autoStats && (
        <div className="rounded-lg p-4 shadow-e1 bg-card border border-border/50">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Automation
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg p-3 bg-muted/30 flex items-center gap-2">
              <span className="text-2xl font-bold text-foreground">{autoStats.today}</span>
              <span className="text-xs text-muted-foreground">Auto-tasks today</span>
            </div>
            <div className="rounded-lg p-3 bg-muted/30 flex items-center gap-2">
              <span className="text-2xl font-bold text-foreground">{autoStats.week}</span>
              <span className="text-xs text-muted-foreground">This week</span>
            </div>
            <div className="rounded-lg p-3 bg-muted/30 flex items-center gap-2">
              <span className="text-2xl font-bold text-foreground">{autoStats.month}</span>
              <span className="text-xs text-muted-foreground">This month</span>
            </div>
            <div className={cn(
              "rounded-lg p-3 flex items-center gap-2",
              autoStats.overdueWithoutTask > 0 ? "bg-destructive/10" : "bg-muted/30"
            )}>
              <span className="text-2xl font-bold text-foreground">{autoStats.overdueWithoutTask}</span>
              <span className="text-xs text-muted-foreground">Overdue, no auto-task</span>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="properties" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="properties">By Property</TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-1.5">
            <Zap className="h-4 w-4" />
            Recommended Actions
            {recommendations.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-primary/20 text-primary">
                {recommendations.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="mt-0 space-y-6">
      <div className="flex flex-wrap gap-3">
        <Select value={hazardFilter} onValueChange={setHazardFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="By hazard" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All hazards</SelectItem>
            {HAZARD_CATEGORIES.map((h) => (
              <SelectItem key={h} value={h}>
                {getHazardLabel(h)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={contractorFilter} onValueChange={setContractorFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="By contractor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All contractors</SelectItem>
            {contractorIds.map((id) => (
              <SelectItem key={id} value={id}>
                {contractorNames.get(id) || "Unknown"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={aiConfidenceFilter} onValueChange={setAiConfidenceFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="AI confidence" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All confidence</SelectItem>
            <SelectItem value="high">High (≥80%)</SelectItem>
            <SelectItem value="medium">Medium (50–80%)</SelectItem>
            <SelectItem value="low">Low (&lt;50%)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">By Property</h2>
          {propertyRows.length === 0 && unassignedCount === 0 ? (
            <EmptyState
              icon={Building2}
              title="No compliance items"
              description="Compliance items will appear here when added"
            />
          ) : (
            <div className="space-y-2">
              {propertyRows.map((row) => (
                <CompliancePropertyRow
                  key={row.id}
                  propertyId={row.id}
                  propertyName={row.name}
                  expiredCount={row.expired}
                  expiringCount={row.expiring}
                  validCount={row.valid}
                  totalCount={row.total}
                  hazardCount={row.hazardCount}
                  assetLinksCount={row.assetLinksCount}
                  spaceLinksCount={row.spaceLinksCount}
                />
              ))}
              {unassignedCount > 0 && (
                <div className="p-4 rounded-lg bg-card shadow-e1 border border-border/50 text-muted-foreground">
                  <div className="font-medium text-foreground">Unassigned / No Property</div>
                  <div className="text-sm mt-1">{unassignedCount} compliance items</div>
                </div>
              )}
            </div>
          )}
      </div>

      {filteredPortfolio.length > 0 && (
        <Collapsible open={showItemsTable} onOpenChange={setShowItemsTable}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Network className="h-4 w-4" />
                Compliance items & Knowledge Graph
              </span>
              {showItemsTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 rounded-lg border border-border/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/50">
                    <th className="text-left p-3 font-medium">Title</th>
                    <th className="text-left p-3 font-medium">Property</th>
                    <th className="text-left p-3 font-medium">Hazards</th>
                    <th className="text-left p-3 font-medium">Assets</th>
                    <th className="text-left p-3 font-medium">Spaces</th>
                    <th className="text-left p-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPortfolio.map((item: any) => (
                    <tr key={item.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                      <td className="p-3 font-medium">{item.title || "Untitled"}</td>
                      <td className="p-3 text-muted-foreground">{item.property_name || "—"}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(item.hazards) ? item.hazards : []).map((h: string) => (
                            <HazardBadge key={h} hazard={h} size="sm" />
                          ))}
                          {(!item.hazards || item.hazards.length === 0) && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="p-3">{(Array.isArray(item.linked_asset_ids) ? item.linked_asset_ids : []).length}</td>
                      <td className="p-3">{(Array.isArray(item.space_ids) ? item.space_ids : []).length}</td>
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDrawerCompliance({
                              id: item.id,
                              title: item.title,
                              property_id: item.property_id,
                              property_name: item.property_name,
                              expiry_date: item.expiry_date,
                              next_due_date: item.next_due_date,
                              expiry_state: item.expiry_state,
                              document_type: item.document_type,
                              hazards: item.hazards,
                            })
                          }
                        >
                          <Network className="h-4 w-4 mr-1" />
                          View graph
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

        </TabsContent>

        <TabsContent value="recommendations" className="mt-0">
          {recommendations.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No pending recommendations"
              description="AI-generated recommendations will appear here when documents are analysed"
            />
          ) : (
            <div className="space-y-4">
              {properties
                .filter((p) => recommendationsByProperty.has(p.id))
                .sort((a, b) => {
                  const aRecs = recommendationsByProperty.get(a.id) ?? [];
                  const bRecs = recommendationsByProperty.get(b.id) ?? [];
                  const aHigh = aRecs.some((r) => r.risk_level === "critical" || r.risk_level === "high");
                  const bHigh = bRecs.some((r) => r.risk_level === "critical" || r.risk_level === "high");
                  if (aHigh && !bHigh) return -1;
                  if (!aHigh && bHigh) return 1;
                  return bRecs.length - aRecs.length;
                })
                .map((p) => (
                  <div key={p.id}>
                    <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {p.nickname || p.address || "Unnamed"}
                    </h3>
                    <div className="space-y-2">
                      {(recommendationsByProperty.get(p.id) ?? [])
                        .sort((a, b) => {
                          const order = { critical: 0, high: 1, medium: 2, low: 3 };
                          return (order[a.risk_level as keyof typeof order] ?? 4) - (order[b.risk_level as keyof typeof order] ?? 4);
                        })
                        .map((rec) => (
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
                  </div>
                ))}
              {recommendationsByProperty.has("__unassigned__") && (
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Unassigned</h3>
                  <div className="space-y-2">
                    {(recommendationsByProperty.get("__unassigned__") ?? []).map((rec) => (
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
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ComplianceDetailDrawer
        open={!!drawerCompliance}
        onOpenChange={(open) => !open && setDrawerCompliance(null)}
        compliance={drawerCompliance}
      />

      <ComplianceRecommendationDrawer
        open={!!selectedRec}
        onOpenChange={(o) => !o && setSelectedRecId(null)}
        recommendation={selectedRec}
        documentTitle={selectedRec ? (selectedRec as any)._doc?.title : undefined}
        propertyName={selectedRec ? (selectedRec as any)._doc?.property_name : undefined}
        propertyId={selectedRec?.property_id ?? undefined}
        expiryDate={selectedRec ? (selectedRec as any)._doc?.expiry_date : undefined}
        nextDueDate={selectedRec ? (selectedRec as any)._doc?.next_due_date : undefined}
      />
    </div>
  );
}
