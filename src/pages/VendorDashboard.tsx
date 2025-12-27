import React from 'react';
import { VendorDashboardHeader } from '@/components/vendor/VendorDashboardHeader';
import { VendorTaskList } from '@/components/vendor/VendorTaskList';
import { useVendor } from '@/hooks/vendor/useVendor';
import { useVendorTasks } from '@/hooks/vendor/useVendorTasks';
import { StandardPage } from '@/components/design-system/StandardPage';
import { Briefcase } from 'lucide-react';

export default function VendorDashboard() {
  const { vendor } = useVendor();
  const { stats } = useVendorTasks();

  return (
    <StandardPage
      title="Vendor Dashboard"
      subtitle={vendor?.name || 'Vendor'}
      icon={<Briefcase className="h-6 w-6" />}
      maxWidth="lg"
    >
      <div className="space-y-6">
        <VendorDashboardHeader 
          vendorName={vendor?.name || 'Vendor'}
          stats={stats}
        />

        <div>
          <h2 className="text-lg font-semibold mb-4">Your Tasks</h2>
          <VendorTaskList />
        </div>
      </div>
    </StandardPage>
  );
}
