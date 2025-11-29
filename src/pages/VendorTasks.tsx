import React from 'react';
import { VendorTaskList } from '@/components/vendor/VendorTaskList';
import { SectionHeader } from '@/components/filla';

export default function VendorTasks() {
  return (
    <div className="min-h-screen bg-paper p-4 pb-24 space-y-6">
      <SectionHeader title="All Tasks" />
      <VendorTaskList />
    </div>
  );
}
