import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import type { Tables } from "../integrations/supabase/types";

type SpaceRow = Tables<"spaces">;

export function useSpaces(propertyId?: string) {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const fetchSpaces = async (): Promise<SpaceRow[]> => {
    if (!orgId) {
      return [];
    }

    let query = supabase.from("spaces").select("*").eq("org_id", orgId);

    if (propertyId) query = query.eq("property_id", propertyId);

    const { data, error: err } = await query;

    if (err) {
      throw err;
    }
    return data ?? [];
  };

  const query = useQuery({
    queryKey: ["spaces", orgId, propertyId ?? "all"],
    queryFn: fetchSpaces,
    enabled: !orgLoading,
    staleTime: 60_000,
    retry: 1,
  });

  return {
    spaces: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: async () => {
      await query.refetch();
    },
  };
}
