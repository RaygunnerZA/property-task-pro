import { useParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import MediaSection from '@/components/property/media/MediaSection';
import PropertyDocumentList from '@/components/property/media/PropertyDocumentList';
import PropertyUploadButton from '@/components/property/media/PropertyUploadButton';
import { usePropertyDocuments } from '@/hooks/property/usePropertyDocuments';
import { StandardPageWithBack } from '@/components/design-system/StandardPageWithBack';
import { LoadingState } from '@/components/design-system/LoadingState';

export default function PropertyDocuments() {
  const { id } = useParams<{ id: string }>();
  const { documents, isLoading } = usePropertyDocuments(id || '');

  return (
    <StandardPageWithBack
      title="Property Documents"
      subtitle="View and manage property documentation"
      backTo={`/properties/${id}`}
      icon={<FileText className="h-6 w-6" />}
      maxWidth="lg"
    >
      <MediaSection
        title="Document Library"
        action={<PropertyUploadButton label="Upload Document" />}
      >
        {isLoading ? (
          <LoadingState message="Loading documents..." />
        ) : (
          <PropertyDocumentList documents={documents} />
        )}
      </MediaSection>
    </StandardPageWithBack>
  );
}
