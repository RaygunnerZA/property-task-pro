import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { isMissingColumnError, isMissingRelationError } from "@/lib/supabaseErrors";

interface UseComplianceQueryOptions {
  enabled?: boolean;
}

type ComplianceScheduleRow = {
  id: string | null;
  org_id: string | null;
  property_id: string | null;
  title: string | null;
  certificate_name: string | null;
  document_type: string | null;
  next_due_date: string | null;
  expiry_date: string | null;
  last_completed_date: string | null;
  frequency: string | null;
  status: string | null;
  expiry_status: string | null;
  days_until_expiry: number | null;
  task_id: string | null;
  rule_id: string | null;
  source_type: string | null;
  file_url: string | null;
};

function mapDocumentToScheduleRow(doc: {
  id: string;
  org_id: string;
  property_id: string | null;
  title: string | null;
  document_type: string | null;
  next_due_date: string | null;
  expiry_date: string | null;
  frequency: string | null;
  status: string | null;
  file_url: string | null;
  rule_id: string | null;
}): ComplianceScheduleRow {
  const due = doc.expiry_date ?? doc.next_due_date;
  let expiry_status: string | null = "valid";
  let days_until_expiry: number | null = null;

  if (due) {
    const dueDate = new Date(due);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    days_until_expiry = Math.round(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days_until_expiry < 0) expiry_status = "expired";
    else if (days_until_expiry <= 30) expiry_status = "expiring";
  }

  return {
    id: doc.id,
    org_id: doc.org_id,
    property_id: doc.property_id,
    title: doc.title,
    certificate_name: doc.title,
    document_type: doc.document_type,
    next_due_date: doc.next_due_date,
    expiry_date: doc.expiry_date,
    last_completed_date: null,
    frequency: doc.frequency,
    status: doc.status,
    expiry_status,
    days_until_expiry,
    task_id: null,
    rule_id: doc.rule_id,
    source_type: "document",
    file_url: doc.file_url,
  };
}

async function fetchComplianceDocumentsFallback(
  orgId: string,
  propertyId?: string
): Promise<ComplianceScheduleRow[]> {
  let query = supabase
    .from("compliance_documents")
    .select(
      "id, org_id, property_id, title, document_type, next_due_date, expiry_date, frequency, status, file_url, rule_id"
    )
    .eq("org_id", orgId);

  if (propertyId) {
    query = query.eq("property_id", propertyId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapDocumentToScheduleRow);
}

/**
 * useComplianceQuery
 *
 * Reads from compliance_schedule_view which unifies:
 *   - Rule-based pending occurrences (source_type = 'rule')
 *   - Standalone compliance documents (source_type = 'document')
 */
export function useComplianceQuery(propertyId?: string, options?: UseComplianceQueryOptions) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryEnabled = options?.enabled ?? true;

  return useQuery({
    queryKey: ["compliance", orgId, propertyId],
    queryFn: async () => {
      let query = supabase
        .from("compliance_schedule_view")
        .select("*")
        .eq("org_id", orgId!)
        .order("days_until_expiry", { ascending: true, nullsFirst: false });

      if (propertyId) {
        query = query.eq("property_id", propertyId);
      }

      const { data, error } = await query;
      if (!error) return data ?? [];

      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        return fetchComplianceDocumentsFallback(orgId!, propertyId);
      }

      throw error;
    },
    enabled: queryEnabled && !!orgId && !orgLoading,
    staleTime: 60000,
  });
}
