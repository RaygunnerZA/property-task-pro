import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type { PropertyDocument } from "./usePropertyDocuments";

export interface DocumentWithLinks extends PropertyDocument {
  linked_spaces: { id: string; name: string }[];
  linked_assets: { id: string; name: string }[];
  linked_contractors: { id: string; name: string }[];
  linked_compliance: { id: string; title: string }[];
}

export function useDocumentDetail(documentId: string | null) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();

  const { data: document, isLoading, error, refetch } = useQuery({
    queryKey: ["document-detail", documentId, orgId],
    queryFn: async (): Promise<DocumentWithLinks | null> => {
      if (!documentId || !orgId) return null;

      const { data: att, error: attError } = await supabase
        .from("attachments")
        .select("*")
        .eq("id", documentId)
        .eq("org_id", orgId)
        .single();

      if (attError || !att) return null;

      const attachment = att as PropertyDocument & Record<string, unknown>;

      const [spacesRes, assetsRes, contractorsRes, complianceRes] = await Promise.all([
        supabase.from("attachment_spaces").select("space_id").eq("attachment_id", documentId).eq("org_id", orgId),
        supabase.from("attachment_assets").select("asset_id").eq("attachment_id", documentId).eq("org_id", orgId),
        supabase.from("attachment_contractors").select("contractor_org_id").eq("attachment_id", documentId).eq("org_id", orgId),
        supabase.from("attachment_compliance").select("compliance_document_id").eq("attachment_id", documentId).eq("org_id", orgId),
      ]);

      const spaceIds = (spacesRes.data || []).map((r: { space_id: string }) => r.space_id).filter(Boolean);
      const assetIds = (assetsRes.data || []).map((r: { asset_id: string }) => r.asset_id).filter(Boolean);
      const contractorIds = (contractorsRes.data || []).map((r: { contractor_org_id: string }) => r.contractor_org_id).filter(Boolean);
      const complianceIds = (complianceRes.data || []).map((r: { compliance_document_id: string }) => r.compliance_document_id).filter(Boolean);

      const [spacesData, assetsData, contractorsData, complianceData] = await Promise.all([
        spaceIds.length ? supabase.from("spaces").select("id, name").in("id", spaceIds) : { data: [] },
        assetIds.length ? supabase.from("assets").select("id, name").in("id", assetIds) : { data: [] },
        contractorIds.length ? supabase.from("organisations").select("id, name").in("id", contractorIds) : { data: [] },
        complianceIds.length ? supabase.from("compliance_documents").select("id, title").in("id", complianceIds) : { data: [] },
      ]);

      const linkedSpaces = (spacesData.data || []) as { id: string; name: string }[];
      const linkedAssets = (assetsData.data || []) as { id: string; name: string }[];
      const linkedContractors = (contractorsData.data || []) as { id: string; name: string }[];
      const linkedCompliance = (complianceData.data || []) as { id: string; title: string }[];

      return {
        ...attachment,
        linked_spaces: linkedSpaces,
        linked_assets: linkedAssets,
        linked_contractors: linkedContractors,
        linked_compliance: linkedCompliance,
      } as DocumentWithLinks;
    },
    enabled: !!documentId && !!orgId,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<{
      title: string | null;
      category: string | null;
      document_type: string | null;
      expiry_date: string | null;
      renewal_frequency: string | null;
      notes: string | null;
    }>) => {
      if (!documentId || !orgId) return;
      const { error } = await supabase
        .from("attachments")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", documentId)
        .eq("org_id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["property-documents"] });
      queryClient.invalidateQueries({ queryKey: ["document-detail", documentId] });
    },
  });

  const updateLinks = useMutation({
    mutationFn: async (payload: {
      spaces?: string[];
      assets?: string[];
      contractors?: string[];
      compliance?: string[];
    }) => {
      if (!documentId || !orgId) return;

      if (payload.spaces !== undefined) {
        await supabase.from("attachment_spaces").delete().eq("attachment_id", documentId).eq("org_id", orgId);
        if (payload.spaces.length > 0) {
          await supabase.from("attachment_spaces").insert(
            payload.spaces.map((space_id) => ({ attachment_id: documentId, space_id, org_id: orgId }))
          );
        }
      }

      if (payload.assets !== undefined) {
        await supabase.from("attachment_assets").delete().eq("attachment_id", documentId).eq("org_id", orgId);
        if (payload.assets.length > 0) {
          await supabase.from("attachment_assets").insert(
            payload.assets.map((asset_id) => ({ attachment_id: documentId, asset_id, org_id: orgId }))
          );
        }
      }

      if (payload.contractors !== undefined) {
        await supabase.from("attachment_contractors").delete().eq("attachment_id", documentId).eq("org_id", orgId);
        if (payload.contractors.length > 0) {
          await supabase.from("attachment_contractors").insert(
            payload.contractors.map((contractor_org_id) => ({
              attachment_id: documentId,
              contractor_org_id,
              org_id: orgId,
            }))
          );
        }
      }

      if (payload.compliance !== undefined) {
        await supabase.from("attachment_compliance").delete().eq("attachment_id", documentId).eq("org_id", orgId);
        if (payload.compliance.length > 0) {
          await supabase.from("attachment_compliance").insert(
            payload.compliance.map((compliance_document_id) => ({
              attachment_id: documentId,
              compliance_document_id,
              org_id: orgId,
            }))
          );
        }
      }
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["property-documents"] });
      queryClient.invalidateQueries({ queryKey: ["document-detail", documentId] });
    },
  });

  return {
    document,
    isLoading,
    error,
    refresh: refetch,
    update: updateMutation.mutateAsync,
    updateLinks: updateLinks.mutateAsync,
    isUpdating: updateMutation.isPending || updateLinks.isPending,
  };
}
