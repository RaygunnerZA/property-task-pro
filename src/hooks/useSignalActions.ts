import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

async function invokeSignalEngine(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("signal-engine", { body });
  if (error) throw error;
  return data;
}

export function useSignalActions() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["signals"] });
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const dismiss = useMutation({
    mutationFn: (signalId: string) =>
      invokeSignalEngine({ action: "resolve", signal_id: signalId, disposition: "dismissed" }),
    onSuccess: () => {
      invalidate();
      toast.success("Signal dismissed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const snooze = useMutation({
    mutationFn: (signalId: string) =>
      invokeSignalEngine({
        action: "snooze",
        signal_id: signalId,
        until: new Date(Date.now() + 86400000).toISOString(),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Snoozed for 24 hours");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const acceptRecommendation = useMutation({
    mutationFn: (signalId: string) =>
      invokeSignalEngine({ action: "convert", signal_id: signalId }),
    onSuccess: () => {
      invalidate();
      toast.success("Task created from recommendation");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { dismiss, snooze, acceptRecommendation };
}
