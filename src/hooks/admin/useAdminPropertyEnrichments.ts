import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AdminPropertyEnrichment =
  Database["public"]["Functions"]["admin_list_property_enrichments"]["Returns"][number];

export function useAdminPropertyEnrichments(orgId?: string | null) {
  return useQuery({
    queryKey: ["admin-property-enrichments", orgId ?? "all"],
    queryFn: async (): Promise<AdminPropertyEnrichment[]> => {
      const { data, error } = await supabase.rpc("admin_list_property_enrichments", {
        p_org_id: orgId ?? undefined,
        p_limit: 100,
      });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}
