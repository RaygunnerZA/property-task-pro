import { Archive } from 'lucide-react';
import { StandardPage } from '@/components/design-system/StandardPage';
import { EmptyState } from '@/components/design-system/EmptyState';

export default function RecordLibrary() {
  return (
    <StandardPage
      title="Library"
      icon={<Archive className="h-6 w-6" />}
      maxWidth="lg"
    >
      <EmptyState
        icon={Archive}
        title="Asset library"
        description="Attachments, insurance documents, and warranties"
      />
    </StandardPage>
  );
}
