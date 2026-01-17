import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import MediaSection from '@/components/property/media/MediaSection';
import PropertyDocumentsFiles from '@/components/property/media/PropertyDocumentsFiles';
import PropertyDocumentViewerModal from '@/components/property/media/PropertyDocumentViewerModal';
import PropertyUploadButton from '@/components/property/media/PropertyUploadButton';
import { usePropertyDocuments, PropertyDocument } from '@/hooks/property/usePropertyDocuments';
import { StandardPageWithBack } from '@/components/design-system/StandardPageWithBack';
import { LoadingState } from '@/components/design-system/LoadingState';

export default function PropertyDocuments() {
  const { id } = useParams<{ id: string }>();
  const { documents, isLoading } = usePropertyDocuments(id || '');
  const [selectedDocument, setSelectedDocument] = useState<PropertyDocument | null>(null);

  const handleDocumentClick = (document: PropertyDocument) => {
    setSelectedDocument(document);
  };

  const handleClose = () => {
    setSelectedDocument(null);
  };

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
          <div className="bg-card rounded-lg shadow-sm p-4">
            <PropertyDocumentsFiles 
              documents={documents} 
              onDocumentClick={handleDocumentClick}
            />
          </div>
        )}
      </MediaSection>

      {selectedDocument && (
        <PropertyDocumentViewerModal
          document={selectedDocument}
          onClose={handleClose}
        />
      )}
    </StandardPageWithBack>
  );
}
