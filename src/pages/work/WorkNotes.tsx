import { FileText } from 'lucide-react';
import { StandardPage } from '@/components/design-system/StandardPage';
import { EmptyState } from '@/components/design-system/EmptyState';

export default function WorkNotes() {
  return (
    <StandardPage
      title="Notes"
      icon={<FileText className="h-6 w-6" />}
      maxWidth="lg"
    >
      <EmptyState
        icon={FileText}
        title="Notes coming soon"
        description="Create and organize notes for your properties and tasks"
      />
    </StandardPage>
  );
}
