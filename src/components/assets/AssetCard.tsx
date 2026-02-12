import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Wrench, ListTodo } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type AssetViewRow = Tables<"assets_view">;

interface AssetCardProps {
  asset: AssetViewRow;
  propertyName?: string;
  spaceName?: string;
  onClick?: () => void;
}

export function AssetCard({ asset, propertyName, spaceName, onClick }: AssetCardProps) {
  const conditionScore = asset.condition_score ?? 100;
  const assetName = asset.name || "Unnamed Asset";
  const propName = propertyName ?? asset.property_address ?? asset.property_name ?? "";
  const spName = spaceName ?? asset.space_name ?? "";
  const openTasksCount = asset.open_tasks_count ?? 0;

  const getConditionBadge = (score: number) => {
    if (score >= 80) return <Badge variant="success">Good</Badge>;
    if (score >= 60) return <Badge variant="warning">Fair</Badge>;
    return <Badge variant="danger">Poor</Badge>;
  };

  return (
    <Card
      className="rounded-[8px] shadow-e1 hover:shadow-e2 transition-all cursor-pointer active:scale-[0.99]"
      onClick={onClick}
    >
      <CardHeader>
        <CardTitle className="text-lg flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <span>{assetName}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {asset.status && asset.status !== "active" && (
              <Badge variant={asset.status === "retired" ? "neutral" : "warning"}>{asset.status}</Badge>
            )}
            {asset.compliance_required && <Badge variant="warning">Compliance</Badge>}
            {getConditionBadge(conditionScore)}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {asset.serial_number && (
            <Badge variant="neutral" size="sm">
              Serial: {asset.serial_number}
            </Badge>
          )}
          {propName && (
            <Badge variant="neutral" size="sm" className="flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              {propName}
            </Badge>
          )}
          {spName && (
            <Badge variant="neutral" size="sm">
              {spName}
            </Badge>
          )}
          {openTasksCount > 0 && (
            <Badge variant="neutral" size="sm" className="flex items-center gap-1">
              <ListTodo className="h-3 w-3" />
              {openTasksCount} open
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <Badge variant="neutral" size="sm">Condition Score</Badge>
              <Badge variant="neutral" size="sm">{conditionScore}/100</Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  conditionScore >= 80 ? "bg-green-500" : conditionScore >= 60 ? "bg-yellow-500" : "bg-red-500"
                }`}
                style={{ width: `${conditionScore}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

