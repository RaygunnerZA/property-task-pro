import React from 'react';
import { Surface, Text } from '@/components/filla';
import { ImageIcon } from 'lucide-react';

interface VendorPhotoViewerProps {
  photos?: string[];
}

export const VendorPhotoViewer: React.FC<VendorPhotoViewerProps> = ({ photos = [] }) => {
  if (photos.length === 0) {
    return (
      <Surface variant="neomorphic" className="p-6 text-center">
        <ImageIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
        <Text variant="caption">No photos attached yet</Text>
      </Surface>
    );
  }

  return (
    <Surface variant="neomorphic" className="p-4 space-y-3">
      <Text variant="label">Attached Photos</Text>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, i) => (
          <div key={i} className="aspect-square rounded-lg overflow-hidden bg-concrete">
            <img 
              src={photo} 
              alt={`Evidence ${i + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </Surface>
  );
};
