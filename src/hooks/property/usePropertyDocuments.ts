// Frontend-only placeholder hook for property documents
import { useState } from 'react';

export interface PropertyDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  uploaded_at: string;
  url?: string;
}

export const usePropertyDocuments = (propertyId: string) => {
  const [documents] = useState<PropertyDocument[]>([
    {
      id: '1',
      name: 'Lease Agreement.pdf',
      size: 2048000,
      type: 'application/pdf',
      uploaded_at: '2025-01-10T09:00:00Z'
    },
    {
      id: '2',
      name: 'Fire Safety Certificate.pdf',
      size: 1024000,
      type: 'application/pdf',
      uploaded_at: '2025-01-12T14:30:00Z'
    },
    {
      id: '3',
      name: 'Property Inspection Report.pdf',
      size: 3072000,
      type: 'application/pdf',
      uploaded_at: '2025-01-14T11:15:00Z'
    }
  ]);

  return { documents, isLoading: false };
};
