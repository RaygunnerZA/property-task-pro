import { FileText, Download } from 'lucide-react';
import { PropertyDocument } from '@/hooks/property/usePropertyDocuments';
import { Surface, Text } from '@/components/filla';
import { format } from 'date-fns';

interface PropertyDocumentItemProps {
  document: PropertyDocument;
  onClick: () => void;
}

export default function PropertyDocumentItem({ document, onClick }: PropertyDocumentItemProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Surface
      variant="neomorphic"
      interactive
      className="p-4"
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg bg-primary/10">
          <FileText className="w-6 h-6 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <Text variant="body" className="font-medium truncate">
            {document.name}
          </Text>
          <div className="flex items-center gap-3 mt-1">
            <Text variant="caption" className="text-neutral-600">
              {formatFileSize(document.size)}
            </Text>
            <Text variant="caption" className="text-neutral-600">
              {format(new Date(document.uploaded_at), 'PP')}
            </Text>
          </div>
        </div>

        <button className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
          <Download className="w-5 h-5 text-neutral-700" />
        </button>
      </div>
    </Surface>
  );
}
