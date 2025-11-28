import { useState, useEffect } from 'react';

export function useRulesCompliance() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Placeholder: will call complianceRules service
    setRules([]);
    setLoading(false);
  }, []);

  return { rules, loading };
}
