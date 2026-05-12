/**
 * Sets an asset's status to "retired" (soft-archive).
 * Invalidates asset list and asset-detail caches on success.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RetireAssetVariables {
  assetId: string;
  /** Used to narrow query invalidation. */
  orgId?: string;
}

export function useRetireAssetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assetId }: RetireAssetVariables) => {
      const { error } = await supabase
        .from("assets")
        .update({ status: "retired" })
        .eq("id", assetId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["assets"] });
      void queryClient.invalidateQueries({ queryKey: ["asset", variables.assetId] });
      if (variables.orgId) {
        void queryClient.invalidateQueries({
          queryKey: ["assets", variables.orgId],
        });
      }
    },
  });
}
