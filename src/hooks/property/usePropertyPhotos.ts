// Frontend-only placeholder hook for property photos
import { useState } from 'react';

export interface PropertyPhoto {
  id: string;
  url: string;
  caption?: string;
  uploaded_at: string;
}

export const usePropertyPhotos = (propertyId: string) => {
  const [photos] = useState<PropertyPhoto[]>([
    {
      id: '1',
      url: '/placeholder.svg',
      caption: 'Front entrance',
      uploaded_at: '2025-01-15T10:30:00Z'
    },
    {
      id: '2',
      url: '/placeholder.svg',
      caption: 'Living room',
      uploaded_at: '2025-01-15T10:35:00Z'
    },
    {
      id: '3',
      url: '/placeholder.svg',
      caption: 'Kitchen',
      uploaded_at: '2025-01-15T10:40:00Z'
    },
    {
      id: '4',
      url: '/placeholder.svg',
      caption: 'Bedroom',
      uploaded_at: '2025-01-15T10:45:00Z'
    }
  ]);

  return { photos, isLoading: false };
};
