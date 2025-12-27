import { FolderOpen } from 'lucide-react';
import { StandardPage } from '@/components/design-system/StandardPage';
import { EmptyState } from '@/components/design-system/EmptyState';

export default function RecordDocuments() {
  return (
    <StandardPage
      title="Documents"
      icon={<FolderOpen className="h-6 w-6" />}
      maxWidth="lg"
    >
      <EmptyState
        icon={FolderOpen}
        title="Document archive"
        description="Access all property documents, certificates, and files"
      />
    </StandardPage>
  );
}
