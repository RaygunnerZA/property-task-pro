import { useState } from 'react';
import PropertyDocumentItem from './PropertyDocumentItem';
import PropertyDocumentViewerModal from './PropertyDocumentViewerModal';
import { PropertyDocument } from '@/hooks/property/usePropertyDocuments';

interface PropertyDocumentListProps {
  documents: PropertyDocument[];
}

export default function PropertyDocumentList({ documents }: PropertyDocumentListProps) {
  const [selectedDocument, setSelectedDocument] = useState<PropertyDocument | null>(null);

  const handleDocumentClick = (document: PropertyDocument) => {
    setSelectedDocument(document);
  };

  const handleClose = () => {
    setSelectedDocument(null);
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-neutral-600">
        <p>No documents available</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {documents.map((document) => (
          <PropertyDocumentItem
            key={document.id}
            document={document}
            onClick={() => handleDocumentClick(document)}
          />
        ))}
      </div>

      {selectedDocument && (
        <PropertyDocumentViewerModal
          document={selectedDocument}
          onClose={handleClose}
        />
      )}
    </>
  );
}
