import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminAiRequest {
  id: string;
  user_id: string | null;
  function_name: string;
  model_used: string;
  provider: string;
  status: string;
  latency_ms: number | null;
  cost_usd: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  entity_type: string | null;
  entity_id: string | null;
  error_message: string | null;
  created_at: string;
}

export function useAdminOrgAiRequests(orgId: string) {
  return useQuery({
    queryKey: ["admin-org-ai-requests", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_org_ai_requests", {
        p_org_id: orgId,
        p_limit: 100,
      });
      if (error) throw error;
      return (data ?? []) as AdminAiRequest[];
    },
    enabled: !!orgId,
    staleTime: 30000,
  });
}
