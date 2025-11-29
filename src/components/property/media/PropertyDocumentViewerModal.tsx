import { X, Download } from 'lucide-react';
import { PropertyDocument } from '@/hooks/property/usePropertyDocuments';
import { Button, Heading, Text } from '@/components/filla';

interface PropertyDocumentViewerModalProps {
  document: PropertyDocument;
  onClose: () => void;
}

export default function PropertyDocumentViewerModal({
  document,
  onClose,
}: PropertyDocumentViewerModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div className="flex-1 min-w-0 mr-4">
            <Heading variant="l" className="truncate">{document.name}</Heading>
            <Text variant="caption" className="text-neutral-600 mt-1">
              PDF Document
            </Text>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="bg-neutral-50 rounded-lg p-8 text-center">
            <Text variant="body" className="text-neutral-600">
              Document preview placeholder
            </Text>
            <Text variant="caption" className="text-neutral-500 mt-2">
              In production, this would show a PDF viewer
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}
