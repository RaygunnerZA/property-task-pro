/**
 * Property hub — drift tab (Phase 0 inventory).
 * Stub / placeholder data only. Not imported by any route; `usePropertyDriftHeatmap`
 * is the portfolio-level hook in use today.
 */
import { useState } from 'react';

export interface PropertyDrift {
  hasDrift: boolean;
  count: number;
  items: Array<{
    id: string;
    ruleTitle: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

export const usePropertyDrift = (propertyId: string) => {
  const [drift] = useState<PropertyDrift>({
    hasDrift: true,
    count: 1,
    items: [
      {
        id: '1',
        ruleTitle: 'Fire Safety Inspection',
        severity: 'medium'
      }
    ]
  });

  return { drift, isLoading: false };
};
