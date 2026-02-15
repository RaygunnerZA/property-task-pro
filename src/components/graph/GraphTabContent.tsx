/**
 * GraphTabContent — Phase 13A
 * Reusable graph tab: fetches via useGraphQuery, renders via GraphVisualisation.
 * Optional sync button to trigger graph-sync (async, non-blocking).
 */
import { useState } from "react";
import { useGraphQuery } from "@/hooks/useGraphQuery";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { GraphVisualisation } from "./GraphVisualisation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface GraphTabContentProps {
  start: { type: string; id: string };
  depth?: number;
  className?: string;
}

export function GraphTabContent({ start, depth = 3, className }: GraphTabContentProps) {
  const { orgId } = useActiveOrg();
  const { data, isLoading, refetch } = useGraphQuery({ start, depth });
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    if (!orgId) {
      toast({ title: "Organisation not found", variant: "destructive" });
      return;
    }
    setSyncing(true);
    try {
        toast({ title: "Organisation not found", variant: "destructive" });
        return;
      }
      const { data: res, error } = await supabase.functions.invoke("graph-sync", {
        body: { org_id: orgId!, full_rebuild: true },
      });
      if (error) throw error;
      if (res?.ok) {
        toast({ title: "Graph synced", description: `${res.edges_synced ?? 0} edges updated` });
        refetch();
      } else {
        throw new Error(res?.error ?? "Sync failed");
      }
    } catch (err: unknown) {
      toast({
        title: "Graph sync failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-[300px] w-full rounded-lg" />;
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">Connected entities (depth {depth})</span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="btn-neomorphic"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
          {syncing ? "Syncing..." : "Sync graph"}
        </Button>
      </div>
      <GraphVisualisation
        nodes={data?.nodes ?? []}
        edges={data?.edges ?? []}
        startNodeId={start.id}
      />
    </div>
  );
}
