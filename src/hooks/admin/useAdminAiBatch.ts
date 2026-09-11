import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  MAX_GUIDANCE_BATCH_ITEMS,
  contentStageToBatchCapability,
  isAiBatchCapabilityEnabled,
  type AiBatchCapability,
  type AiBatchMode,
} from "@/lib/ai/aiBatch";
import {
  ingestResearchSources,
  type KnowledgeGapResearchProgress,
  type KnowledgeGapResearchResult,
} from "@/hooks/admin/useAdminKnowledge";
import {
  formatEdgeFunctionToast,
  parseEdgeFunctionError,
} from "@/lib/edgeFunctionErrors";

export type AiBatchJobRow = {
  id: string;
  capability: string;
  mode: string;
  status: string;
  created_by: string;
  provider: string | null;
  model_used: string | null;
  prompt_version: string | null;
  provider_batch_id: string | null;
  item_ids: unknown;
  item_count: number;
  succeeded_count: number;
  failed_count: number;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export const AI_BATCH_JOBS_QUERY_KEY = ["admin-ai-batch-jobs"] as const;

const OPEN_STATUSES = new Set(["queued", "submitted", "running", "intake_pending"]);

export function isOpenAiBatchJob(job: Pick<AiBatchJobRow, "status">): boolean {
  return OPEN_STATUSES.has(job.status);
}

async function invokeJson(name: string, body: Record<string, unknown>) {
  const { data, error, response } = await supabase.functions.invoke(name, { body });
  if (error) {
    const info = await parseEdgeFunctionError(error, data, name);
    if (!info.status && response) info.status = response.status;
    const err = new Error(formatEdgeFunctionToast(info)) as Error & {
      code?: string;
      status?: number;
    };
    err.code = info.code;
    err.status = info.status;
    throw err;
  }
  const payload = data as { ok?: boolean; code?: string; message?: string };
  if (payload && payload.ok === false) {
    throw new Error(payload.message || payload.code || `${name} failed`);
  }
  return data;
}

export function useAdminAiBatchJobs() {
  return useQuery({
    queryKey: AI_BATCH_JOBS_QUERY_KEY,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_list_ai_batch_jobs", {
        p_limit: 25,
      });
      if (error) throw error;
      return (data ?? []) as AiBatchJobRow[];
    },
    staleTime: 10_000,
  });
}

export function useAdminPollAiBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown> = {}) => {
      return invokeJson("ai-batch-poll", body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: AI_BATCH_JOBS_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-missing-guidance"] });
    },
  });
}

export function useAdminSubmitAiBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      capability: AiBatchCapability;
      mode: AiBatchMode;
      knowledgeIds?: string[];
      gaps?: Array<{
        id: string;
        topic_key: string;
        topic: string;
        jurisdiction: string;
        status: "missing" | "partial";
      }>;
      topicId?: string;
      outputKinds?: string[];
      regenerate?: boolean;
    }) => {
      if (!isAiBatchCapabilityEnabled(input.capability)) {
        throw new Error(
          "Overnight batch for Content is reserved on the same job table; the processor is not enabled yet."
        );
      }
      const body: Record<string, unknown> = {
        capability: input.capability,
        mode: input.mode,
      };
      if (input.knowledgeIds) body.knowledge_ids = input.knowledgeIds;
      if (input.gaps) body.gaps = input.gaps;
      if (input.topicId) body.topic_id = input.topicId;
      if (input.outputKinds) body.output_kinds = input.outputKinds;
      if (input.regenerate) body.regenerate = true;
      return invokeJson("ai-batch-submit", body) as Promise<{
        ok: true;
        job_id: string;
        status: string;
        item_count: number;
      }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: AI_BATCH_JOBS_QUERY_KEY });
    },
  });
}

export async function submitGuidanceBatches(
  knowledgeIds: string[],
  mode: "generate" | "improve"
): Promise<{ jobCount: number; itemCount: number }> {
  const unique = [...new Set(knowledgeIds)];
  if (unique.length === 0) return { jobCount: 0, itemCount: 0 };
  let itemCount = 0;
  let jobCount = 0;
  for (let i = 0; i < unique.length; i += MAX_GUIDANCE_BATCH_ITEMS) {
    const chunk = unique.slice(i, i + MAX_GUIDANCE_BATCH_ITEMS);
    await invokeJson("ai-batch-submit", {
      capability: "knowledge_guidance_draft",
      mode,
      knowledge_ids: chunk,
    });
    jobCount += 1;
    itemCount += chunk.length;
  }
  return { jobCount, itemCount };
}

