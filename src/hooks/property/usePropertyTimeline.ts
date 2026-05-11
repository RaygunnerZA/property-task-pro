/**
 * Property hub — timeline tab (Phase 0 inventory).
 * Stub / placeholder data only. Not imported by any route yet; replace with
 * org-scoped queries (e.g. tasks + compliance events) before shipping the tab.
 */
import { useState } from 'react';

export interface PropertyTimelineEvent {
  id: string;
  date: string;
  type: 'task' | 'drift' | 'compliance' | 'inspection';
  description: string;
}

export const usePropertyTimeline = (propertyId: string) => {
  const [events] = useState<PropertyTimelineEvent[]>([
    {
      id: '1',
      date: '2025-01-03',
      type: 'task',
      description: 'Task completed: Annual fire safety check'
    },
    {
      id: '2',
      date: '2025-01-02',
      type: 'drift',
      description: 'Drift detected: Inspection overdue'
    },
    {
      id: '3',
      date: '2024-12-28',
      type: 'compliance',
      description: 'Compliance review passed'
    }
  ]);

  return { events, isLoading: false };
};
