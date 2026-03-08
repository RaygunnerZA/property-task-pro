/**
 * Phase 11: Property Intelligence Panel
 * Risk score, failure prediction, compliance drift, hazard amplifications.
 * Uses Filla Brain inference — only anonymised vectors sent.
 *
 * Sprint 2 update: Accepts optional intelligenceResult prop.
 * When present, appends compliance gap count and listed building warning rows.
 */

import { Brain, AlertTriangle, TrendingDown, HelpCircle, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBrainInference } from "@/hooks/useBrainInference";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOrgSettings } from "@/hooks/useOrgSettings";
import type { IntelligenceResult } from "@/services/propertyIntelligence/types";

interface PropertyIntelligencePanelProps {
  assetVectors: Array<{ asset_type?: string; condition_score?: number; install_date?: string }>;
  complianceVectors: Array<{ document_type?: string }>;
  /**
   * When provided, appends local intelligence rows:
   *   - Compliance gap count (N types not yet scheduled)
   *   - Listed building warnings
   */
  intelligenceResult?: IntelligenceResult;
  /** Callback for the compliance gap link — navigate to Schedule tab */
  onViewComplianceGaps?: () => void;
}

export function PropertyIntelligencePanel({
  assetVectors,
  complianceVectors,
  intelligenceResult,
  onViewComplianceGaps,
}: PropertyIntelligencePanelProps) {
  const { settings } = useOrgSettings();
  const automatedIntelligence = settings?.automated_intelligence ?? "suggestions_only";

  // Call all hooks unconditionally to avoid "Rendered fewer hooks than expected"
  const { data, isLoading, error } = useBrainInference(
    assetVectors,
    complianceVectors,
    automatedIntelligence !== "off"
  );

  const complianceGapCount = intelligenceResult?.complianceRecommendations.length ?? 0;
  const warnings = intelligenceResult?.warnings ?? [];

  // Early outs only after all hooks have run
  if (automatedIntelligence === "off") return null;

  // If both Brain inference failed and there are no local intelligence rows, hide the panel
  const hasBrainData = !isLoading && !error && !!data?.predictions;
  const hasLocalIntelligence = complianceGapCount > 0 || warnings.length > 0;
  if (!isLoading && !hasBrainData && !hasLocalIntelligence) return null;

  if (isLoading) {
    return (
      <Card className="shadow-e1">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading predictions...</p>
        </CardContent>
      </Card>
    );
  }

  const assetPreds = data?.predictions?.assets ?? [];
  const compPreds = data?.predictions?.compliance ?? [];
  const maxAssetRisk = assetPreds.length > 0 ? Math.max(...assetPreds.map((a) => a.risk_score ?? 0)) : 0;
  const maxCompRisk = compPreds.filter((c) => c.risk_level === "critical" || c.risk_level === "high").length;

  return (
    <TooltipProvider>
      <Card className="shadow-e1">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasBrainData && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Risk score</span>
                <div className="flex items-center gap-1">
                  <Badge variant={maxAssetRisk >= 70 ? "destructive" : maxAssetRisk >= 40 ? "secondary" : "outline"}>
                    {maxAssetRisk}%
                  </Badge>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Why this prediction?</p>
                      <p className="text-xs mt-1">Based on global asset patterns. No private data shared.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              {assetPreds.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Failure prediction</p>
                  {assetPreds.slice(0, 3).map((p, i) => (
                    <div key={i} className="text-sm flex justify-between items-center gap-2">
                      <span className="capitalize">
                        {assetVectors[i]?.asset_type ?? "Asset type"}
                      </span>
                      <span className="flex items-center gap-2">
                        {p.predicted_failure_days ?? 365} days
                        {p.benchmark_percentile != null && (
                          <span className="text-xs text-muted-foreground">({p.benchmark_percentile}th %ile)</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {maxCompRisk > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm">High-risk compliance profile detected</span>
                </div>
              )}
              {compPreds.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <TrendingDown className="h-3.5 w-3.5" />
                    Suggested frequency
                  </p>
                  {compPreds.slice(0, 3).map((p, i) => (
                    <div key={i} className="text-sm flex justify-between">
                      <span className="capitalize">{p.document_type?.replace(/_/g, " ")}</span>
                      <span>{p.recommended_frequency ?? "annual"}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Local intelligence rows (Sprint 2) */}
          {complianceGapCount > 0 && (
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-foreground">
                  {complianceGapCount} compliance type{complianceGapCount !== 1 ? "s" : ""} not yet scheduled
                </span>
              </div>
              {onViewComplianceGaps && (
                <button
                  type="button"
                  onClick={onViewComplianceGaps}
                  className="text-xs text-primary underline underline-offset-2 shrink-0"
                >
                  Review
                </button>
              )}
            </div>
          )}

          {warnings.map((w) => {
            if (w.output.kind !== "clarity_warning") return null;
            return (
              <div
                key={w.ruleId}
                className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20"
              >
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="text-sm text-amber-800 dark:text-amber-400">
                  {w.output.message}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
