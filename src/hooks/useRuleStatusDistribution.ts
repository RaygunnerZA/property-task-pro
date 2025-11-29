import { useState, useEffect } from 'react';

interface StatusData {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

interface UseRuleStatusDistributionResult {
  data: StatusData[];
  loading: boolean;
  error: Error | null;
}

export const useRuleStatusDistribution = (): UseRuleStatusDistributionResult => {
  const [data, setData] = useState<StatusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setData([
        { status: 'Approved', count: 32, percentage: 67, color: '#22c55e' },
        { status: 'Pending Review', count: 10, percentage: 21, color: '#f59e0b' },
        { status: 'Draft', count: 6, percentage: 12, color: '#6366f1' },
      ]);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return { data, loading, error };
};
