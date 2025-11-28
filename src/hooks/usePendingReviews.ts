import { useState, useEffect } from 'react';

export function usePendingReviews() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Placeholder: will call complianceReviews service
    setReviews([]);
    setLoading(false);
  }, []);

  return { reviews, loading };
}
