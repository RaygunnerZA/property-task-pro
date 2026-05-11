import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminOrgDetail {
  org_id: string;
  org_name: string;
  org_type: string;
  created_at: string;
  created_by: string;
}

export interface AdminOrgMember {
  user_id: string;
  email: string;
  role: string;
  joined_at: string;
  last_sign_in_at: string | null;
}

export interface AdminAuditEntry {
  id: string;
  actor_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useAdminOrg(orgId: string) {
  const orgQuery = useQuery({
    queryKey: ["admin-org", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_org", { p_org_id: orgId });
      if (error) throw error;
      return (data?.[0] ?? null) as AdminOrgDetail | null;
    },
    enabled: !!orgId,
    staleTime: 60000,
  });

  const membersQuery = useQuery({
    queryKey: ["admin-org-members", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_org_members", {
        p_org_id: orgId,
      });
      if (error) throw error;
      return (data ?? []) as AdminOrgMember[];
    },
    enabled: !!orgId,
    staleTime: 60000,
  });

  const activityQuery = useQuery({
    queryKey: ["admin-org-activity", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_org_activity", {
        p_org_id: orgId,
        p_limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as AdminAuditEntry[];
    },
    enabled: !!orgId,
    staleTime: 60000,
  });

  return {
    org: orgQuery.data ?? null,
    members: membersQuery.data ?? [],
    activity: activityQuery.data ?? [],
    isLoading: orgQuery.isLoading || membersQuery.isLoading || activityQuery.isLoading,
    error: orgQuery.error ?? membersQuery.error ?? activityQuery.error,
  };
}
