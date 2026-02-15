/**
 * Phase 11: Asset Intelligence Tab
 * Predicted failure window, global benchmark, recommended maintenance.
 */

import { Brain, AlertTriangle } from "lucide-react";
import { useBrainInference } from "@/hooks/useBrainInference";
import { useOrgSettings } from "@/hooks/useOrgSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface AssetIntelligenceTabProps {
  asset: { asset_type?: string; condition_score?: number; install_date?: string };
}

export function AssetIntelligenceTab({ asset }: AssetIntelligenceTabProps) {
  const { settings } = useOrgSettings();
  const automatedIntelligence = settings?.automated_intelligence ?? "suggestions_only";
  const assetVector = {
    asset_type: asset.asset_type,
    condition_score: asset.condition_score,
    install_date: asset.install_date,
  };

  const { data, isLoading, error } = useBrainInference(
    [assetVector],
    [],
    automatedIntelligence !== "off"
  );

  if (automatedIntelligence === "off") {
    return (
      <p className="text-sm text-muted-foreground">
        Enable Automated Intelligence in Settings → Automation & AI to see predictions.
      </p>
    );
  }

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (error || !data?.predictions) {
    return (
      <p className="text-sm text-muted-foreground">
        No predictions available yet. The Filla Brain learns from anonymised patterns across organisations.
      </p>
    );
  }

  const pred = data.predictions.assets[0];
  if (!pred) {
    return (
      <p className="text-sm text-muted-foreground">
        No matching patterns for this asset type. More data will improve predictions.
      </p>
    );
  }

  const riskScore = pred.risk_score ?? 0;
  const predictedDays = pred.predicted_failure_days ?? 365;
  const recommendedAction = pred.recommended_action ?? "Routine maintenance";
  const benchmarkPercentile = pred.benchmark_percentile ?? 50;
  const globalMttf = pred.global_mean_time_to_failure ?? 365;
  const globalFpRange = pred.global_failure_probability_range ?? "0.05 – 0.20";
  const assetTypeLabel = (asset.asset_type ?? "asset").replace(/_/g, " ");

  return (
    <div className="space-y-4">
      <Card className="shadow-e1">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Predictions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Risk score</span>
            <Badge
              variant={riskScore >= 70 ? "destructive" : riskScore >= 40 ? "secondary" : "outline"}
            >
              {riskScore}%
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Predicted failure window</span>
            <span className="text-sm font-medium">{predictedDays} days</span>
          </div>
          {benchmarkPercentile != null && (
            <div className="rounded-lg bg-primary/5 p-3 border border-primary/20">
              <p className="text-xs font-medium text-muted-foreground mb-1">Global benchmark</p>
              <p className="text-sm">
                Your {assetTypeLabel} risk is in the <strong>{benchmarkPercentile}th percentile</strong> compared to similar assets across Filla.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Global mean time to failure: {globalMttf} days · Failure probability range: {globalFpRange}
              </p>
            </div>
          )}
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Recommended action</p>
            <p className="text-sm">{recommendedAction}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            This asset type typically requires attention based on global anonymised patterns. No private data shared.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
