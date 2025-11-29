import React from 'react';
import { Surface, Text, Heading, Badge } from '@/components/filla';
import { VendorSLA } from '@/hooks/vendor/useVendorReporting';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface VendorSLABreakdownProps {
  sla: VendorSLA;
}

export const VendorSLABreakdown: React.FC<VendorSLABreakdownProps> = ({ sla }) => {
  return (
    <Surface variant="neomorphic" className="p-6 space-y-4">
      <Heading variant="m">SLA Breakdown</Heading>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-success/5 rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-success" />
            <Text variant="body">Within SLA</Text>
          </div>
          <Badge variant="success" size="bold">{sla.within}</Badge>
        </div>

        <div className="flex items-center justify-between p-3 bg-warning/5 rounded-lg">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-warning" />
            <Text variant="body">Late</Text>
          </div>
          <Badge variant="warning" size="bold">{sla.late}</Badge>
        </div>

        <div className="flex items-center justify-between p-3 bg-danger/5 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-danger" />
            <Text variant="body">Critical Overdue</Text>
          </div>
          <Badge variant="signal" size="bold">{sla.critical}</Badge>
        </div>
      </div>
    </Surface>
  );
};
