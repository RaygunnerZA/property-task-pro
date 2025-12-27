import { useEffect, useState, useCallback } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import type { Tables } from "../integrations/supabase/types";

type ComplianceDocumentRow = Tables<"compliance_documents">;

export function useCompliance() {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [documents, setDocuments] = useState<ComplianceDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!orgId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await supabase
        .from("compliance_documents")
        .select("*")
        .eq("org_id", orgId)
        .order("expiry_date", { ascending: true, nullsFirst: false });

      if (err) {
        setError(err.message);
        setDocuments([]);
      } else {
        setDocuments(data ?? []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch compliance documents");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, orgId]);

  useEffect(() => {
    if (!orgLoading) {
      fetchDocuments();
    }
  }, [fetchDocuments, orgLoading]);

  return { documents, loading, error, refresh: fetchDocuments };
}

