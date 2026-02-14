import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export interface ComplianceRecommendation {
  id: string;
  org_id: string;
  compliance_document_id: string;
  property_id: string | null;
  asset_ids: string[];
  space_ids: string[];
  risk_level: "low" | "medium" | "high" | "critical";
  recommended_action: string;
  recommended_tasks: Array<{
    title?: string;
    description?: string;
    dueDate?: string;
    propertyId?: string;
    spaceIds?: string[];
    assetIds?: string[];
    category?: string;
  }>;
  hazards: string[];
  created_at: string;
  updated_at: string;
  status: "pending" | "accepted" | "dismissed";
}

export interface ComplianceActionRow {
  id: string;
  org_id: string;
  property_id: string | null;
  property_name: string | null;
  title: string | null;
  document_type: string | null;
  expiry_date: string | null;
  next_due_date: string | null;
  doc_hazards: string[] | null;
  linked_asset_ids: string[] | null;
  recommendation_id: string | null;
  risk_level: string | null;
  recommended_action: string | null;
  recommended_tasks: unknown;
  rec_hazards: string[] | null;
  recommendation_status: string | null;
  recommendation_created_at: string | null;
  days_until_expiry: number | null;
  expiry_state: string;
  space_links_count: number;
  asset_links_count: number;
}

export function useComplianceRecommendations(propertyId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["compliance_recommendations", orgId, propertyId],
    queryFn: async () => {
      let query = supabase
        .from("compliance_recommendations")
        .select("*")
        .eq("org_id", orgId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (propertyId) {
        query = query.or(`property_id.eq.${propertyId},property_id.is.null`);
      }

      const { data: recs, error } = await query;
      if (error) throw error;
      if (!recs?.length) return [];

      const complianceIds = [...new Set(recs.map((r) => r.compliance_document_id))];
      const { data: docs } = await supabase
        .from("compliance_portfolio_view")
        .select("id, title, property_name, expiry_date, next_due_date, space_ids, linked_asset_ids")
        .in("id", complianceIds)
        .eq("org_id", orgId);

      const docMap = new Map((docs ?? []).map((d) => [d.id, d]));

      return recs.map((r) => {
        const doc = docMap.get(r.compliance_document_id);
        return {
          ...r,
          asset_ids: r.asset_ids ?? [],
          space_ids: r.space_ids ?? [],
          hazards: r.hazards ?? [],
          recommended_tasks: (r.recommended_tasks as ComplianceRecommendation["recommended_tasks"]) ?? [],
          _doc: doc,
        };
      }) as (ComplianceRecommendation & { _doc?: { title?: string; property_name?: string; expiry_date?: string; next_due_date?: string; space_ids?: string[]; linked_asset_ids?: string[] } })[];
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60000,
  });
}

export function useComplianceActionsView(propertyId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["compliance_actions_view", orgId, propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_actions_view")
        .select("*")
        .eq("org_id", orgId)
        .not("recommendation_id", "is", null)
        .eq("recommendation_status", "pending");

      if (error) throw error;
      let rows = (data ?? []) as ComplianceActionRow[];

      if (propertyId) {
        rows = rows.filter((r) => r.property_id === propertyId);
      }

      return rows;
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60000,
  });
}

export function useComplianceRecommendationById(recommendationId: string | null) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["compliance_recommendation", orgId, recommendationId],
    queryFn: async () => {
      if (!recommendationId) return null;
      const { data, error } = await supabase
        .from("compliance_recommendations")
        .select("*")
        .eq("id", recommendationId)
        .eq("org_id", orgId)
        .single();

      if (error) throw error;
      return data as ComplianceRecommendation;
    },
    enabled: !!orgId && !!recommendationId && !orgLoading,
    staleTime: 30000,
  });
}

export function useContractorRecommendations() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["contractor_recommendations", orgId],
    queryFn: async () => {
      const { data: recs, error: recError } = await supabase
        .from("compliance_recommendations")
        .select("*")
        .eq("org_id", orgId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (recError) throw recError;
      if (!recs?.length) return [];

      const complianceIds = recs.map((r) => r.compliance_document_id);
      const { data: links, error: linkError } = await supabase
        .from("compliance_contractors")
        .select("compliance_document_id, contractor_org_id")
        .in("compliance_document_id", complianceIds)
        .eq("org_id", orgId);

      if (linkError) throw linkError;

      const contractorRecs = new Map<string, (typeof recs)[0][]>();
      for (const link of links ?? []) {
        const rec = recs.find((r) => r.compliance_document_id === link.compliance_document_id);
        if (rec) {
          const cid = link.contractor_org_id;
          if (!contractorRecs.has(cid)) contractorRecs.set(cid, []);
          contractorRecs.get(cid)!.push(rec);
        }
      }

      const complianceIdsFromRecs = [...new Set(recs.map((r) => r.compliance_document_id))];
      const { data: docs } = await supabase
        .from("compliance_portfolio_view")
        .select("id, title, property_name, expiry_date, next_due_date, space_ids, linked_asset_ids")
        .in("id", complianceIdsFromRecs)
        .eq("org_id", orgId);
      const docMap = new Map((docs ?? []).map((d) => [d.id, d]));

      return { contractorRecs, docMap, recs };
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60000,
  });
}

export function useUpdateRecommendationStatus() {
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "accepted" | "dismissed";
    }) => {
      const { error } = await supabase
        .from("compliance_recommendations")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("org_id", orgId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance_recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["compliance_actions_view"] });
    },
  });
}
