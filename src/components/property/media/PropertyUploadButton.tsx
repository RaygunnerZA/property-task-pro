import { Upload } from 'lucide-react';
import { Button } from '@/components/filla';

interface PropertyUploadButtonProps {
  label?: string;
  onUpload?: () => void;
}

export default function PropertyUploadButton({ 
  label = 'Upload', 
  onUpload 
}: PropertyUploadButtonProps) {
  return (
    <Button variant="primary" size="sm" onClick={onUpload}>
      <Upload className="w-4 h-4 mr-2" />
      {label}
    </Button>
  );
}
