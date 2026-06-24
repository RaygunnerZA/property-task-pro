/**
 * Permanently deletes a compliance rule row.
 * Invalidates compliance_rules caches for the owning org + property on success.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { COMPLIANCE_SCHEDULE_RULES_TABLE } from "@/lib/complianceSchedule";

export interface DeleteComplianceRuleVariables {
  ruleId: string;
  orgId: string;
  propertyId?: string | null;
}

export function useDeleteComplianceRuleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ruleId }: DeleteComplianceRuleVariables) => {
      const { error } = await supabase
        .from(COMPLIANCE_SCHEDULE_RULES_TABLE)
        .delete()
        .eq("id", ruleId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["compliance_rules", variables.orgId, variables.propertyId],
      });
      void queryClient.invalidateQueries({ queryKey: ["compliance_rules", variables.orgId] });
    },
  });
}
