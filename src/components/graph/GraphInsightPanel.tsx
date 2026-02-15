/**
 * GraphInsightPanel — Phase 13B FILLA Graph Insight Layer
 * Displays graph-derived metrics: centrality, hazard exposure, compliance influence, task impact, risk paths.
 * Read-only. Uses useGraphInsight.
 */
import { useGraphInsight } from "@/hooks/useGraphInsight";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, Shield, Target, Zap, Route } from "lucide-react";

interface GraphInsightPanelProps {
  start: { type: string; id: string };
  depth?: number;
  variant?: "full" | "compact" | "minimal";
  className?: string;
}

export function GraphInsightPanel({ start, depth = 3, variant = "full", className }: GraphInsightPanelProps) {
  const {
    centrality,
    hazardExposure,
    complianceInfluence,
    taskImpact,
    riskPaths,
    loading,
  } = useGraphInsight({ start, depth });

  if (loading) {
    return <Skeleton className="h-[200px] w-full rounded-lg" />;
  }

  const hasInsights =
    centrality > 0 ||
    hazardExposure > 0 ||
    complianceInfluence > 0 ||
    taskImpact > 0 ||
    riskPaths.length > 0;

  if (!hasInsights && variant !== "full") {
    return null;
  }

  if (variant === "minimal") {
    return (
      <div className={cn("rounded-lg p-3 shadow-e1 bg-card", className)}>
        <p className="text-xs font-medium text-muted-foreground mb-2">Graph importance</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs">
            Impact: {taskImpact}
          </Badge>
          {hazardExposure > 0 && (
            <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-700">
              Exposure: {hazardExposure.toFixed(1)}
            </Badge>
          )}
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("rounded-lg p-4 shadow-e1 bg-card space-y-3", className)}>
        <p className="text-sm font-medium">Graph insights</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Centrality: {(centrality * 100).toFixed(0)}%</Badge>
          {hazardExposure > 0 && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-700">
              Hazard exposure: {hazardExposure.toFixed(1)}
            </Badge>
          )}
          {complianceInfluence > 0 && (
            <Badge variant="outline" className="border-teal-500/50 text-teal-700">
              Compliance: {complianceInfluence}
            </Badge>
          )}
          {taskImpact > 0 && (
            <Badge variant="outline">Impact: {taskImpact}</Badge>
          )}
        </div>
        {riskPaths.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Risk paths ({riskPaths.length})</p>
            <ul className="text-xs space-y-1 max-h-24 overflow-y-auto">
              {riskPaths.slice(0, 5).map((path, i) => (
                <li key={i} className="font-mono truncate">
                  {path.join(" → ")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg p-3 shadow-e1 bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">Centrality</p>
          </div>
          <p className="text-lg font-semibold">{(centrality * 100).toFixed(0)}%</p>
          <p className="text-[10px] text-muted-foreground">Operational importance</p>
        </div>
        <div className="rounded-lg p-3 shadow-e1 bg-card">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-xs font-medium text-muted-foreground">Hazard exposure</p>
          </div>
          <p className="text-lg font-semibold">{hazardExposure.toFixed(1)}</p>
          <p className="text-[10px] text-muted-foreground">Weighted by distance</p>
        </div>
        <div className="rounded-lg p-3 shadow-e1 bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-teal-600" />
            <p className="text-xs font-medium text-muted-foreground">Compliance influence</p>
          </div>
          <p className="text-lg font-semibold">{complianceInfluence}</p>
          <p className="text-[10px] text-muted-foreground">Connected items</p>
        </div>
        <div className="rounded-lg p-3 shadow-e1 bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">Task impact</p>
          </div>
          <p className="text-lg font-semibold">{taskImpact}</p>
          <p className="text-[10px] text-muted-foreground">Assets + compliance</p>
        </div>
      </div>

      {riskPaths.length > 0 && (
        <div className="rounded-lg p-4 shadow-e1 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Route className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Risk paths</p>
          </div>
          <ul className="text-xs space-y-2 max-h-32 overflow-y-auto font-mono">
            {riskPaths.slice(0, 10).map((path, i) => (
              <li key={i} className="truncate text-muted-foreground">
                {path.join(" → ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasInsights && (
        <p className="text-sm text-muted-foreground text-center py-6">
          No graph insights yet. Sync the graph to build connections.
        </p>
      )}
    </div>
  );
}
