/**
 * usePropertyIntelligenceSeed
 *
 * Surfaces compliance schedule gaps identified by the Property Intelligence Engine
 * and provides a single user-confirmed action to write them to the existing
 * compliance_recommendations flow.
 *
 * Design constraints:
 *   - Never auto-creates documents or tasks silently.
 *   - seed() is always user-initiated.
 *   - Idempotent: a (property_id, document_type) pair is seeded at most once.
 *     Enforced by explicit pre-insert deduplication against compliance_documents.
 *   - Respects org_settings.auto_task_generation gate.
 *   - repairingScope branching: landlord-responsible rules generate
 *     "Chase landlord re: [type]" tasks for tenant users.
 *   - Uses existing compliance_recommendations (status:'pending') so users
 *     review suggestions in the standard ComplianceCalendar UI.
 *
 * Seed flow per evaluated compliance rule (Sprint 1 update):
 *   1. Check: does compliance_documents already have a row for this
 *      (property_id, document_type)? If yes, skip.
 *   2. Insert compliance_rules record (schedule definition).
 *   3. Insert compliance_documents placeholder with rule_id backlink.
 *   4. Insert compliance_occurrences record for the first upcoming due date.
 *   5. Insert compliance_recommendations pointing to the stub document.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useOrgSettings } from "@/hooks/useOrgSettings";
import { usePropertyProfile } from "@/hooks/usePropertyProfile";
import {
  evaluateProfile,
  normalizePropertyProfile,
} from "@/services/propertyIntelligence/ruleEvaluator";
import { calculateNextDueDate } from "@/services/propertyIntelligence/frequencyUtils";
import type { EvaluatedRule } from "@/services/propertyIntelligence/types";

export interface SeedPreview {
  /** Rules ready to be seeded on user confirmation. */
  pendingRules: EvaluatedRule[];
  /** Context warnings — surface in UI but never seeded as compliance records. */
  contextWarnings: EvaluatedRule[];
  /** Compliance types already present on the property (already seeded or manually entered). */
  alreadyPresentCount: number;
}

export interface UsePropertyIntelligenceSeedResult {
  preview: SeedPreview | null;
  isLoadingPreview: boolean;
  /** User-initiated. Pass specific ruleIds to seed a subset; omit to seed all pendingRules. */
  seed: (selectedRuleIds?: string[]) => Promise<void>;
  isSeeding: boolean;
  seedError: string | null;
  isEnabled: boolean;
}

