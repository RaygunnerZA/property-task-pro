import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export interface ComplianceCalendarEvent {
  id: string;
  title: string;
  property_id: string | null;
  property_name: string | null;
  next_due_date: string;
  expiry_state: string;
  document_type: string | null;
  hazards?: string[] | null;
  ai_confidence?: number | null;
}

export interface ComplianceCalendarFilters {
  propertyId?: string;
  contractorOrgId?: string;
  expiryState?: string;
  category?: string;
  hazard?: string;
  spaceId?: string;
  aiConfidenceMin?: number;
}

export function useComplianceCalendarQuery(
  from: Date,
  to: Date,
  filters?: ComplianceCalendarFilters
) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["compliance_calendar", orgId, from.toISOString(), to.toISOString(), filters],
    queryFn: async () => {
      let query = supabase
        .from("compliance_portfolio_view")
        .select("id, title, property_id, property_name, next_due_date, expiry_state, document_type, hazards, ai_confidence")
        .eq("org_id", orgId)
        .not("next_due_date", "is", null)
        .gte("next_due_date", from.toISOString().slice(0, 10))
        .lte("next_due_date", to.toISOString().slice(0, 10))
        .order("next_due_date", { ascending: true });

      if (filters?.propertyId) {
        query = query.eq("property_id", filters.propertyId);
      }
      if (filters?.expiryState) {
        query = query.eq("expiry_state", filters.expiryState);
      }
      if (filters?.category) {
        query = query.eq("document_type", filters.category);
      }

      const { data, error } = await query;
      if (error) throw error;
      let events = (data ?? []) as ComplianceCalendarEvent[];

      if (filters?.contractorOrgId) {
        const { data: ccLinks } = await supabase
          .from("compliance_contractors")
          .select("compliance_document_id")
          .eq("contractor_org_id", filters.contractorOrgId)
          .eq("org_id", orgId);
        const ids = new Set((ccLinks ?? []).map((r) => r.compliance_document_id));
        events = events.filter((e) => ids.has(e.id));
      }
      if (filters?.hazard) {
        events = events.filter(
          (e) => Array.isArray(e.hazards) && e.hazards.includes(filters!.hazard!)
        );
      }
      if (filters?.spaceId) {
        const { data: csLinks } = await supabase
          .from("compliance_spaces")
          .select("compliance_document_id")
          .eq("space_id", filters.spaceId)
          .eq("org_id", orgId);
        const ids = new Set((csLinks ?? []).map((r) => r.compliance_document_id));
        events = events.filter((e) => ids.has(e.id));
      }
      if (filters?.aiConfidenceMin != null) {
        events = events.filter((e) => (e.ai_confidence ?? 0) >= filters!.aiConfidenceMin!);
      }
      return events;
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60000,
  });
}
