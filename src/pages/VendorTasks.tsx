import React from 'react';
import { VendorTaskList } from '@/components/vendor/VendorTaskList';
import { StandardPage } from '@/components/design-system/StandardPage';
import { CheckSquare } from 'lucide-react';

export default function VendorTasks() {
  return (
    <StandardPage
      title="All Tasks"
      icon={<CheckSquare className="h-6 w-6" />}
      maxWidth="lg"
    >
      <VendorTaskList />
    </StandardPage>
  );
}
