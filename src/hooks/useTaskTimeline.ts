import { useState, useEffect } from 'react';

interface TimelineEvent {
  id: string;
  type: 'status_change' | 'assignment' | 'comment' | 'attachment';
  description: string;
  author?: string;
  timestamp: Date;
}

export function useTaskTimeline(taskId: string) {
  const [data, setData] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // TODO: Connect to backend service
    // This is a stub that returns empty array
    setLoading(false);
    setData([]);
  }, [taskId]);

  return { data, loading, error };
}
