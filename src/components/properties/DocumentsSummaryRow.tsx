/**
 * DocumentsSummaryRow - Framework V2 summary cards for Documents screen
 * Expiring Soon (Amber), Expired (Red), Missing (Slate)
 */
import { useNavigate } from "react-router-dom";
import { propertyHubPath, WORKBENCH_PANEL_TAB_QUERY, WORKBENCH_RECORDS_VIEW_QUERY } from "@/lib/propertyRoutes";
import { ContextSummaryCard } from "@/components/property-framework";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";

interface DocumentsSummaryRowProps {
  propertyId: string;
}

export function DocumentsSummaryRow({ propertyId }: DocumentsSummaryRowProps) {
  const navigate = useNavigate();
  const { orgId } = useActiveOrg();

  const { data: documents = [] } = useQuery({
    queryKey: ["property-documents-summary", propertyId, orgId],
    queryFn: async (): Promise<PropertyDocument[]> => {
      if (!orgId || !propertyId) return [];
      const { data, error } = await supabase
        .from("attachments")
        .select("id, expiry_date, file_url")
        .eq("org_id", orgId)
        .eq("parent_type", "property")
        .eq("parent_id", propertyId);
      if (error) throw error;
      return (data || []) as PropertyDocument[];
    },
    enabled: !!orgId && !!propertyId,
  });

  const today = new Date().toISOString().split("T")[0];
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const in30DaysStr = in30Days.toISOString().split("T")[0];

  const expired = documents.filter((d) => d.expiry_date && d.expiry_date < today).length;
  const expiringSoon = documents.filter(
    (d) =>
      d.expiry_date &&
      d.expiry_date >= today &&
      d.expiry_date <= in30DaysStr
  ).length;
  const missing = documents.filter((d) => !d.file_url).length;

  return (
    <div className="grid w-full grid-cols-3 gap-x-6 gap-y-5">
      <ContextSummaryCard
        title="Expiring Soon"
        count={expiringSoon}
        description="Due within 30 days"
        color="amber"
        ctaLabel="View"
        onClick={() =>
          navigate(
            propertyHubPath(propertyId, {
              [WORKBENCH_PANEL_TAB_QUERY]: "records",
              [WORKBENCH_RECORDS_VIEW_QUERY]: "expiring",
            })
          )
        }
      />
      <ContextSummaryCard
        title="Expired"
        count={expired}
        description="Past expiry date"
        color="red"
        ctaLabel="View"
        onClick={() =>
          navigate(
            propertyHubPath(propertyId, {
              [WORKBENCH_PANEL_TAB_QUERY]: "records",
              [WORKBENCH_RECORDS_VIEW_QUERY]: "overdue",
            })
          )
        }
      />
      <ContextSummaryCard
        title="Missing"
        count={missing}
        description="Not yet uploaded"
        color="slate"
        ctaLabel="View"
        onClick={() =>
          navigate(
            propertyHubPath(propertyId, {
              [WORKBENCH_PANEL_TAB_QUERY]: "records",
              [WORKBENCH_RECORDS_VIEW_QUERY]: "missing",
            })
          )
        }
      />
    </div>
  );
}
