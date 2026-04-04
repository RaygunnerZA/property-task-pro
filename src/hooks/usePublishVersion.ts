import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { complianceReviews } from "@/services/compliance/reviews";

export function usePublishVersion() {
  const queryClient = useQueryClient();

  const { mutateAsync: publish, isPending } = useMutation({
    mutationFn: async (reviewId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await complianceReviews.completeReview(
        reviewId,
        user.id
      );
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["compliance-review"] });
      void queryClient.invalidateQueries({
        queryKey: ["compliance-pending-reviews"],
      });
    },
  });

  return { publish, publishing: isPending };
}
