import React from 'react';
import { VendorReportingHeader } from '@/components/vendor/VendorReportingHeader';
import { VendorPerformanceSummary } from '@/components/vendor/VendorPerformanceSummary';
import { VendorSLABreakdown } from '@/components/vendor/VendorSLABreakdown';
import { VendorTaskCompletionChart } from '@/components/vendor/VendorTaskCompletionChart';
import { VendorDriftResolutionStats } from '@/components/vendor/VendorDriftResolutionStats';
import { useVendorReporting } from '@/hooks/vendor/useVendorReporting';

export default function VendorReporting() {
  const { performance, sla, completion, drift, isLoading } = useVendorReporting();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper p-4 flex items-center justify-center">
        <div className="text-muted-foreground">Loading performance data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper p-4 pb-24 space-y-6">
      <VendorReportingHeader />
      <VendorPerformanceSummary performance={performance} />
      <VendorSLABreakdown sla={sla} />
      <VendorTaskCompletionChart completion={completion} />
      <VendorDriftResolutionStats drift={drift} />
    </div>
  );
}
