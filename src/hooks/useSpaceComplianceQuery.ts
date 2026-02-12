import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export function useSpaceComplianceQuery(spaceId: string | undefined) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["space_compliance", orgId, spaceId],
    queryFn: async () => {
      const { data: links, error: linksError } = await supabase
        .from("compliance_spaces")
        .select("compliance_document_id")
        .eq("space_id", spaceId)
        .eq("org_id", orgId);
      if (linksError) throw linksError;
      if (!links?.length) return [];

      const complianceIds = links.map((r) => r.compliance_document_id);
      const { data, error } = await supabase
        .from("compliance_portfolio_view")
        .select("*")
        .in("id", complianceIds)
        .eq("org_id", orgId)
        .order("next_due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && !!spaceId && !orgLoading,
    staleTime: 60000,
  });
}
