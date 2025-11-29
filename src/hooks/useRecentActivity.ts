import { useState, useEffect } from 'react';

interface ActivityEvent {
  id: string;
  type: 'rule_approved' | 'drift_detected' | 'rule_created' | 'review_pending';
  message: string;
  timestamp: string;
  metadata?: {
    ruleName?: string;
    propertyName?: string;
  };
}

interface UseRecentActivityResult {
  data: ActivityEvent[];
  loading: boolean;
  error: Error | null;
}

export const useRecentActivity = (): UseRecentActivityResult => {
  const [data, setData] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      const now = new Date();
      setData([
        {
          id: '1',
          type: 'drift_detected',
          message: 'Compliance drift detected',
          timestamp: new Date(now.getTime() - 30 * 60000).toISOString(),
          metadata: {
            ruleName: 'Fire Safety Inspection Rule',
            propertyName: 'Park Plaza',
          },
        },
        {
          id: '2',
          type: 'rule_approved',
          message: 'Rule version approved',
          timestamp: new Date(now.getTime() - 2 * 3600000).toISOString(),
          metadata: {
            ruleName: 'Emergency Exit Signage',
          },
        },
        {
          id: '3',
          type: 'review_pending',
          message: 'New rule pending review',
          timestamp: new Date(now.getTime() - 4 * 3600000).toISOString(),
          metadata: {
            ruleName: 'Elevator Maintenance Protocol',
          },
        },
        {
          id: '4',
          type: 'rule_created',
          message: 'New rule created',
          timestamp: new Date(now.getTime() - 6 * 3600000).toISOString(),
          metadata: {
            ruleName: 'Accessibility Standards',
          },
        },
        {
          id: '5',
          type: 'drift_detected',
          message: 'Compliance drift detected',
          timestamp: new Date(now.getTime() - 24 * 3600000).toISOString(),
          metadata: {
            ruleName: 'Water Quality Testing',
            propertyName: 'Garden Estates',
          },
        },
      ]);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return { data, loading, error };
};
