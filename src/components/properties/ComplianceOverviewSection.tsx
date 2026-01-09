import { useMemo } from "react";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { ComplianceCard } from "@/components/compliance/ComplianceCard";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { Shield } from "lucide-react";

interface ComplianceOverviewSectionProps {
  propertyId: string;
}

/**
 * Compliance Overview Section
 * Renders list of ComplianceCard components
 * Sorted by urgency (expired → expiring → valid)
 */
export function ComplianceOverviewSection({
  propertyId,
}: ComplianceOverviewSectionProps) {
  const { data: compliance = [], isLoading: loading } = useComplianceQuery(propertyId);

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

  if (sortedCompliance.length === 0) {
    return (
      <EmptyState
        icon={Shield}
        title="No compliance items"
        description="Compliance items will appear here"
      />
    );
  }

  return (
    <div className="space-y-2">
      {sortedCompliance.map((item) => (
        <ComplianceCard key={item.id} compliance={item} />
      ))}
    </div>
  );
}

