import { useState, useEffect } from 'react';

interface ComplianceOverviewData {
  totalRules: number;
  totalProperties: number;
  compliant: number;
  pending: number;
  drift: number;
  lastUpdated: string;
}

interface UseComplianceOverviewResult {
  data: ComplianceOverviewData | null;
  loading: boolean;
  error: Error | null;
}

export const useComplianceOverview = (): UseComplianceOverviewResult => {
  const [data, setData] = useState<ComplianceOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setData({
        totalRules: 48,
        totalProperties: 23,
        compliant: 18,
        pending: 3,
        drift: 2,
        lastUpdated: '2 hours ago',
      });
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return { data, loading, error };
};
