import { QuickActionsSection } from "./QuickActionsSection";
import { GraphInsightPanel } from "@/components/graph/GraphInsightPanel";

interface PropertyInsightsPanelProps {
  propertyId: string;
}

/**
 * Property Insights Panel
 * Shows quick actions for the property context.
 * Overview/Daily Briefing is shown in the right column to avoid duplication.
 */
export function PropertyInsightsPanel({ propertyId }: PropertyInsightsPanelProps) {
  return (
    <div className="space-y-4 p-[15px]">
      <div className="rounded-lg p-4 shadow-e1 bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Graph insights</h3>
        <GraphInsightPanel start={{ type: "property", id: propertyId }} depth={3} variant="full" />
      </div>
      <QuickActionsSection propertyId={propertyId} />
    </div>
  );
}

