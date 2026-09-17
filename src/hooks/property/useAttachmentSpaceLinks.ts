import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import {
  reconcileSpaceLinks,
  spaceIdsToAdd,
} from "@/lib/records/attachmentSpaces";

/**
 * Mutations for document ↔ space labels via attachment_spaces.
 * Add = insert (no-op if already linked). Remove = delete one junction row.
 */
export function useAttachmentSpaceLinks() {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["property-documents"] });
    queryClient.invalidateQueries({ queryKey: ["document-detail"] });
  }, [queryClient]);

  const addSpaceLink = useCallback(
    async (
      attachmentId: string,
      spaceId: string,
      currentSpaceIds: readonly string[] = []
    ): Promise<"added" | "already"> => {
      if (!orgId) throw new Error("No organisation");
      if (spaceIdsToAdd(currentSpaceIds, spaceId).length === 0) return "already";

      const { error } = await supabase.from("attachment_spaces").insert({
        attachment_id: attachmentId,
        space_id: spaceId,
        org_id: orgId,
      });

      if (error) {
        // Primary key (attachment_id, space_id) — treat race as already linked.
        if (error.code === "23505") return "already";
        throw error;
      }
      invalidate();
      return "added";
    },
    [orgId, invalidate]
  );

  const removeSpaceLink = useCallback(
    async (attachmentId: string, spaceId: string): Promise<void> => {
      if (!orgId) throw new Error("No organisation");
      const { error } = await supabase
        .from("attachment_spaces")
        .delete()
        .eq("attachment_id", attachmentId)
        .eq("space_id", spaceId)
        .eq("org_id", orgId);
      if (error) throw error;
      invalidate();
    },
    [orgId, invalidate]
  );

  /** Reconcile picker selection to exact set of space links for this document. */
  const setSpaceLinks = useCallback(
    async (
      attachmentId: string,
      selectedSpaceIds: readonly string[],
      currentSpaceIds: readonly string[]
    ): Promise<{ added: number; removed: number }> => {
      if (!orgId) throw new Error("No organisation");
      const { add, remove } = reconcileSpaceLinks(currentSpaceIds, selectedSpaceIds);

      if (remove.length > 0) {
        const { error } = await supabase
          .from("attachment_spaces")
          .delete()
          .eq("attachment_id", attachmentId)
          .eq("org_id", orgId)
          .in("space_id", [...remove]);
        if (error) throw error;
      }

      if (add.length > 0) {
        const { error } = await supabase.from("attachment_spaces").insert(
          add.map((space_id) => ({
            attachment_id: attachmentId,
            space_id,
            org_id: orgId,
          }))
        );
        if (error && error.code !== "23505") throw error;
      }

      if (add.length > 0 || remove.length > 0) invalidate();
      return { added: add.length, removed: remove.length };
    },
    [orgId, invalidate]
  );

  return { addSpaceLink, removeSpaceLink, setSpaceLinks, invalidate };
}
