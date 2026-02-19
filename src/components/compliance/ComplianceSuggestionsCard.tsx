/**
 * ComplianceSuggestionsCard
 *
 * Surfaces compliance gaps identified by the Property Intelligence Engine.
 * Always user-confirmed — never auto-seeds.
 *
 * Shown in: PropertyCompliance.tsx Schedule tab (above ComplianceScoreHeroCard)
 * Hidden when: no pending rules, feature disabled, or user dismisses.
 */

import { useState } from "react";
import { Brain, CheckCircle2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatFrequency } from "@/services/propertyIntelligence/frequencyUtils";
import {
  usePropertyIntelligenceSeed,
} from "@/hooks/usePropertyIntelligenceSeed";
import type { EvaluatedRule } from "@/services/propertyIntelligence/types";

interface ComplianceSuggestionsCardProps {
  propertyId: string;
}

export function ComplianceSuggestionsCard({
  propertyId,
}: ComplianceSuggestionsCardProps) {
  const { preview, isLoadingPreview, seed, isSeeding, seedError, isEnabled } =
    usePropertyIntelligenceSeed(propertyId);

  const [dismissed, setDismissed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);

  if (!isEnabled || isLoadingPreview || dismissed || confirmed) return null;
  if (!preview || preview.pendingRules.length === 0) return null;

  const { pendingRules } = preview;

  const toggleRule = (ruleId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === pendingRules.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRules.map((r) => r.ruleId)));
    }
  };

  const handleAddToSchedule = async () => {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
    await seed(ids);
    setConfirmed(true);
  };

  const allSelected = selectedIds.size === pendingRules.length;
  const noneSelected = selectedIds.size === 0;

  return (
    <div
      className={cn(
        "rounded-[8px] shadow-e1 p-4 bg-card border border-border/50",
        "space-y-4"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">
              Filla identified {pendingRules.length} compliance gap
              {pendingRules.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select items to add to your compliance schedule
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1"
          aria-label="Dismiss suggestions"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Rule list */}
      <div className="space-y-2 max-h-72 overflow-y-auto -mx-1 px-1">
        {pendingRules.map((rule: EvaluatedRule) => {
          if (rule.output.kind !== "suggest_compliance") return null;
          const { complianceType, frequency } = rule.output;
          const isChecked = selectedIds.has(rule.ruleId);

          return (
            <label
              key={rule.ruleId}
              className={cn(
                "flex items-start gap-3 p-3 rounded-[6px] cursor-pointer",
                "border transition-all duration-150",
                isChecked
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/40 bg-muted/20 hover:bg-muted/40"
              )}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => toggleRule(rule.ruleId)}
                className="mt-0.5 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">
                    {complianceType}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {formatFrequency(frequency)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {rule.rationale}
                </p>
              </div>
            </label>
          );
        })}
      </div>

      {/* Context warnings */}
      {preview.contextWarnings.length > 0 && (
        <div className="space-y-1">
          {preview.contextWarnings.map((w) => {
            if (w.output.kind !== "clarity_warning") return null;
            return (
              <p
                key={w.ruleId}
                className="text-xs text-amber-600 flex items-start gap-1.5"
              >
                <span className="shrink-0 mt-0.5">⚠</span>
                <span>{w.output.message}</span>
              </p>
            );
          })}
        </div>
      )}

      {seedError && (
        <p className="text-xs text-destructive">{seedError}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed(true)}
            disabled={isSeeding}
          >
            Not now
          </Button>
          <Button
            size="sm"
            onClick={handleAddToSchedule}
            disabled={isSeeding || noneSelected}
            className="gap-1.5"
          >
            {isSeeding ? (
              <>Adding…</>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Add to schedule
                {selectedIds.size > 0 && !allSelected && (
                  <span className="ml-0.5 text-primary-foreground/70">
                    ({selectedIds.size})
                  </span>
                )}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Post-confirm feedback (never shown since confirmed=true hides card, but guards edge re-renders) */}
      {confirmed && (
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          <span>Added to compliance schedule</span>
        </div>
      )}
    </div>
  );
}
