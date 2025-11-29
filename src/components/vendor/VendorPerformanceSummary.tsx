import React from 'react';
import { Surface, Text } from '@/components/filla';
import { VendorPerformance } from '@/hooks/vendor/useVendorReporting';

interface VendorPerformanceSummaryProps {
  performance: VendorPerformance;
}

export const VendorPerformanceSummary: React.FC<VendorPerformanceSummaryProps> = ({ performance }) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Surface variant="neomorphic" className="p-6 text-center">
        <Text variant="caption" className="mb-2">Overall Score</Text>
        <div className="text-4xl font-bold text-primary">{performance.score}%</div>
      </Surface>
      
      <Surface variant="neomorphic" className="p-6 text-center">
        <Text variant="caption" className="mb-2">On-Time Completion</Text>
        <div className="text-4xl font-bold text-success">{performance.onTime}%</div>
      </Surface>
    </div>
  );
};
