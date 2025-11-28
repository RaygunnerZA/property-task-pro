import { useEffect, useState } from 'react';
import { complianceRules } from '../services/compliance/rules';

export function useComplianceRule(ruleId: string) {
  const [rule, setRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    complianceRules.getRule(ruleId).then(({ data, error }) => {
      setRule(data);
      setError(error);
      setLoading(false);
    });
  }, [ruleId]);

  return { rule, loading, error };
}
