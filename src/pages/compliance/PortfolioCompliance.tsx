import { useState, useMemo } from "react";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { CompliancePortfolioSummary } from "@/components/compliance/CompliancePortfolioSummary";
import { CompliancePropertyRow } from "@/components/compliance/CompliancePropertyRow";
import { ComplianceDetailDrawer } from "@/components/compliance/ComplianceDetailDrawer";
import { HazardBadge } from "@/components/compliance/HazardBadge";
import { useCompliancePortfolioQuery } from "@/hooks/useCompliancePortfolioQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useContractorComplianceQuery } from "@/hooks/useContractorComplianceQuery";
import { Building2, Network, ChevronDown, ChevronUp } from "lucide-react";
import { HAZARD_CATEGORIES, getHazardLabel } from "@/lib/hazards";
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

export default function PortfolioCompliance() {
  const [hazardFilter, setHazardFilter] = useState<string>("all");
  const [contractorFilter, setContractorFilter] = useState<string>("all");
  const [aiConfidenceFilter, setAiConfidenceFilter] = useState<string>("all");
  const { data: portfolio = [], isLoading } = useCompliancePortfolioQuery();
  const { data: contractorItems = [] } = useContractorComplianceQuery();

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

      <ComplianceDetailDrawer
        open={!!drawerCompliance}
        onOpenChange={(open) => !open && setDrawerCompliance(null)}
        compliance={drawerCompliance}
      />
    </div>
  );
}
