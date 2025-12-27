import { History } from 'lucide-react';
import { StandardPage } from '@/components/design-system/StandardPage';
import { EmptyState } from '@/components/design-system/EmptyState';

export default function RecordHistory() {
  return (
    <StandardPage
      title="History"
      icon={<History className="h-6 w-6" />}
      maxWidth="lg"
    >
      <EmptyState
        icon={History}
        title="Task history"
        description="View completed tasks and past activity"
      />
    </StandardPage>
  );
}
