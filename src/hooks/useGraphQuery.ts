/**
 * useGraphQuery — Phase 13A FILLA Graph Backbone
 * React Query wrapper around graph-query edge function.
 * Returns connected subgraph from start node with optional filters.
 */
import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export interface GraphNode {
  id: string;
  type: string;
  name?: string;
  expiry_state?: string;
  [k: string]: unknown;
}

export interface GraphEdge {
  from: string;
  to: string;
  relationship: string;
  weight?: number;
}

export interface GraphQueryResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphQueryOptions {
  start: { type: string; id: string };
  depth?: number;
  filters?: { hazards?: string[]; expiry_state?: string[] };
}

export function useGraphQuery(options: GraphQueryOptions | null) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["graph-query", orgId, options?.start?.type, options?.start?.id, options?.depth, options?.filters],
    queryFn: async (): Promise<GraphQueryResult> => {
      if (!orgId || !options?.start?.type || !options?.start?.id) {
        return { nodes: [], edges: [] };
      }

      const { data, error } = await supabase.functions.invoke("graph-query", {
        body: {
          org_id: orgId,
          start: options.start,
          depth: options.depth ?? 3,
          filters: options.filters ?? {},
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Graph query failed");

      return {
        nodes: data.nodes ?? [],
        edges: data.edges ?? [],
      };
    },
    enabled: !!orgId && !!options?.start?.type && !!options?.start?.id && !orgLoading,
    staleTime: 60000,
  });
}