export function usePropertyIntelligenceSeed(
  propertyId: string | undefined
): UsePropertyIntelligenceSeedResult {
  const { orgId } = useActiveOrg();
  const { settings, isLoading: settingsLoading } = useOrgSettings();
  const { data: rawProfile, isLoading: profileLoading } = usePropertyProfile(propertyId);
  const queryClient = useQueryClient();
  const [seedError, setSeedError] = useState<string | null>(null);

  const isEnabled =
    !settingsLoading &&
    settings?.auto_task_generation !== false &&
    settings?.automated_intelligence !== "off";

  // Fetch existing compliance_documents for this property to power deduplication.
  // This is the authoritative source for "already seeded" — more reliable than
  // checking compliance_recommendations which can have stale status.
  const { data: existingDocTypes } = useQuery({
    queryKey: ["seed_existing_doc_types", orgId, propertyId],
    queryFn: async () => {
      if (!orgId || !propertyId) return new Set<string>();
      const { data } = await supabase
        .from("compliance_documents")
        .select("document_type")
        .eq("property_id", propertyId)
        .eq("org_id", orgId)
        .not("document_type", "is", null);
      return new Set((data ?? []).map((d) => d.document_type as string));
    },
    enabled: !!orgId && !!propertyId,
    staleTime: 60_000,
  });

  const isLoadingPreview = profileLoading || settingsLoading;

  const preview: SeedPreview | null = (() => {
    if (!rawProfile || !isEnabled) return null;

    const profile = normalizePropertyProfile(rawProfile);
    const result = evaluateProfile(profile);

    // Exclude rules whose compliance type is already in compliance_documents
    // (covers both manually-entered records and previously seeded ones).
    const alreadyKnown = existingDocTypes ?? new Set<string>();
    const pendingRules = result.complianceRecommendations.filter((r) => {
      if (r.output.kind !== "suggest_compliance") return false;
      return !alreadyKnown.has(r.output.complianceType);
    });

    return {
      pendingRules,
      contextWarnings: result.warnings,
      alreadyPresentCount: alreadyKnown.size,
    };
  })();

  const seedMutation = useMutation({
    mutationFn: async (selectedRuleIds?: string[]) => {
      if (!orgId || !propertyId || !rawProfile) {
        throw new Error("Missing org, property, or profile data");
      }

      const allPending = preview?.pendingRules ?? [];
      const rulesToSeed = selectedRuleIds
        ? allPending.filter((r) => selectedRuleIds.includes(r.ruleId))
        : allPending;

      if (rulesToSeed.length === 0) return;

      // Re-fetch existing doc types immediately before insert to prevent
      // race conditions (e.g. user opens two tabs and confirms both).
      const { data: latestDocs } = await supabase
        .from("compliance_documents")
        .select("document_type")
        .eq("property_id", propertyId)
        .eq("org_id", orgId)
        .not("document_type", "is", null);

      const alreadyInserted = new Set(
        (latestDocs ?? []).map((d) => d.document_type as string)
      );

      for (const evaluated of rulesToSeed) {
        if (evaluated.output.kind !== "suggest_compliance") continue;
        const { complianceType, frequency, legalRef, taskPrefix } = evaluated.output;

        // Hard deduplication guard — skip if already present
        if (alreadyInserted.has(complianceType)) continue;

        // Derive task title based on repairingScope
        const taskTitle =
          taskPrefix === "chase_landlord"
            ? `Chase landlord re: ${complianceType}`
            : `Schedule ${complianceType}`;

        // 1. Insert compliance_rules — the schedule definition
        const { data: rule, error: ruleError } = await supabase
          .from("compliance_rules")
          .insert({
            org_id: orgId,
            property_id: propertyId,
            name: complianceType,
            description: evaluated.rationale,
            frequency: frequency ?? "annual",
            scope_type: "property",
            auto_create: false,
            notify_days_before: 30,
            next_due_date: format(
              calculateNextDueDate(frequency ?? "annual"),
              "yyyy-MM-dd"
            ),
          })
          .select("id")
          .single();

        if (ruleError) throw ruleError;

        // 2. Create compliance_documents placeholder with rule_id backlink
        const { data: doc, error: docError } = await supabase
          .from("compliance_documents")
          .insert({
            org_id: orgId,
            property_id: propertyId,
            document_type: complianceType,
            title: complianceType,
            frequency,
            status: "pending",
            notes: `Seeded by Filla Intelligence. ${legalRef}`,
            rule_id: rule.id,
          })
          .select("id")
          .single();

        if (docError) throw docError;

        // 3. Create the first compliance_occurrences record
        const { error: occError } = await supabase
          .from("compliance_occurrences")
          .insert({
            org_id: orgId,
            rule_id: rule.id,
            due_date: format(
              calculateNextDueDate(frequency ?? "annual"),
              "yyyy-MM-dd"
            ),
            status: "pending",
          });

        if (occError) throw occError;

        // Mark as inserted to prevent duplicates within this same batch
        alreadyInserted.add(complianceType);

        // 4. Create compliance_recommendations pointing to the document
        const { error: recError } = await supabase
          .from("compliance_recommendations")
          .insert({
            org_id: orgId,
            property_id: propertyId,
            compliance_document_id: doc.id,
            recommended_action: evaluated.rationale,
            risk_level: "medium",
            status: "pending",
            recommended_tasks: [
              {
                title: taskTitle,
                description: evaluated.rationale,
                propertyId,
              },
            ],
          });

        if (recError) throw recError;
      }
    },
    onSuccess: () => {
      setSeedError(null);
      queryClient.invalidateQueries({
        queryKey: ["compliance_recommendations", orgId, propertyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["compliance_rules", orgId, propertyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["seed_existing_doc_types", orgId, propertyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["property_profile", orgId, propertyId],
      });
    },
    onError: (err: Error) => {
      setSeedError(err.message ?? "Failed to seed compliance schedule");
    },
  });

  return {
    preview,
    isLoadingPreview,
    seed: (selectedRuleIds) => seedMutation.mutateAsync(selectedRuleIds),
    isSeeding: seedMutation.isPending,
    seedError,
    isEnabled,
  };
}
