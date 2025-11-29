import { Upload } from 'lucide-react';
import { Surface, Text } from '@/components/filla';

interface PropertyUploadZoneProps {
  accept?: string;
  onUpload?: () => void;
}

export default function PropertyUploadZone({ 
  accept = 'image/*', 
  onUpload 
}: PropertyUploadZoneProps) {
  return (
    <Surface
      variant="engraved"
      interactive
      className="p-8 border-2 border-dashed border-neutral-300 hover:border-primary transition-colors"
      onClick={onUpload}
    >
      <div className="flex flex-col items-center justify-center gap-3">
        <div className="p-4 rounded-full bg-primary/10">
          <Upload className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center">
          <Text variant="body" className="font-medium">
            Click to upload files
          </Text>
          <Text variant="caption" className="text-neutral-600 mt-1">
            or drag and drop
          </Text>
        </div>
      </div>
    </Surface>
  );
}
