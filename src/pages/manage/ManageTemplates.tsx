import { FileStack } from 'lucide-react';
import { StandardPage } from '@/components/design-system/StandardPage';
import { EmptyState } from '@/components/design-system/EmptyState';

export default function ManageTemplates() {
  return (
    <StandardPage
      title="Templates"
      icon={<FileStack className="h-6 w-6" />}
      maxWidth="lg"
    >
      <EmptyState
        icon={FileStack}
        title="Task templates"
        description="Create reusable task templates and checklists"
      />
    </StandardPage>
  );
}
