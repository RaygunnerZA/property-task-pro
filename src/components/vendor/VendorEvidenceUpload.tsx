import React, { useState } from 'react';
import { Surface, Text, Button } from '@/components/filla';
import { Upload, Image } from 'lucide-react';

export const VendorEvidenceUpload: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  return (
    <Surface variant="neomorphic" className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Image className="w-4 h-4 text-muted-foreground" />
        <Text variant="label">Upload Evidence</Text>
      </div>

      <div className="border-2 border-dashed border-concrete rounded-lg p-6 text-center">
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <Text variant="caption" className="mb-3">
          Upload photos or documents
        </Text>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id="evidence-upload"
        />
        <label htmlFor="evidence-upload" className="cursor-pointer">
          <div className="inline-block">
            <Button variant="secondary" size="sm">
              Choose Files
            </Button>
          </div>
        </label>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <Text variant="caption">{files.length} file(s) selected</Text>
          {files.map((file, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              {file.name}
            </div>
          ))}
        </div>
      )}
    </Surface>
  );
};
