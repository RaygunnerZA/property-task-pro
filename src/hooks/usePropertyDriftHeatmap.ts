import { useState, useEffect } from 'react';

interface PropertyStatus {
  id: string;
  name: string;
  status: 'compliant' | 'pending' | 'non_compliant';
  driftCount: number;
}

interface UsePropertyDriftHeatmapResult {
  data: PropertyStatus[];
  loading: boolean;
  error: Error | null;
}

export const usePropertyDriftHeatmap = (): UsePropertyDriftHeatmapResult => {
  const [data, setData] = useState<PropertyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setData([
        { id: '1', name: 'Sunrise Tower', status: 'compliant', driftCount: 0 },
        { id: '2', name: 'Harbor View', status: 'compliant', driftCount: 0 },
        { id: '3', name: 'Oak Street Apartments', status: 'pending', driftCount: 2 },
        { id: '4', name: 'Park Plaza', status: 'non_compliant', driftCount: 5 },
        { id: '5', name: 'Downtown Lofts', status: 'compliant', driftCount: 0 },
        { id: '6', name: 'Riverside Complex', status: 'pending', driftCount: 1 },
        { id: '7', name: 'Metro Heights', status: 'compliant', driftCount: 0 },
        { id: '8', name: 'Garden Estates', status: 'non_compliant', driftCount: 3 },
      ]);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return { data, loading, error };
};
