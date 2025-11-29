// Frontend-only placeholder hook for property media summary
import { useState } from 'react';

export interface PropertyMediaSummary {
  photoCount: number;
  documentCount: number;
  recentPhotos: Array<{ id: string; url: string }>;
}

export const usePropertyMedia = (propertyId: string) => {
  const [mediaSummary] = useState<PropertyMediaSummary>({
    photoCount: 12,
    documentCount: 5,
    recentPhotos: [
      { id: '1', url: '/placeholder.svg' },
      { id: '2', url: '/placeholder.svg' },
      { id: '3', url: '/placeholder.svg' },
      { id: '4', url: '/placeholder.svg' }
    ]
  });

  return { mediaSummary, isLoading: false };
};
