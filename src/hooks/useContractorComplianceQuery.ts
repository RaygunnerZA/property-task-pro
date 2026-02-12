import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export interface ContractorComplianceItem {
  contractor_org_id: string;
  contractor_name: string;
  compliance_document_id: string;
  title: string;
  property_id: string | null;
  property_name: string | null;
  next_due_date: string | null;
  expiry_date: string | null;
  expiry_state: string;
  hazards?: string[] | null;
}

export function useContractorComplianceQuery() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["contractor_compliance", orgId],
    queryFn: async () => {
      const { data: ccLinks, error: ccError } = await supabase
        .from("compliance_contractors")
        .select("compliance_document_id, contractor_org_id")
        .eq("org_id", orgId);
      if (ccError) throw ccError;
      if (!ccLinks?.length) return [];

      const complianceIds = [...new Set(ccLinks.map((r) => r.compliance_document_id))];
      const contractorIds = [...new Set(ccLinks.map((r) => r.contractor_org_id))];

      const { data: portfolio, error: pError } = await supabase
        .from("compliance_portfolio_view")
        .select("id, title, property_id, property_name, next_due_date, expiry_date, expiry_state, hazards")
        .in("id", complianceIds)
        .eq("org_id", orgId);
      if (pError) throw pError;

      const { data: orgs, error: oError } = await supabase
        .from("organisations")
        .select("id, name")
        .in("id", contractorIds);
      if (oError) throw oError;

      const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.name || "Unknown"]));
      const portfolioMap = new Map((portfolio ?? []).map((p) => [p.id, p]));

      const items: ContractorComplianceItem[] = [];
      for (const link of ccLinks ?? []) {
        const doc = portfolioMap.get(link.compliance_document_id);
        if (doc) {
          items.push({
            contractor_org_id: link.contractor_org_id,
            contractor_name: orgMap.get(link.contractor_org_id) || "Unknown",
            compliance_document_id: link.compliance_document_id,
            title: doc.title || "Untitled",
            property_id: doc.property_id,
            property_name: doc.property_name,
            next_due_date: doc.next_due_date,
            expiry_date: doc.expiry_date,
            expiry_state: doc.expiry_state,
            hazards: (doc as { hazards?: string[] }).hazards ?? null,
          });
        }
      }
      return items;
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60000,
  });
}
