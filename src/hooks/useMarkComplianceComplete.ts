/**
 * useMarkComplianceComplete
 *
 * Marks a compliance item as complete, advances the occurrence lifecycle,
 * and optionally auto-creates the next task when auto_create = true on the rule.
 *
 * Flow:
 *   1. Update compliance_documents: last_completed_date = now(), status = 'valid'
 *   2. If ruleId present:
 *      a. Close pending occurrence (status: 'complete', completed_at: now())
 *      b. Fetch rule for frequency + auto_create + template_config
 *      c. Calculate next due date via calculateNextDueDate()
 *      d. Insert new pending occurrence with next due_date
 *      e. Update compliance_rules.last_completed_at and next_due_date
 *      f. If auto_create: call createTask() with template_config values
 *   3. Invalidate relevant query keys
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { calculateNextDueDate } from "@/services/propertyIntelligence/frequencyUtils";
import { createTask } from "@/services/tasks/taskMutations";

export interface MarkCompleteInput {
  complianceDocId: string;
  propertyId: string;
  ruleId?: string;
  /**
   * Sprint 4: Per-asset scope.
   * When provided alongside ruleId, only the occurrence for this specific
   * (rule_id, asset_id) pair is completed. The next occurrence is created for
   * this asset only — other assets' occurrences are unaffected.
   */
  assetId?: string;
}

export function useMarkComplianceComplete() {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      complianceDocId,
      propertyId,
      ruleId,
      assetId,
    }: MarkCompleteInput) => {
      if (!orgId) throw new Error("No active org");

      const now = new Date();
      const nowIso = now.toISOString();

      // 1. Update compliance_documents (skip for rule-only occurrences with no doc)
      if (complianceDocId) {
        const { error: docError } = await supabase
          .from("compliance_documents")
          .update({
            last_completed_date: nowIso,
            status: "valid",
          })
          .eq("id", complianceDocId);

        if (docError) throw docError;
      }

      if (!ruleId) return;

      // 2a. Close the pending occurrence
      // Sprint 4: if assetId is provided, scope to that specific (rule_id, asset_id) pair
      let occQuery = supabase
        .from("compliance_occurrences")
        .select("id")
        .eq("rule_id", ruleId)
        .eq("status", "pending")
        .order("due_date", { ascending: true })
        .limit(1);

      if (assetId) {
        occQuery = occQuery.eq("asset_id", assetId);
      }

      const { data: occurrences, error: occFetchError } = await occQuery;

      if (occFetchError) throw occFetchError;

      if (occurrences && occurrences.length > 0) {
        const { error: occUpdateError } = await supabase
          .from("compliance_occurrences")
          .update({ status: "complete", completed_at: nowIso })
          .eq("id", occurrences[0].id);

        if (occUpdateError) throw occUpdateError;
      }

      // 2b. Fetch rule for frequency + auto_create + template_config
      const { data: rule, error: ruleFetchError } = await supabase
        .from("compliance_rules")
        .select("frequency, auto_create, template_config, notify_days_before, scope_type")
        .eq("id", ruleId)
        .single();

      if (ruleFetchError) throw ruleFetchError;
      if (!rule) return;

      const frequency = rule.frequency ?? "annual";
      const nextDue = calculateNextDueDate(frequency, now);
      const nextDueDateStr = format(nextDue, "yyyy-MM-dd");

      // 2c/d. Insert next pending occurrence
      // Sprint 4: if assetId provided, create per-asset occurrence
      const { error: newOccError } = await supabase
        .from("compliance_occurrences")
        .insert({
          org_id: orgId,
          rule_id: ruleId,
          due_date: nextDueDateStr,
          status: "pending",
          ...(assetId ? { asset_id: assetId } : {}),
        });

      if (newOccError) throw newOccError;

      // 2e. Update rule metadata only when NOT per-asset (avoid overwriting with
      // per-asset dates when the rule has multiple assets at different cycle points)
      if (!assetId) {
        const { error: ruleUpdateError } = await supabase
          .from("compliance_rules")
          .update({
            last_completed_at: nowIso,
            next_due_date: nextDueDateStr,
          })
          .eq("id", ruleId);

        if (ruleUpdateError) throw ruleUpdateError;
      }

      // 2f. Auto-create task if configured
      if (rule.auto_create && rule.template_config) {
        const config = rule.template_config as Record<string, unknown>;
        await createTask(orgId, propertyId, {
          title: String(config.title_template ?? "Compliance task"),
          description: `Auto-created compliance task. Due: ${nextDueDateStr}`,
          priority: String(config.default_priority ?? "medium"),
          assigned_user_id: config.assigned_user_id
            ? String(config.assigned_user_id)
            : undefined,
          is_compliance: true,
        });
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["compliance", orgId, variables.propertyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["compliance_rules", orgId, variables.propertyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["compliance_recommendations", orgId, variables.propertyId],
      });
    },
  });
}
