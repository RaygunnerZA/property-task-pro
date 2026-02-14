/**
 * Phase 11: Property Intelligence Panel
 * Risk score, failure prediction, compliance drift, hazard amplifications.
 * Uses Filla Brain inference — only anonymised vectors sent.
 */

import { Brain, AlertTriangle, TrendingDown, HelpCircle } from "lucide-react";
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

interface PropertyIntelligencePanelProps {
  assetVectors: Array<{ asset_type?: string; condition_score?: number; install_date?: string }>;
  complianceVectors: Array<{ document_type?: string }>;
}

export function PropertyIntelligencePanel({
  assetVectors,
  complianceVectors,
}: PropertyIntelligencePanelProps) {
  const { settings } = useOrgSettings();
  const automatedIntelligence = settings?.automated_intelligence ?? "suggestions_only";
  if (automatedIntelligence === "off") return null;

  const { data, isLoading, error } = useBrainInference(
    assetVectors,
    complianceVectors,
    automatedIntelligence !== "off"
  );

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

  if (error || !data?.predictions) {
    return null;
  }

  const { assets: assetPreds, compliance: compPreds } = data.predictions;
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
                <div key={i} className="text-sm flex justify-between">
                  <span>Asset type pattern</span>
                  <span>{p.predicted_failure_days ?? 365} days</span>
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
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
