import { Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  contentBatchSubmitInput,
  overnightBatchConfirm,
  useAdminSubmitAiBatch,
} from "@/hooks/admin/useAdminAiBatch";

/** Same durable job table as Knowledge. Processor returns not-enabled until content-generate is wired. */
export function ContentQueueOvernightButton({
  topicId,
  stage,
  outputKinds,
  disabled,
}: {
  topicId: string;
  stage: "seo" | "brief" | "output" | "visual_concept";
  outputKinds?: string[];
  disabled?: boolean;
}) {
  const submit = useAdminSubmitAiBatch();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="border-0 btn-neomorphic h-8 text-xs"
      disabled={disabled || submit.isPending}
      onClick={() => {
        if (!overnightBatchConfirm("content", 1)) return;
        try {
          const input = contentBatchSubmitInput({ topicId, stage, outputKinds });
          submit.mutate(
            {
              capability: input.capability,
              mode: input.mode,
              topicId,
              outputKinds,
            },
            {
              onSuccess: () => toast.success("Queued overnight Content job"),
              onError: (e) =>
                toast.error(e instanceof Error ? e.message : "Could not queue overnight job"),
            }
          );
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not queue overnight job");
        }
      }}
    >
      {submit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
      Queue overnight
    </Button>
  );
}
