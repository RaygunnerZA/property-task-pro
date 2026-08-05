import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { INTAKE_ITEMS_QUERY_KEY } from "@/hooks/useIntakeItems";
import { triggerIntakeProcess } from "@/services/intake/intakeUpload";
import type { IntakeItem } from "@/types/intake-item";

export function usePromoteExternalEmailSignal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (signalId: string): Promise<IntakeItem[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("promote_external_email_signal", {
        p_signal_id: signalId,
      });
      if (error) throw error;
      return (data ?? []) as IntakeItem[];
    },
    onSuccess: async (items) => {
      void queryClient.invalidateQueries({ queryKey: [INTAKE_ITEMS_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["signals"] });

      await Promise.all(items.map((item) => triggerIntakeProcess(supabase, item.id)));

      const count = items.length;
      toast({
        title: "Added to Filla",
        description:
          count === 1
            ? "Email content is ready for review."
            : `${count} files added for review.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not convert email",
        description: error.message || "Try again.",
        variant: "destructive",
      });
    },
  });
}
