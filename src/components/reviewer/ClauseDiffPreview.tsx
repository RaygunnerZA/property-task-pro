import React from 'react';
import { Surface, Text } from '@/components/filla';

interface ClauseDiffPreviewProps {
  original?: string;
  edited?: string;
}

export const ClauseDiffPreview: React.FC<ClauseDiffPreviewProps> = ({ 
  original, 
  edited 
}) => {
  return (
    <Surface variant="engraved" className="p-3 space-y-3">
      <div>
        <Text variant="label" className="mb-1 block">Original</Text>
        <Text variant="body" className="text-muted-foreground">
          {original || '—'}
        </Text>
      </div>
      
      <div className="border-t border-concrete/50 pt-3">
        <Text variant="label" className="mb-1 block">Edited</Text>
        <Text variant="body">
          {edited || '—'}
        </Text>
      </div>
    </Surface>
  );
};
