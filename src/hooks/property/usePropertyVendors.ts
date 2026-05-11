/**
 * Property hub — vendors tab (Phase 0 inventory).
 * Stub / placeholder data only. Not imported by any route yet.
 */
import { useState } from 'react';

export interface PropertyVendorActivity {
  vendorName: string;
  lastVisit: string;
  tasksCompleted: number;
}

export const usePropertyVendors = (propertyId: string) => {
  const [vendorActivity] = useState<PropertyVendorActivity[]>([
    {
      vendorName: 'Alpine Maintenance Co.',
      lastVisit: '2025-01-15',
      tasksCompleted: 3
    },
    {
      vendorName: 'SafeGuard Inspections',
      lastVisit: '2025-01-10',
      tasksCompleted: 1
    }
  ]);

  return { vendorActivity, isLoading: false };
};