export function usePollOpenAiBatchJobs(jobs: AiBatchJobRow[] | undefined) {
  const poll = useAdminPollAiBatch();
  const hasOpen = (jobs ?? []).some(isOpenAiBatchJob);
  const inflight = useRef(false);

  useEffect(() => {
    if (!hasOpen) return;
    const tick = async () => {
      if (inflight.current) return;
      inflight.current = true;
      try {
        await poll.mutateAsync({});
      } catch {
        /* banner surfaces job errors */
      } finally {
        inflight.current = false;
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 30_000);
    return () => window.clearInterval(id);
    // poll.mutateAsync identity is unstable; hasOpen is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOpen]);
}

export function useFinishPendingResearchJobs(
  jobs: AiBatchJobRow[] | undefined,
  onProgress?: (progress: KnowledgeGapResearchProgress | null) => void
) {
  const qc = useQueryClient();
  const claimed = useRef(new Set<string>());

  useEffect(() => {
    const pending = (jobs ?? []).filter(
      (job) => job.capability === "knowledge_gap_research" && job.status === "intake_pending"
    );
    for (const job of pending) {
      if (claimed.current.has(job.id)) continue;
      claimed.current.add(job.id);
      void (async () => {
        let ingested = false;
        try {
          const claimedRes = (await invokeJson("ai-batch-poll", {
            claim_research_intake: { job_id: job.id },
          })) as { job?: AiBatchJobRow };
          const row = claimedRes.job ?? job;
          const meta = (row.metadata ?? {}) as {
            sources?: Array<{
              url: string;
              title?: string;
              publisher?: string;
              covers: string[];
            }>;
            uncovered?: string[];
          };
          const gaps = Array.isArray(row.item_ids)
            ? row.item_ids.filter(
                (item): item is {
                  id: string;
                  topic_key: string;
                  topic: string;
                  jurisdiction: string;
                  status: "missing" | "partial";
                } =>
                  Boolean(
                    item &&
                      typeof item === "object" &&
                      !Array.isArray(item) &&
                      typeof (item as { id?: unknown }).id === "string"
                  )
              )
            : [];
          const result = await ingestResearchSources({
            gaps,
            sources: meta.sources ?? [],
            uncovered: meta.uncovered,
            onProgress: (p) => onProgress?.(p),
          });
          ingested = true;
          await invokeJson("ai-batch-poll", {
            complete_research_intake: {
              job_id: job.id,
              created_count: result.createdCount,
              failed_count: result.failedSources.length,
              knowledge_ids: result.knowledgeIds,
              failed_sources: result.failedSources,
              uncovered: result.uncoveredGapIds,
            },
          });
        } catch (err) {
          if (ingested) return;
          claimed.current.delete(job.id);
          await invokeJson("ai-batch-poll", {
            complete_research_intake: {
              job_id: job.id,
              created_count: 0,
              failed_count: 1,
              knowledge_ids: [],
              error: err instanceof Error ? err.message : "intake_failed",
            },
          }).catch(() => undefined);
        } finally {
          onProgress?.(null);
          void qc.invalidateQueries({ queryKey: AI_BATCH_JOBS_QUERY_KEY });
          void qc.invalidateQueries({ queryKey: ["admin-knowledge-queue"] });
          void qc.invalidateQueries({ queryKey: ["admin-knowledge-metrics"] });
        }
      })();
    }
  }, [jobs, onProgress, qc]);
}

export function overnightBatchConfirm(
  kind: "generate" | "improve" | "research" | "content",
  count: number
): boolean {
  const noun =
    kind === "research"
      ? `source discovery for ${count} gap${count === 1 ? "" : "s"}`
      : kind === "improve"
        ? `Improve guidance for ${count} candidate${count === 1 ? "" : "s"}`
        : kind === "content"
          ? `this Content stage (${count} topic${count === 1 ? "" : "s"})`
          : `Generate guidance for ${count} candidate${count === 1 ? "" : "s"}`;
  return window.confirm(
    [
      `Queue overnight (half price): ${noun}?`,
      "Uses Gemini Batch — typically 1–4 hours, up to 24 hours.",
      kind === "research"
        ? "When sources are found, Filla fetches each unique URL into Review (full-price document analysis). Discovery itself is the discounted model call."
        : kind === "content"
          ? "Uses the same ai_batch_jobs table as Knowledge. Drafts stay unverified. The Content processor is not enabled yet — submit will refuse until it is wired."
          : "Drafts remain unverified. Nothing will be verified or published.",
    ].join("\n\n")
  );
}

/** Content Tree: same job table. Throws until the processor is enabled. */
export function contentBatchSubmitInput(input: {
  topicId: string;
  stage: "seo" | "brief" | "output" | "visual_concept" | "visual_final";
  outputKinds?: string[];
  regenerate?: boolean;
}): { capability: AiBatchCapability; mode: AiBatchMode; topicId: string } {
  const capability = contentStageToBatchCapability(input.stage);
  if (!capability) {
    throw new Error("This Content stage cannot be queued overnight.");
  }
  const mode =
    capability === "content_seo_draft"
      ? "seo"
      : capability === "content_brief_draft"
        ? "brief"
        : capability === "content_output_draft"
          ? "output"
          : "visual_brief";
  return { capability, mode, topicId: input.topicId };
}
