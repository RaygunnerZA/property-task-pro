/**
 * useAssistant — Phase 14 FILLA Assistant Mode
 * Calls assistant-reasoner (classification + reasoning in one). Handles proposed actions.
 *
 * Dev Mode enhancement (Phase 4.2):
 *   When DevMode is enabled, "why" questions are intercepted and answered
 *   locally via the rule engine explainability layer. This enables instant
 *   introspection without a remote call (AI "Development Mode").
 *
 * @deprecated assistant-intent — Removed. Only assistant-reasoner is used.
 * No references to assistant-intent remain in the codebase.
 */
import { useState, useCallback } from "react";
import { useActiveOrg } from "./useActiveOrg";
import { useDevMode } from "@/context/useDevMode";
import { supabase } from "@/integrations/supabase/client";
import type { AssistantMessage, ProposedAction } from "@/components/assistant/AssistantPanel";

export interface AssistantContextInput {
  type: "property" | "space" | "asset" | "task" | "document" | null;
  id: string | null;
}

export function useAssistant() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const devMode = useDevMode();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [proposedAction, setProposedAction] = useState<ProposedAction | null>(null);
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(
    async (query: string, context?: AssistantContextInput | null) => {
      if (!orgId || orgLoading) return;

      setLoading(true);
      setMessages((prev) => [...prev, { role: "user", content: query }]);

      if (import.meta.env.DEV && devMode?.enabled) {
        try {
          const { handleDevQuestion } = await import("@/services/dev/aiExplainability");
          const devResult = handleDevQuestion(query);
          if (devResult) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: `[Dev Mode]\n\n${devResult.answer}` },
            ]);
            setLoading(false);
            return;
          }
        } catch {
          // Fall through to remote assistant
        }
      }

      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5837fa'},body:JSON.stringify({sessionId:'5837fa',runId:'pre-fix',hypothesisId:'H1',location:'src/hooks/useAssistant.ts:56',message:'assistant invoke payload',data:{queryLength:query.length,hasContext:!!context,contextType:context?.type ?? null,hasContextId:!!context?.id,orgIdPresent:!!orgId},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const { data: reasonerData, error: reasonerErr } = await supabase.functions.invoke(
          "assistant-reasoner",
          {
            body: {
              query,
              context: context ? { type: context.type, id: context.id } : null,
              org_id: orgId,
            },
          }
        );

        if (reasonerErr) throw reasonerErr;
        if (!reasonerData?.ok) throw new Error(reasonerData?.error ?? "Reasoner failed");

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5837fa'},body:JSON.stringify({sessionId:'5837fa',runId:'pre-fix',hypothesisId:'H4',location:'src/hooks/useAssistant.ts:72',message:'assistant response payload',data:{ok:reasonerData?.ok ?? null,sourcesCount:Array.isArray(reasonerData?.sources)?reasonerData.sources.length:null,answerPreview:typeof reasonerData?.answer==='string'?reasonerData.answer.slice(0,120):null,hasProposedAction:!!reasonerData?.proposed_action},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: reasonerData.answer ?? "No response." },
        ]);

        if (reasonerData.proposed_action) {
          setProposedAction(reasonerData.proposed_action as ProposedAction);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong.";
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }]);
      } finally {
        setLoading(false);
      }
    },
    [orgId, orgLoading, devMode?.enabled]
  );

  const confirmAction = useCallback(async () => {
    if (!proposedAction || !orgId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("assistant-action-executor", {
        body: {
          type: proposedAction.type === "task" ? "create_task" : "link_compliance",
          payload: proposedAction.payload,
          org_id: orgId,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Action failed");

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            proposedAction.type === "task"
              ? `Task created successfully.`
              : `Document linked to compliance.`,
        },
      ]);
      setProposedAction(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed.";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }, [proposedAction, orgId]);

  const rejectAction = useCallback(() => {
    setProposedAction(null);
  }, []);

  return {
    messages,
    proposedAction,
    loading,
    sendMessage,
    confirmAction,
    rejectAction,
  };
}
