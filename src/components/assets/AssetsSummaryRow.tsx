/**
 * AssetsSummaryRow - Framework V2 Health Snapshot for Assets screen
 * Active Assets (Teal), Needs Inspection (Amber), Non-Compliant (Red), Retired (Slate)
 */
import { useMemo } from "react";
import { ContextSummaryCard } from "@/components/property-framework";
import type { Tables } from "@/integrations/supabase/types";

type AssetViewRow = Tables<"assets_view">;

interface AssetsSummaryRowProps {
  assets: AssetViewRow[];
  onFilterClick?: (filter: "active" | "needsInspection" | "nonCompliant" | "retired") => void;
}

export function AssetsSummaryRow({ assets, onFilterClick }: AssetsSummaryRowProps) {
  const counts = useMemo(() => {
    const active = assets.filter((a) => (a.status || "active") === "active").length;
    const needsInspection = assets.filter(
      (a) => (a.condition_score ?? 100) < 60 && (a.status || "active") === "active"
    ).length;
    const nonCompliant = assets.filter(
      (a) => a.compliance_required && (a.condition_score ?? 100) < 60
    ).length;
    const retired = assets.filter((a) => a.status === "retired").length;
    return { active, needsInspection, nonCompliant, retired };
  }, [assets]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <ContextSummaryCard
        title="Active Assets"
        count={counts.active}
        description="In use"
        color="teal"
        ctaLabel="View"
        onClick={onFilterClick ? () => onFilterClick("active") : undefined}
      />
      <ContextSummaryCard
        title="Needs Inspection"
        count={counts.needsInspection}
        description="Condition &lt; 60%"
        color="amber"
        ctaLabel="View"
        onClick={onFilterClick ? () => onFilterClick("needsInspection") : undefined}
      />
      <ContextSummaryCard
        title="Non-Compliant"
        count={counts.nonCompliant}
        description="Requires attention"
        color="red"
        ctaLabel="View"
        onClick={onFilterClick ? () => onFilterClick("nonCompliant") : undefined}
      />
      <ContextSummaryCard
        title="Retired"
        count={counts.retired}
        description="Out of service"
        color="slate"
        ctaLabel="View"
        onClick={onFilterClick ? () => onFilterClick("retired") : undefined}
      />
    </div>
  );
}
