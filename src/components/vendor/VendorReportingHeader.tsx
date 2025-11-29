import React from 'react';
import { Surface, Heading, Text } from '@/components/filla';
import { BarChart3 } from 'lucide-react';

export const VendorReportingHeader: React.FC = () => {
  return (
    <Surface variant="neomorphic" className="p-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-primary" />
        <div>
          <Heading variant="l">Performance Overview</Heading>
          <Text variant="caption" className="mt-1">
            Your metrics for the current period
          </Text>
        </div>
      </div>
    </Surface>
  );
};
