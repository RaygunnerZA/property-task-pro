import { useState, useEffect } from 'react';

export function useRuleVersions(ruleId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ruleId) return;
    
    // Placeholder: will call versioningService or complianceVersions
    setData([]);
    setLoading(false);
  }, [ruleId]);

  return { data, loading };
}
