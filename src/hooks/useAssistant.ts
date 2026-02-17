/**
 * useAssistant — Phase 14 FILLA Assistant Mode
 * Calls assistant-reasoner (classification + reasoning in one). Handles proposed actions.
 */
import { useState, useCallback } from "react";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import type { AssistantMessage, ProposedAction } from "@/components/assistant/AssistantPanel";

export interface AssistantContextInput {
  type: "property" | "space" | "asset" | "task" | "document" | null;
  id: string | null;
}

export function useAssistant() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [proposedAction, setProposedAction] = useState<ProposedAction | null>(null);
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(
    async (query: string, context?: AssistantContextInput | null) => {
      if (!orgId || orgLoading) return;

      setLoading(true);
      setMessages((prev) => [...prev, { role: "user", content: query }]);

      try {
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
    [orgId, orgLoading]
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
