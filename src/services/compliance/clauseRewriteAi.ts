import { supabase } from "@/integrations/supabase/client";

export async function fetchClauseRewrite(params: {
  org_id: string;
  clause_text: string;
  critic_notes?: string | null;
}): Promise<{ suggestion: string; reasoning: string }> {
  const { data, error } = await supabase.functions.invoke(
    "compliance-clause-rewrite",
    { body: params }
  );

  if (error) throw new Error(error.message);

  const body = data as {
    ok?: boolean;
    suggestion?: string;
    reasoning?: string;
    error?: string;
  };

  if (!body?.ok) {
    throw new Error(body?.error || "Rewrite failed");
  }

  return {
    suggestion: body.suggestion ?? "",
    reasoning: body.reasoning ?? "",
  };
}
