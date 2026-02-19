/**
 * useUpsertComplianceRule
 *
 * Create or update a compliance_rules record and manage its first/next occurrence.
 *
 * Create flow:
 *   1. Insert compliance_rules record with calculated next_due_date
 *   2. Insert initial compliance_occurrences record
 *   3. If auto_create: call createTask() with template_config values
 *
 * Update flow:
 *   1. Update compliance_rules record
 *   2. If frequency changed: recalculate next_due_date, update pending occurrence due_date
 *      (does NOT delete existing occurrences — history is preserved)
 *   3. Invalidate compliance_rules + property_profile cache keys
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { calculateNextDueDate } from "@/services/propertyIntelligence/frequencyUtils";
import { createTask } from "@/services/tasks/taskMutations";

export interface ComplianceRuleFormValues {
  name: string;
  description?: string;
  frequency: string;
  scope_type: "property" | "asset_type" | "specific_assets";
  scope_asset_type?: string;
  scope_ids?: string[];
  auto_create: boolean;
  template_config?: {
    title_template?: string;
    default_priority?: string;
    assigned_user_id?: string;
  };
  notify_days_before?: number;
}

export interface UpsertComplianceRuleInput {
  propertyId: string;
  /** When provided, update existing rule. When omitted, create new. */
  ruleId?: string;
  values: ComplianceRuleFormValues;
}

export function useUpsertComplianceRule() {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      propertyId,
      ruleId,
      values,
    }: UpsertComplianceRuleInput) => {
      if (!orgId) throw new Error("No active org");

      const now = new Date();
      const nextDue = calculateNextDueDate(values.frequency, now);
      const nextDueDateStr = format(nextDue, "yyyy-MM-dd");

      if (ruleId) {
        // ── UPDATE ──────────────────────────────────────────────
        const { data: existing, error: fetchError } = await supabase
          .from("compliance_rules")
          .select("frequency")
          .eq("id", ruleId)
          .single();

        if (fetchError) throw fetchError;

        const frequencyChanged = existing?.frequency !== values.frequency;

        const { error: updateError } = await supabase
          .from("compliance_rules")
          .update({
            name: values.name,
            description: values.description ?? null,
            frequency: values.frequency,
            scope_type: values.scope_type,
            scope_asset_type: values.scope_asset_type ?? null,
            scope_ids: values.scope_ids ? JSON.stringify(values.scope_ids) : null,
            auto_create: values.auto_create,
            template_config: values.template_config
              ? JSON.stringify(values.template_config)
              : null,
            notify_days_before: values.notify_days_before ?? 30,
            ...(frequencyChanged ? { next_due_date: nextDueDateStr } : {}),
          })
          .eq("id", ruleId);

        if (updateError) throw updateError;

        // Update pending occurrence due_date if frequency changed
        if (frequencyChanged) {
          const { data: pendingOcc } = await supabase
            .from("compliance_occurrences")
            .select("id")
            .eq("rule_id", ruleId)
            .eq("status", "pending")
            .order("due_date", { ascending: true })
            .limit(1);

          if (pendingOcc && pendingOcc.length > 0) {
            await supabase
              .from("compliance_occurrences")
              .update({ due_date: nextDueDateStr })
              .eq("id", pendingOcc[0].id);
          }
        }

        return { ruleId };
      } else {
        // ── CREATE ──────────────────────────────────────────────
        const { data: rule, error: insertError } = await supabase
          .from("compliance_rules")
          .insert({
            org_id: orgId,
            property_id: propertyId,
            name: values.name,
            description: values.description ?? null,
            frequency: values.frequency,
            scope_type: values.scope_type,
            scope_asset_type: values.scope_asset_type ?? null,
            scope_ids: values.scope_ids ? JSON.stringify(values.scope_ids) : null,
            auto_create: values.auto_create,
            template_config: values.template_config
              ? JSON.stringify(values.template_config)
              : null,
            notify_days_before: values.notify_days_before ?? 30,
            next_due_date: nextDueDateStr,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        // Initial occurrence
        await supabase.from("compliance_occurrences").insert({
          org_id: orgId,
          rule_id: rule.id,
          due_date: nextDueDateStr,
          status: "pending",
        });

        // Auto-create first task if configured
        if (values.auto_create && values.template_config) {
          const cfg = values.template_config;
          await createTask(orgId, propertyId, {
            title: cfg.title_template ?? values.name,
            description: `Auto-created compliance task for "${values.name}". Due: ${nextDueDateStr}`,
            priority: cfg.default_priority ?? "medium",
            assigned_user_id: cfg.assigned_user_id,
            is_compliance: true,
          });
        }

        return { ruleId: rule.id };
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["compliance_rules", orgId, variables.propertyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["property_profile", orgId, variables.propertyId],
      });
    },
  });
}
