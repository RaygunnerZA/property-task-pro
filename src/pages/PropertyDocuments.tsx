import { useParams } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Heading, Text } from '@/components/filla';
import MediaSection from '@/components/property/media/MediaSection';
import PropertyDocumentList from '@/components/property/media/PropertyDocumentList';
import PropertyUploadButton from '@/components/property/media/PropertyUploadButton';
import { usePropertyDocuments } from '@/hooks/property/usePropertyDocuments';

export default function PropertyDocuments() {
  const { id } = useParams<{ id: string }>();
  const { documents, isLoading } = usePropertyDocuments(id || '');

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link to={`/properties/${id}`}>
              <button className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <Heading variant="xl">Property Documents</Heading>
                <Text variant="body" className="text-neutral-600 mt-1">
                  View and manage property documentation
                </Text>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <MediaSection
          title="Document Library"
          action={<PropertyUploadButton label="Upload Document" />}
        >
          {isLoading ? (
            <div className="text-center py-12 text-neutral-600">
              <p>Loading documents...</p>
            </div>
          ) : (
            <PropertyDocumentList documents={documents} />
          )}
        </MediaSection>
      </div>
    </div>
  );
}
