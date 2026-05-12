/**
 * Property hub — compliance drift for one property (expired / expiring rows).
 * Same trusted source as `usePropertyDriftHeatmap` / `usePropertyCompliance`:
 * `compliance_portfolio_view` filtered by `org_id` + `property_id`.
 *
 * STATUS: Ready — not yet wired to UI.
 * Wire to the Drift tab in PropertyIdentityStrip (Tier 3 — t3-property-hub).
 * Note: `usePropertyDriftHeatmap` is a separate portfolio-level hook used in Compliance pages.
 */
import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export interface PropertyDrift {
  hasDrift: boolean;
  count: number;
  items: Array<{
    id: string;
    ruleTitle: string;
    severity: "low" | "medium" | "high";
  }>;
}

function severityForExpiryState(
  expiryState: string | null,
  status: string | null
): "low" | "medium" | "high" {
  const s = (expiryState ?? "").toLowerCase();
  if (s === "expired") return "high";
  if (s === "expiring") return "medium";
  const st = (status ?? "").toLowerCase();
  if (st.includes("invalid") || st.includes("overdue")) return "high";
  return "low";
}

export function usePropertyDrift(propertyId: string | undefined | null) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const query = useQuery({
    queryKey: ["property-drift", orgId, propertyId],
    queryFn: async (): Promise<PropertyDrift> => {
      if (!orgId || !propertyId) {
        return { hasDrift: false, count: 0, items: [] };
      }

      const { data: rows, error } = await supabase
        .from("compliance_portfolio_view")
        .select("id, title, expiry_state, status, document_type")
        .eq("org_id", orgId)
        .eq("property_id", propertyId);

      if (error) throw error;

      const driftRows = (rows ?? []).filter((r) => {
        const es = (r.expiry_state ?? "").toLowerCase();
        return es === "expired" || es === "expiring";
      });

      const items = driftRows.map((r, i) => ({
        id: String(r.id ?? `${propertyId}-drift-${i}`),
        ruleTitle: (r.title ?? r.document_type ?? "Compliance item").trim() || "Compliance item",
        severity: severityForExpiryState(r.expiry_state, r.status),
      }));

      return {
        hasDrift: items.length > 0,
        count: items.length,
        items,
      };
    },
    enabled: !!orgId && !!propertyId && !orgLoading,
    staleTime: 60_000,
  });

  return {
    drift: query.data ?? { hasDrift: false, count: 0, items: [] },
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
