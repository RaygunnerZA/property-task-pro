import React from 'react';
import { VendorDashboardHeader } from '@/components/vendor/VendorDashboardHeader';
import { VendorTaskList } from '@/components/vendor/VendorTaskList';
import { SectionHeader } from '@/components/filla';
import { useVendor } from '@/hooks/vendor/useVendor';
import { useVendorTasks } from '@/hooks/vendor/useVendorTasks';

export default function VendorDashboard() {
  const { vendor } = useVendor();
  const { stats } = useVendorTasks();

  return (
    <div className="min-h-screen bg-paper p-4 pb-24 space-y-6">
      <VendorDashboardHeader 
        vendorName={vendor?.name || 'Vendor'}
        stats={stats}
      />

      <div>
        <SectionHeader title="Your Tasks" />
        <VendorTaskList />
      </div>
    </div>
  );
}
