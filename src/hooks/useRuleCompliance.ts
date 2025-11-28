import { useState, useEffect } from 'react';

export function useRuleCompliance(ruleId: string) {
  const [compliance, setCompliance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ruleId) return;
    
    // Placeholder: will call propertyCompliance service
    setCompliance({ ruleId, properties: [] });
    setLoading(false);
  }, [ruleId]);

  return { compliance, loading };
}
