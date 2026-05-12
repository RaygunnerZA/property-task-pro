/**
 * Inserts a new space row for a property.
 * Invalidates spaces caches for the owning org + property on success.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export type InsertSpaceVariables = Pick<
  TablesInsert<"spaces">,
  "name" | "org_id" | "property_id" | "icon_name" | "space_type_id"
>;

export function useInsertSpaceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (insert: InsertSpaceVariables) => {
      const { data, error } = await supabase
        .from("spaces")
        .insert(insert)
        .select("id, name, org_id, property_id, icon_name, space_type_id")
        .single();
      if (error) throw error;
      if (!data) throw new Error("useInsertSpaceMutation: no data returned");
      return data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["spaces"] });
      if (data.org_id) {
        void queryClient.invalidateQueries({
          queryKey: ["spaces", data.org_id],
        });
        if (data.property_id) {
          void queryClient.invalidateQueries({
            queryKey: ["spaces", data.org_id, data.property_id],
          });
        }
      }
    },
  });
}
