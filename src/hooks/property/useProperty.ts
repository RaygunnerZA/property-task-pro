// Frontend-only placeholder hook for property data
import { useState } from 'react';

export interface Property {
  id: string;
  address: string;
  nickname?: string;
  type?: string;
  units?: number;
}

export const useProperty = (propertyId: string) => {
  const [property] = useState<Property>({
    id: propertyId,
    address: '123 Example Street, Zurich',
    nickname: 'Main Building',
    type: 'Apartment',
    units: 24
  });

  return { property, isLoading: false };
};
