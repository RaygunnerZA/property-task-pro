import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminOrg {
  org_id: string;
  org_name: string;
  org_type: string;
  created_at: string;
  member_count: number;
  property_count: number;
  task_count: number;
  last_activity: string | null;
}

export function useAdminOrgList() {
  return useQuery({
    queryKey: ["admin-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_orgs");
      if (error) throw error;
      return (data ?? []) as AdminOrg[];
    },
    staleTime: 60000,
  });
}
