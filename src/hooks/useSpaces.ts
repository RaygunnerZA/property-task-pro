import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import type { Tables } from "../integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type SpaceRow = Tables<"spaces">;

export function useSpaces(propertyId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const query = useQuery({
    queryKey: ["org", orgId, "spaces", propertyId ?? null],
    queryFn: async () => {
      if (!orgId) return [] as SpaceRow[];
      let q = supabase.from("spaces").select("*").eq("org_id", orgId);
      if (propertyId) q = q.eq("property_id", propertyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SpaceRow[];
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60000,
  });

  return {
    spaces: (query.data ?? []) as SpaceRow[],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: () => query.refetch(),
  };
}
