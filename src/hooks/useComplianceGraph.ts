import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export interface ComplianceGraphNode {
  id: string;
  type: "property" | "space" | "asset" | "compliance" | "contractor" | "document";
  label: string;
}

export interface ComplianceGraphEdge {
  from: string;
  to: string;
}

export interface ComplianceGraph {
  nodes: ComplianceGraphNode[];
  edges: ComplianceGraphEdge[];
}

export function useComplianceGraph(complianceDocumentId: string | undefined) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["compliance_graph", orgId, complianceDocumentId],
    queryFn: async (): Promise<ComplianceGraph> => {
      if (!complianceDocumentId) return { nodes: [], edges: [] };

      const nodes: ComplianceGraphNode[] = [];
      const edges: ComplianceGraphEdge[] = [];

      const { data: doc, error: docError } = await supabase
        .from("compliance_portfolio_view")
        .select("id, title, property_id, property_name, linked_asset_ids, hazards")
        .eq("id", complianceDocumentId)
        .eq("org_id", orgId)
        .single();
      if (docError || !doc) return { nodes: [], edges: [] };

      const complianceId = doc.id;
      nodes.push({
        id: complianceId,
        type: "compliance",
        label: doc.title || "Compliance",
      });

      if (doc.property_id) {
        nodes.push({
          id: doc.property_id,
          type: "property",
          label: doc.property_name || "Property",
        });
        edges.push({ from: doc.property_id, to: complianceId });
      }

      const { data: spaceLinks } = await supabase
        .from("compliance_spaces")
        .select("space_id")
        .eq("compliance_document_id", complianceDocumentId)
        .eq("org_id", orgId);
      if (spaceLinks?.length) {
        const spaceIds = [...new Set(spaceLinks.map((r) => r.space_id))];
        const { data: spaces } = await supabase
          .from("spaces")
          .select("id, name")
          .in("id", spaceIds);
        for (const s of spaces ?? []) {
          nodes.push({ id: s.id, type: "space", label: s.name || "Space" });
          edges.push({ from: s.id, to: complianceId });
        }
      }

      const assetIds = (doc.linked_asset_ids as string[]) || [];
      if (assetIds.length > 0) {
        const { data: assets } = await supabase
          .from("assets")
          .select("id, name")
          .in("id", assetIds);
        for (const a of assets ?? []) {
          nodes.push({ id: a.id, type: "asset", label: a.name || "Asset" });
          edges.push({ from: a.id, to: complianceId });
        }
      }

      const { data: contractorLinks } = await supabase
        .from("compliance_contractors")
        .select("contractor_org_id")
        .eq("compliance_document_id", complianceDocumentId)
        .eq("org_id", orgId);
      if (contractorLinks?.length) {
        const contractorIds = [...new Set(contractorLinks.map((r) => r.contractor_org_id))];
        const { data: orgs } = await supabase
          .from("organisations")
          .select("id, name")
          .in("id", contractorIds);
        for (const o of orgs ?? []) {
          nodes.push({ id: o.id, type: "contractor", label: o.name || "Contractor" });
          edges.push({ from: o.id, to: complianceId });
        }
      }

      return { nodes, edges };
    },
    enabled: !!orgId && !!complianceDocumentId && !orgLoading,
    staleTime: 60000,
  });
}
