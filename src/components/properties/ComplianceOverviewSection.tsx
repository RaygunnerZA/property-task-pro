import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { ComplianceCard } from "@/components/compliance/ComplianceCard";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { Button } from "@/components/ui/button";
import { Shield, ChevronRight, AlertTriangle, Clock } from "lucide-react";

interface ComplianceOverviewSectionProps {
  propertyId: string;
}

/**
 * Compliance Overview Section
 * Shows summary counts (expired/expiring), link to full schedule, and list of ComplianceCard components
 * Sorted by urgency (expired → expiring → valid)
 */
export function ComplianceOverviewSection({
  propertyId,
}: ComplianceOverviewSectionProps) {
  const navigate = useNavigate();
  const { data: compliance = [], isLoading: loading } = useComplianceQuery(propertyId);

  const summary = useMemo(() => {
    const expired = compliance.filter((c: any) => c.expiry_status === "expired");
    const expiring = compliance.filter((c: any) => c.expiry_status === "expiring");
    return { expired: expired.length, expiring: expiring.length };
  }, [compliance]);

  // Sort compliance items by urgency
  const sortedCompliance = useMemo(() => {
    if (!compliance || compliance.length === 0) return [];

    // Map compliance data to include expiry_status and days_until_expiry
    const complianceWithStatus = compliance.map((doc: any) => ({
      ...doc,
      expiryStatus: doc.expiry_status || "none",
      daysUntilExpiry: doc.days_until_expiry,
    }));

    const sorted = [...complianceWithStatus];

    // Sort: expired first, then expiring, then valid
    sorted.sort((a, b) => {
      const statusOrder = (status: string | undefined) => {
        if (status === "expired") return 0;
        if (status === "expiring") return 1;
        return 2; // valid or none
      };

      const aOrder = statusOrder(a.expiry_status);
      const bOrder = statusOrder(b.expiry_status);

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      // If same status, sort by days until expiry (ascending)
      const aDays = a.days_until_expiry ?? Infinity;
      const bDays = b.days_until_expiry ?? Infinity;
      return aDays - bDays;
    });

    return sorted;
  }, [compliance]);

  if (loading) {
    return <LoadingState message="Loading compliance..." />;
  }

  return (
    <div className="space-y-3">
      {/* Summary header with counts and link to full schedule */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-sm">
          {summary.expired > 0 && (
            <span className="flex items-center gap-1.5 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {summary.expired} expired
            </span>
          )}
          {summary.expiring > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600">
              <Clock className="h-4 w-4" />
              {summary.expiring} expiring
            </span>
          )}
          {summary.expired === 0 && summary.expiring === 0 && (
            <span className="text-muted-foreground">All items valid</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary hover:text-primary/90"
          onClick={() => navigate(`/properties/${propertyId}/compliance`)}
        >
          View full schedule
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {sortedCompliance.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No compliance items"
          description="Compliance items will appear here"
        />
      ) : (
        <div className="space-y-2">
          {sortedCompliance.map((item) => (
            <ComplianceCard key={item.id} compliance={item} />
          ))}
        </div>
      )}
    </div>
  );
}

