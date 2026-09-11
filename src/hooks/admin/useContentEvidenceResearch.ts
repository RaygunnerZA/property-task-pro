/**
 * Content Tree: one research pack on the linked Knowledge row → critic → human verify.
 * Never auto-verifies claims or auto-approves SEO.
 */
import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminUpsertContentTopicStage } from "@/hooks/admin/useAdminKnowledge";
import {
  classifyEvidenceBlocker,
  buildEvidenceResearchFingerprint,
  jurisdictionFromApplicability,
  mergeResearchMetaIntoSeoCurrent,
  readResearchMetaFromSeoCurrent,
  shouldAutoKickEvidenceResearch,
  type ContentEvidenceResearchMeta,
  type EvidenceResearchPhase,
} from "@/lib/content/contentEvidenceResearch";
import {
  getSeoReadiness,
  type ContentStageEnvelope,
} from "@/lib/content/contentTopicWorkflow";
import {
  formatEdgeFunctionToast,
  parseEdgeFunctionError,
} from "@/lib/edgeFunctionErrors";

export type ContentEvidenceResearchRunInput = {
  topicId: string;
  knowledgeId: string;
  knowledgeTitle: string;
  applicability?: Record<string, unknown> | null;
  seoEnvelope: ContentStageEnvelope;
  claims?: Array<{
    claim_text?: string | null;
    verification_status?: string | null;
  }>;
  hasUsableSourceUrl: boolean;
  /** Manual remedy click — allow retry of same fingerprint. */
  force?: boolean;
  /** Auto-kick path — skip when fingerprint already handled. */
  auto?: boolean;
};

export type ContentEvidenceResearchResult =
  | { ok: true; outcome: "retrieve" | "verify_only" | "awaiting_human" | "ready" }
  | { ok: false; outcome: "skipped" | "failed"; reason?: string };

async function invokeEvidencePack(body: {
  knowledge_id: string;
  evidence_gaps: string[];
  jurisdiction: string;
  topic_title: string;
  allow_discovery: boolean;
}) {
  const { data, error } = await supabase.functions.invoke("knowledge-evidence-pack", {
    body,
  });
  if (error) {
    const info = await parseEdgeFunctionError(error, data, "knowledge-evidence-pack");
    throw new Error(formatEdgeFunctionToast(info));
  }
  const payload = data as {
    ok?: boolean;
    error?: string;
    message?: string;
    remaining_gaps?: string[];
    attached_urls?: string[];
    sources_used?: string[];
  };
  if (payload && payload.ok === false) {
    throw new Error(payload.message || payload.error || "Evidence pack failed");
  }
  return payload;
}

async function invokeKnowledgeCritic(knowledgeId: string) {
  const { data, error } = await supabase.functions.invoke("knowledge-critic", {
    body: { knowledge_id: knowledgeId },
  });
  if (error) {
    const info = await parseEdgeFunctionError(error, data, "knowledge-critic");
    throw new Error(formatEdgeFunctionToast(info));
  }
  const payload = data as { ok?: boolean; error?: string; message?: string };
  if (payload && payload.ok === false) {
    throw new Error(payload.message || payload.error || "Critic failed");
  }
  return payload;
}

