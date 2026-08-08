import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import {
  trackKnowledgeCreated,
  trackKnowledgeVerified,
} from "@/lib/knowledge/knowledgeTelemetry";
import type { KnowledgeRow, KnowledgeStatus } from "@/types/knowledge";

export function useOrgKnowledgeReviewQueue() {
  const { orgId, role, isLoading: orgLoading } = useActiveOrg();
  const canReview =
    Boolean(orgId) &&
    ["owner", "manager", "admin"].includes((role ?? "").toLowerCase());

  const query = useQuery({
    queryKey: ["org-knowledge-review", orgId],
    enabled: canReview && !orgLoading,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("list_org_knowledge_review_queue", {
        p_org_id: orgId,
      });
      if (error) throw error;
      return (data ?? []) as KnowledgeRow[];
    },
  });

  return { ...query, canReview };
}

export function useSetKnowledgeStatus() {
  const { orgId } = useActiveOrg();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      knowledgeId,
      status,
    }: {
      knowledgeId: string;
      status: KnowledgeStatus;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("set_knowledge_status", {
        p_knowledge_id: knowledgeId,
        p_status: status,
        p_org_id: orgId,
      });
      if (error) throw error;
      return data as KnowledgeRow;
    },
    onSuccess: (row, vars) => {
      if (vars.status === "verified" || vars.status === "published") {
        trackKnowledgeVerified({
          org_id: row.org_id,
          knowledge_id: row.id,
          scope: row.scope,
        });
      }
      void qc.invalidateQueries({ queryKey: ["org-knowledge-review", orgId] });
      void qc.invalidateQueries({ queryKey: ["published-knowledge", orgId] });
      void qc.invalidateQueries({ queryKey: ["org-knowledge-metrics", orgId] });
    },
  });
}

export function useUpsertOrgKnowledge() {
  const { orgId } = useActiveOrg();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      summary?: string;
      body?: string;
      sourceKind?: string;
      id?: string;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("upsert_org_knowledge", {
        p_org_id: orgId,
        p_title: input.title,
        p_summary: input.summary ?? null,
        p_body: input.body ?? null,
        p_source_kind: input.sourceKind ?? "org_upload",
        p_id: input.id ?? null,
      });
      if (error) throw error;
      return data as KnowledgeRow;
    },
    onSuccess: (row, vars) => {
      if (!vars.id) {
        trackKnowledgeCreated({
          org_id: row.org_id,
          knowledge_id: row.id,
          scope: row.scope,
          source_kind: row.source_kind,
        });
      }
      void qc.invalidateQueries({ queryKey: ["org-knowledge-review", orgId] });
      void qc.invalidateQueries({ queryKey: ["org-knowledge-metrics", orgId] });
    },
  });
}

export function useOrgKnowledgeMetrics() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["org-knowledge-metrics", orgId],
    enabled: Boolean(orgId) && !orgLoading,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("org_knowledge_metrics", {
        p_org_id: orgId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? {
        knowledge_created: 0,
        knowledge_verified: 0,
        knowledge_published: 0,
        knowledge_reused: 0,
        questions_answered: 0,
        automation_created: 0,
        time_saved_minutes: 0,
      }) as {
        knowledge_created: number;
        knowledge_verified: number;
        knowledge_published: number;
        knowledge_reused: number;
        questions_answered: number;
        automation_created: number;
        time_saved_minutes: number;
      };
    },
  });
}
