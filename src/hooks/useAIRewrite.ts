import { useState, useCallback } from "react";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { fetchClauseRewrite } from "@/services/compliance/clauseRewriteAi";

export function useAIRewrite(opts: {
  clauseText: string;
  criticNotes?: string | null;
}) {
  const { orgId } = useActiveOrg();
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [reasoning, setReasoning] = useState("");

  const generate = useCallback(async () => {
    if (!orgId) {
      console.warn("[useAIRewrite] No active org");
      return;
    }
    const text = (opts.clauseText || "").trim();
    if (!text) return;

    setLoading(true);
    try {
      const out = await fetchClauseRewrite({
        org_id: orgId,
        clause_text: text,
        critic_notes: opts.criticNotes ?? null,
      });
      setSuggestion(out.suggestion);
      setReasoning(out.reasoning);
    } catch (error) {
      console.error("Error generating AI rewrite:", error);
    } finally {
      setLoading(false);
    }
  }, [orgId, opts.clauseText, opts.criticNotes]);

  const accept = useCallback(() => {
    setSuggestion("");
    setReasoning("");
  }, []);

  const regenerate = useCallback(async () => {
    setSuggestion("");
    setReasoning("");
    await generate();
  }, [generate]);

  return {
    loading,
    suggestion,
    reasoning,
    generate,
    accept,
    regenerate,
  };
}
