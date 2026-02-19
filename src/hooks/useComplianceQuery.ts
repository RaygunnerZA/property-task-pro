import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

/**
 * useComplianceQuery
 *
 * Sprint 4: Reads from compliance_schedule_view which unifies:
 *   - Rule-based pending occurrences (source_type = 'rule')
 *   - Standalone compliance documents — AI-extracted + uploaded (source_type = 'document')
 *
 * All downstream consumers (PropertyCompliance, ComplianceOverviewSection) get
 * a consistent shape with expiry_status, days_until_expiry, and rule_id present.
 */
export function useComplianceQuery(propertyId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["compliance", orgId, propertyId],
    queryFn: async () => {
      let query = supabase
        .from("compliance_schedule_view")
        .select("*")
        .eq("org_id", orgId)
        .order("days_until_expiry", { ascending: true, nullsFirst: false });

      if (propertyId) {
        query = query.eq("property_id", propertyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60000,
  });
}

