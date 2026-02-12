import { useMemo } from "react";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { ContractorComplianceRow } from "@/components/compliance/ContractorComplianceRow";
import { ContractorHazardChart } from "@/components/compliance/ContractorHazardChart";
import { useContractorComplianceQuery } from "@/hooks/useContractorComplianceQuery";
import { User, AlertTriangle, Calendar, Zap } from "lucide-react";
import { addDays, isWithinInterval, differenceInCalendarDays } from "date-fns";
import { HAZARD_CATEGORIES, getHazardLabel } from "@/lib/hazards";

export default function ContractorCompliance() {
  const { data: items = [], isLoading } = useContractorComplianceQuery();

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
      </div>
  );
}
