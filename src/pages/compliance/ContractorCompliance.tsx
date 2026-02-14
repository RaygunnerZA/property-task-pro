import { useState, useMemo } from "react";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { ContractorComplianceRow } from "@/components/compliance/ContractorComplianceRow";
import { ContractorHazardChart } from "@/components/compliance/ContractorHazardChart";
import { ComplianceRecommendationCard } from "@/components/compliance/ComplianceRecommendationCard";
import { ComplianceRecommendationDrawer } from "@/components/compliance/ComplianceRecommendationDrawer";
import { useContractorComplianceQuery } from "@/hooks/useContractorComplianceQuery";
import { useContractorRecommendations, useComplianceRecommendations } from "@/hooks/useComplianceRecommendations";
import { User, AlertTriangle, Calendar, Zap, ListTodo } from "lucide-react";
import { addDays, isWithinInterval, differenceInCalendarDays } from "date-fns";
import { HAZARD_CATEGORIES, getHazardLabel } from "@/lib/hazards";

export default function ContractorCompliance() {
  const { data: items = [], isLoading } = useContractorComplianceQuery();
  const { data: contractorRecData } = useContractorRecommendations();
  const { data: allRecommendations = [] } = useComplianceRecommendations();
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);

  const contractorRecs = contractorRecData?.contractorRecs ?? new Map();
  const docMap = contractorRecData?.docMap ?? new Map();

  const selectedRec = useMemo(
    () => allRecommendations.find((r) => r.id === selectedRecId) ?? null,
    [allRecommendations, selectedRecId]
  );

  const { byContractor, hazardSummary, avgDaysOverdueByContractor } = useMemo(() => {
    const map = new Map<
      string,
      {
        contractorOrgId: string;
        name: string;
        items: typeof items;
        expired: number;
        expiring: number;
        valid: number;
        upcoming30: number;
        upcoming90: number;
        overdueDays: number[];
      }
    >();
    const hazardCounts: Record<string, number> = {};
    for (const h of HAZARD_CATEGORIES) hazardCounts[h] = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30 = addDays(today, 30);
    const in90 = addDays(today, 90);

    for (const item of items) {
      const cid = item.contractor_org_id;
      const current = map.get(cid) || {
        contractorOrgId: cid,
        name: item.contractor_name,
        items: [],
        expired: 0,
        expiring: 0,
        valid: 0,
        upcoming30: 0,
        upcoming90: 0,
        overdueDays: [],
      };
      current.items.push(item);

      if (item.expiry_state === "expired") current.expired += 1;
      else if (item.expiry_state === "expiring") current.expiring += 1;
      else if (item.expiry_state === "valid") current.valid += 1;

      const due = item.next_due_date ? new Date(item.next_due_date) : null;
      if (due) {
        if (isWithinInterval(due, { start: today, end: in30 })) current.upcoming30 += 1;
        if (isWithinInterval(due, { start: today, end: in90 })) current.upcoming90 += 1;
      }
      const expiry = item.expiry_date ? new Date(item.expiry_date) : null;
      if (expiry && expiry < today && item.expiry_state === "expired") {
        current.overdueDays.push(differenceInCalendarDays(today, expiry));
      }
      for (const h of Array.isArray(item.hazards) ? item.hazards : []) {
        if (h in hazardCounts) hazardCounts[h as keyof typeof hazardCounts] += 1;
      }
      map.set(cid, current);
    }

    const avgOverdue = new Map<string, number>();
    for (const [cid, data] of map) {
      if (data.overdueDays.length > 0) {
        avgOverdue.set(cid, Math.round(data.overdueDays.reduce((a, b) => a + b, 0) / data.overdueDays.length));
      }
    }

    const hazardSummaryList = HAZARD_CATEGORIES.filter((h) => hazardCounts[h] > 0).map((h) => ({
      hazard: h,
      label: getHazardLabel(h),
      count: hazardCounts[h],
    }));

    return {
      byContractor: Array.from(map.values()),
      hazardSummary: hazardSummaryList,
      avgDaysOverdueByContractor: avgOverdue,
    };
  }, [items]);

  if (isLoading) {
    return <LoadingState message="Loading contractor compliance..." />;
  }

  return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-lg bg-card shadow-e1 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">By hazard type</span>
            </div>
            <div className="mt-1 text-sm text-foreground">
              {hazardSummary.length > 0
                ? hazardSummary.map((s) => `${s.label}: ${s.count}`).join(", ")
                : "No hazards"}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-card shadow-e1 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Avg days overdue</span>
            </div>
            <div className="mt-1 text-sm text-foreground">
              {avgDaysOverdueByContractor.size > 0
                ? Math.round(
                    [...avgDaysOverdueByContractor.values()].reduce((a, b) => a + b, 0) / avgDaysOverdueByContractor.size
                  )
                : 0}
              <span className="text-muted-foreground ml-1">days (avg)</span>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-card shadow-e1 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Upcoming 30d</span>
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {byContractor.reduce((a, c) => a + c.upcoming30, 0)}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-card shadow-e1 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Upcoming 90d</span>
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {byContractor.reduce((a, c) => a + c.upcoming90, 0)}
            </div>
          </div>
        </div>

        {items.some((i) => Array.isArray(i.hazards) && i.hazards.length > 0) && (
          <div className="rounded-lg bg-card shadow-e1 border border-border/50 p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Hazard distribution by contractor</h3>
            <ContractorHazardChart items={items} />
          </div>
        )}

        {contractorRecs.size > 0 && (
          <div className="rounded-lg bg-card shadow-e1 border border-border/50 p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              Actions Required of Contractor
            </h3>
            <div className="space-y-4">
              {byContractor
                .filter((c) => contractorRecs.has(c.contractorOrgId))
                .sort((a, b) => {
                  const aRecs = contractorRecs.get(a.contractorOrgId) ?? [];
                  const bRecs = contractorRecs.get(b.contractorOrgId) ?? [];
                  const aHigh = aRecs.some((r: any) => r.risk_level === "critical" || r.risk_level === "high");
                  const bHigh = bRecs.some((r: any) => r.risk_level === "critical" || r.risk_level === "high");
                  if (aHigh && !bHigh) return -1;
                  if (!aHigh && bHigh) return 1;
                  return bRecs.length - aRecs.length;
                })
                .map((c) => {
                  const recs = contractorRecs.get(c.contractorOrgId) ?? [];
                  return (
                    <div key={c.contractorOrgId}>
                      <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {c.name}
                        <span className="text-xs text-muted-foreground">({recs.length} recommendation{recs.length !== 1 ? "s" : ""})</span>
                      </h4>
                      <div className="space-y-2">
                        {recs
                          .sort((a: any, b: any) => {
                            const order = { critical: 0, high: 1, medium: 2, low: 3 };
                            return (order[a.risk_level] ?? 4) - (order[b.risk_level] ?? 4);
                          })
                          .map((rec: any) => {
                            const doc = docMap.get(rec.compliance_document_id);
                            return (
                              <ComplianceRecommendationCard
                                key={rec.id}
                                recommendation={{ ...rec, asset_ids: rec.asset_ids ?? [], space_ids: rec.space_ids ?? [], hazards: rec.hazards ?? [], recommended_tasks: rec.recommended_tasks ?? [] }}
                                documentTitle={doc?.title}
                                propertyName={doc?.property_name}
                                expiryDate={doc?.expiry_date}
                                nextDueDate={doc?.next_due_date}
                                spaceCount={doc?.space_ids?.length ?? 0}
                                assetCount={doc?.linked_asset_ids?.length ?? 0}
                                onClick={() => setSelectedRecId(rec.id)}
                              />
                            );
                          })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">By Contractor</h2>
          {byContractor.length === 0 ? (
            <EmptyState
              icon={User}
              title="No contractor assignments"
              description="Link compliance items to contractors to see them here"
            />
          ) : (
            <div className="space-y-2">
              {byContractor.map((c) => (
                <ContractorComplianceRow
                  key={c.name}
                  contractorName={c.name}
                  linkedCount={c.items.length}
                  expiredCount={c.expired}
                  expiringCount={c.expiring}
                  validCount={c.valid}
                  upcoming30={c.upcoming30}
                  upcoming90={c.upcoming90}
                  avgDaysOverdue={avgDaysOverdueByContractor.get(c.contractorOrgId)}
                />
              ))}
            </div>
          )}
        </div>

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
