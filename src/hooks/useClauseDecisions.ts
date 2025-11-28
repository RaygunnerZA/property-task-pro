import { useState, useEffect } from 'react';

export function useClauseDecisions(reviewId: string | undefined) {
  const [decisions, setDecisions] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!reviewId) return;
    
    // Placeholder: will load saved decisions
    setDecisions({});
  }, [reviewId]);

  return { decisions, setDecisions };
}
