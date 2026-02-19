/**
 * useComplianceRules
 *
 * Fetches all active compliance_rules for a property, enriched with their
 * latest pending occurrence (next due date status).
 *
 * Query key: ["compliance_rules", orgId, propertyId]
 * Used by: ComplianceRulesSection, ComplianceAutomationPanel, usePropertyIntelligenceSeed
 */

import { useQuery } from "@tanstack/react-query";
import { differenceInDays, parseISO, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";

export type RuleStatus = "overdue" | "due_soon" | "scheduled" | "no_date";

export interface ComplianceRuleWithStatus {
  id: string;
  org_id: string;
  property_id: string | null;
  name: string | null;
  description: string | null;
  frequency: string | null;
  scope_type: string;
  scope_asset_type: string | null;
  scope_ids: unknown;
  auto_create: boolean;
  template_config: unknown;
  notify_days_before: number;
  is_archived: boolean;
  last_completed_at: string | null;
  next_due_date: string | null;
  created_at: string;
  updated_at: string;
  /** Derived status from next_due_date vs today */
  status: RuleStatus;
  /** Days until next_due_date (negative = overdue) */
  daysUntilDue: number | null;
}

function deriveStatus(nextDueDate: string | null): {
  status: RuleStatus;
  daysUntilDue: number | null;
} {
  if (!nextDueDate) return { status: "no_date", daysUntilDue: null };
  const parsed = parseISO(nextDueDate);
  if (!isValid(parsed)) return { status: "no_date", daysUntilDue: null };
  const days = differenceInDays(parsed, new Date());
  if (days < 0) return { status: "overdue", daysUntilDue: days };
  if (days <= 30) return { status: "due_soon", daysUntilDue: days };
  return { status: "scheduled", daysUntilDue: days };
}

export function useComplianceRules(propertyId: string | undefined) {
  const { orgId } = useActiveOrg();

  return useQuery({
    queryKey: ["compliance_rules", orgId, propertyId],
    queryFn: async (): Promise<ComplianceRuleWithStatus[]> => {
      if (!orgId || !propertyId) return [];

      const { data, error } = await supabase
        .from("compliance_rules")
        .select("*")
        .eq("org_id", orgId)
        .eq("property_id", propertyId)
        .eq("is_archived", false)
        .order("next_due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;

      return (data ?? []).map((rule) => ({
        ...rule,
        scope_ids: rule.scope_ids,
        template_config: rule.template_config,
        ...deriveStatus(rule.next_due_date),
      }));
    },
    enabled: !!orgId && !!propertyId,
    staleTime: 60_000,
  });
}
