import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSaveClauseDecision() {
  const queryClient = useQueryClient();

  const { mutateAsync: saveDecision, isPending } = useMutation({
    mutationFn: async (input: {
      clauseId: string;
      decision: "approved" | "rejected";
    }) => {
      const flagged = input.decision === "rejected";
      const { error } = await supabase
        .from("compliance_clauses")
        .update({ flagged })
        .eq("id", input.clauseId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["compliance-review"] });
    },
  });

  return { saveDecision, saving: isPending };
}
