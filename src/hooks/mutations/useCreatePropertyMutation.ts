import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import type { Database } from "@/integrations/supabase/types";

export type CreatePropertyV2Args = Database["public"]["Functions"]["create_property_v2"]["Args"];

function parsePropertyRpcResult(data: unknown): string {
  if (data && typeof data === "object" && "id" in data && typeof (data as { id: unknown }).id === "string") {
    return (data as { id: string }).id;
  }
  throw new Error("create_property_v2: unexpected response (missing id)");
}

/**
 * Creates a property via `create_property_v2`, then fires `property_created` and invalidates caches.
 * Per @Docs/24_Phase1_Observability_Spec — do not call `track("property_created")` from UI components.
 */
export function useCreatePropertyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: CreatePropertyV2Args) => {
      const { data, error } = await supabase.rpc("create_property_v2", args);
      if (error) throw error;
      const propertyId = parsePropertyRpcResult(data);
      return { propertyId, raw: data };
    },
    onSuccess: (result, variables) => {
      track("property_created", {
        org_id: variables.p_org_id,
        property_id: result.propertyId,
      });
      void queryClient.invalidateQueries({ queryKey: ["properties"] });
      void queryClient.invalidateQueries({ queryKey: ["properties", variables.p_org_id] });
    },
  });
}
