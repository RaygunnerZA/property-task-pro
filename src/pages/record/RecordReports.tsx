import { BarChart3 } from 'lucide-react';
import { StandardPage } from '@/components/design-system/StandardPage';
import { EmptyState } from '@/components/design-system/EmptyState';

export default function RecordReports() {
  return (
    <StandardPage
      title="Reports"
      icon={<BarChart3 className="h-6 w-6" />}
      maxWidth="lg"
    >
      <EmptyState
        icon={BarChart3}
        title="Analytics & reports"
        description="Generate reports and view property analytics"
      />
    </StandardPage>
  );
}
