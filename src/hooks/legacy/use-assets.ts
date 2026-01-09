import { useEffect, useState, useCallback } from "react";
import { useSupabase } from "../../integrations/supabase/useSupabase";
import { useActiveOrg } from "../useActiveOrg";
import type { Tables } from "../integrations/supabase/types";

type AssetRow = Tables<"assets">;

/**
 * @deprecated This hook queries the assets table directly.
 * Use `useAssetsQuery()` from `@/hooks/useAssetsQuery` instead.
 * 
 * Migration: Replace `useAssets()` with `useAssetsQuery(propertyId?)`:
 * ```ts
 * const { data: assets = [], isLoading: loading } = useAssetsQuery(propertyId);
 * ```
 */
export function useAssets() {
  // Runtime warning in development
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '⚠️ useAssets() is deprecated.',
      'Migrate to useAssetsQuery() from @/hooks/useAssetsQuery for better performance and caching.'
    );
  }

  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    if (!orgId) {
      setAssets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("assets")
      .select("*")
      .eq("org_id", orgId);

    if (err) setError(err.message);
    else setAssets(data ?? []);

    setLoading(false);
  }, [supabase, orgId]);

  useEffect(() => {
    if (!orgLoading) {
      fetchAssets();
    }
  }, [fetchAssets, orgLoading]);

  return { assets, loading, error, refresh: fetchAssets };
}

