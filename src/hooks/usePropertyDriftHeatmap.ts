import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export interface PropertyStatus {
  id: string;
  name: string;
  status: "compliant" | "pending" | "non_compliant";
  driftCount: number;
}

interface UsePropertyDriftHeatmapResult {
  data: PropertyStatus[];
  loading: boolean;
  error: Error | null;
}

export const usePropertyDriftHeatmap = (): UsePropertyDriftHeatmapResult => {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["property-drift-heatmap", orgId],
    queryFn: async () => {
      const { data: rows, error: qErr } = await supabase
        .from("compliance_portfolio_view")
        .select("property_id, property_name, expiry_state")
        .eq("org_id", orgId!);

      if (qErr) throw qErr;

      // Group by property_id and derive status
      const byProperty = new Map<
        string,
        { name: string; expired: number; expiring: number; total: number }
      >();

      for (const row of rows ?? []) {
        const pid = row.property_id ?? "unknown";
        const entry = byProperty.get(pid) ?? {
          name: row.property_name ?? "Unknown property",
          expired: 0,
          expiring: 0,
          total: 0,
        };
        entry.total += 1;
        if (row.expiry_state === "expired") entry.expired += 1;
        else if (row.expiry_state === "expiring") entry.expiring += 1;
        byProperty.set(pid, entry);
      }

      return Array.from(byProperty.entries()).map(([id, v]): PropertyStatus => {
        const status: PropertyStatus["status"] =
          v.expired > 0 ? "non_compliant" : v.expiring > 0 ? "pending" : "compliant";
        return { id, name: v.name, status, driftCount: v.expired + v.expiring };
      });
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60000,
  });

  return {
    data,
    loading: isLoading || orgLoading,
    error: error as Error | null,
  };
};
