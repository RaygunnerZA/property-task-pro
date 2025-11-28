import { useState, useEffect } from 'react';

export function usePropertyCompliance(propertyId: string) {
  const [compliance, setCompliance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) return;
    
    // Placeholder: will call complianceAssignments.getAssignmentsForProperty()
    setCompliance({ propertyId, rules: [] });
    setLoading(false);
  }, [propertyId]);

  return { compliance, loading };
}
