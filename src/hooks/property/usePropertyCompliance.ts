import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export interface PropertyComplianceStatus {
  status: "good" | "warning" | "critical";
  score: number;
  compliantRules: number;
  totalRules: number;
}

export const usePropertyCompliance = (propertyId: string) => {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: complianceStatus, isLoading } = useQuery({
    queryKey: ["property-compliance", propertyId, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_portfolio_view")
        .select("id, expiry_state")
        .eq("property_id", propertyId)
        .eq("org_id", orgId!);

      if (error) throw error;

      const rows = data ?? [];
      const totalRules = rows.length;
      const expiredCount = rows.filter((r) => r.expiry_state === "expired").length;
      const compliantRules = totalRules - expiredCount;
      const score =
        totalRules > 0 ? Math.round((compliantRules / totalRules) * 100) : 100;

      const status: PropertyComplianceStatus["status"] =
        score < 70 ? "critical" : score < 90 ? "warning" : "good";

      return { status, score, compliantRules, totalRules } satisfies PropertyComplianceStatus;
    },
    enabled: !!propertyId && !!orgId && !orgLoading,
    staleTime: 60000,
  });

  return {
    complianceStatus: complianceStatus ?? {
      status: "good" as const,
      score: 100,
      compliantRules: 0,
      totalRules: 0,
    },
    isLoading: isLoading || orgLoading,
  };
};
