import { useState, useEffect } from 'react';

export function useRule(ruleId: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ruleId) return;
    
    // Placeholder: will call complianceRules.getRule()
    setData({ 
      id: ruleId, 
      title: 'Rule Title', 
      description: 'Rule description' 
    });
    setLoading(false);
  }, [ruleId]);

  return { data, loading };
}