export function useContentEvidenceResearch() {
  const qc = useQueryClient();
  const upsertStage = useAdminUpsertContentTopicStage();
  const [phase, setPhase] = useState<EvidenceResearchPhase>("idle");
  const runningRef = useRef(false);

  const persistMeta = useCallback(
    async (
      topicId: string,
      seoEnvelope: ContentStageEnvelope,
      meta: ContentEvidenceResearchMeta
    ) => {
      const next: ContentStageEnvelope = {
        ...seoEnvelope,
        current: mergeResearchMetaIntoSeoCurrent(seoEnvelope.current, meta),
      };
      await upsertStage.mutateAsync({
        topicId,
        seo: next as unknown as Record<string, unknown>,
      });
      return next;
    },
    [upsertStage]
  );

  const run = useCallback(
    async (input: ContentEvidenceResearchRunInput): Promise<ContentEvidenceResearchResult> => {
      if (runningRef.current) {
        return { ok: false, outcome: "skipped", reason: "already_running" };
      }

      const readiness = getSeoReadiness(input.seoEnvelope);
      const jurisdiction = jurisdictionFromApplicability(input.applicability);
      const fingerprint = buildEvidenceResearchFingerprint({
        topicId: input.topicId,
        knowledgeId: input.knowledgeId,
        knowledgeGaps: readiness.knowledgeGaps,
        sourceUnavailable: readiness.sourceUnavailable,
      });
      const existingMeta = readResearchMetaFromSeoCurrent(input.seoEnvelope.current);

      if (
        input.auto &&
        !shouldAutoKickEvidenceResearch({ fingerprint, meta: existingMeta })
      ) {
        return { ok: false, outcome: "skipped", reason: "fingerprint_handled" };
      }

      if (
        !input.force &&
        !input.auto &&
        existingMeta.research_status === "running" &&
        existingMeta.research_fingerprint === fingerprint
      ) {
        return { ok: false, outcome: "skipped", reason: "already_running" };
      }

      runningRef.current = true;
      setPhase("classifying");

      let envelope = input.seoEnvelope;

      try {
        const blocker = classifyEvidenceBlocker({
          readiness,
          claims: input.claims,
          hasUsableSourceUrl: input.hasUsableSourceUrl,
        });

        if (blocker === "ready") {
          setPhase("idle");
          return { ok: true, outcome: "ready" };
        }

        if (blocker === "retrieve") {
          setPhase("retrieve");
          envelope = await persistMeta(input.topicId, envelope, {
            research_status: "idle",
            research_fingerprint: fingerprint,
            research_finished_at: new Date().toISOString(),
            research_last_error: null,
          });
          return { ok: true, outcome: "retrieve" };
        }

        if (blocker === "verify_only") {
          setPhase("verify_only");
          await persistMeta(input.topicId, envelope, {
            research_status: "verify_only",
            research_fingerprint: fingerprint,
            research_finished_at: new Date().toISOString(),
            research_last_error: null,
          });
          return { ok: true, outcome: "verify_only" };
        }

        // research_pack
        setPhase("packing");
        envelope = await persistMeta(input.topicId, envelope, {
          research_status: "running",
          research_fingerprint: fingerprint,
          research_started_at: new Date().toISOString(),
          research_last_error: null,
        });

        const pack = await invokeEvidencePack({
          knowledge_id: input.knowledgeId,
          evidence_gaps: readiness.knowledgeGaps,
          jurisdiction,
          topic_title: input.knowledgeTitle,
          allow_discovery: !input.hasUsableSourceUrl,
        });

        setPhase("critic");
        await invokeKnowledgeCritic(input.knowledgeId);

        await persistMeta(input.topicId, envelope, {
          research_status: "awaiting_human",
          research_fingerprint: fingerprint,
          research_finished_at: new Date().toISOString(),
          research_last_error: null,
          research_remaining_gaps: pack.remaining_gaps ?? [],
          research_attached_urls: pack.attached_urls ?? pack.sources_used ?? [],
        });

        setPhase("awaiting_human");
        void qc.invalidateQueries({ queryKey: ["admin-content-topic", input.topicId] });
        void qc.invalidateQueries({ queryKey: ["admin-knowledge"] });
        return { ok: true, outcome: "awaiting_human" };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Evidence research failed";
        setPhase("failed");
        try {
          await persistMeta(input.topicId, envelope, {
            research_status: "failed",
            research_fingerprint: fingerprint,
            research_finished_at: new Date().toISOString(),
            research_last_error: message.slice(0, 500),
          });
        } catch {
          // persist failure must not mask the original error
        }
        return { ok: false, outcome: "failed", reason: message };
      } finally {
        runningRef.current = false;
      }
    },
    [persistMeta, qc]
  );

  return {
    run,
    phase,
    isPending:
      phase === "classifying" || phase === "packing" || phase === "critic",
  };
}
