/**
 * useGraphInsight — Phase 13B FILLA Graph Insight Layer
 * Fetches graph-derived metrics: centrality, hazard exposure, compliance influence, task impact, risk paths.
 * Read-only. No writes.
 */
import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export interface GraphInsightResult {
  centrality: number;
  hazardExposure: number;
  complianceInfluence: number;
  taskImpact: number;
  riskPaths: string[][];
}

export interface GraphInsightOptions {
  start: { type: string; id: string } | null;
  depth?: number;
}

export function useGraphInsight(options: GraphInsightOptions) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const { start, depth = 3 } = options;

  const query = useQuery({
    queryKey: ["graph-insight", orgId, start?.type, start?.id, depth],
    queryFn: async (): Promise<GraphInsightResult> => {
      if (!orgId || !start?.type || !start?.id) {
        return {
          centrality: 0,
          hazardExposure: 0,
          complianceInfluence: 0,
          taskImpact: 0,
          riskPaths: [],
        };
      }

      const { data, error } = await supabase.functions.invoke("graph-insight", {
        body: {
          org_id: orgId,
          start,
          depth: Math.min(3, Math.max(1, depth ?? 3)),
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Graph insight failed");

      return {
        centrality: data.centrality ?? 0,
        hazardExposure: data.hazardExposure ?? 0,
        complianceInfluence: data.complianceInfluence ?? 0,
        taskImpact: data.taskImpact ?? 0,
        riskPaths: data.riskPaths ?? [],
      };
    },
    enabled: !!orgId && !!start?.type && !!start?.id && !orgLoading,
    staleTime: 60000,
  });

  return {
    centrality: query.data?.centrality ?? 0,
    hazardExposure: query.data?.hazardExposure ?? 0,
    complianceInfluence: query.data?.complianceInfluence ?? 0,
    taskImpact: query.data?.taskImpact ?? 0,
    riskPaths: query.data?.riskPaths ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
