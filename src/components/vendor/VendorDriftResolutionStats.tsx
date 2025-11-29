import React from 'react';
import { Surface, Text, Heading } from '@/components/filla';
import { VendorDrift } from '@/hooks/vendor/useVendorReporting';
import { CheckSquare, Timer } from 'lucide-react';

interface VendorDriftResolutionStatsProps {
  drift: VendorDrift;
}

export const VendorDriftResolutionStats: React.FC<VendorDriftResolutionStatsProps> = ({ drift }) => {
  return (
    <Surface variant="neomorphic" className="p-6 space-y-4">
      <Heading variant="m">Drift Resolution Stats</Heading>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-success" />
            <Text variant="caption">Resolved Cases</Text>
          </div>
          <div className="text-3xl font-bold text-success">{drift.resolved}</div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-primary" />
            <Text variant="caption">Avg. Resolution Time</Text>
          </div>
          <div className="text-3xl font-bold text-primary">{drift.avgTime}</div>
          <Text variant="caption">days</Text>
        </div>
      </div>
    </Surface>
  );
};
