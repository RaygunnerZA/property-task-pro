import { useEffect, useState, useCallback } from 'react';
import { useSupabase } from '@/integrations/supabase/useSupabase';
import { useActiveOrg } from '@/hooks/useActiveOrg';
import type { Tables } from '@/integrations/supabase/types';

type PropertyRow = Tables<"properties">;

export const useProperty = (propertyId: string | undefined) => {
  const supabase = useSupabase();
  const { orgId } = useActiveOrg();
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProperty = useCallback(async () => {
    if (!propertyId || !orgId) {
      setProperty(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await supabase
        .from("properties")
        .select("*")
        .eq("id", propertyId)
        .eq("org_id", orgId)
        .single();

      if (err) {
        setError(err.message);
        setProperty(null);
      } else {
        setProperty(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch property");
      setProperty(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, propertyId, orgId]);

  useEffect(() => {
    fetchProperty();
  }, [fetchProperty]);

  return { property, loading, error, refresh: fetchProperty };
};
