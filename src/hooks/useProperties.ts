import { useEffect, useState } from 'react';
import { propertiesService } from '../services/properties/properties';

export function useProperties(orgId: string) {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    propertiesService.getProperties(orgId).then(({ data, error }) => {
      setProperties(data ?? []);
      setError(error);
      setLoading(false);
    });
  }, [orgId]);

  return { properties, loading, error };
}
