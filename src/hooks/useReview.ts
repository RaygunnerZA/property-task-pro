import { useState, useEffect } from 'react';

export function useReview(reviewId: string) {
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!reviewId) return;
    
    // Placeholder: will call complianceReviews.getReview(reviewId)
    setReview({ id: reviewId, clauses: [] });
    setLoading(false);
  }, [reviewId]);

  return { review, loading };
}
