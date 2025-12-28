import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Wrench, TrendingDown } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type AssetRow = Tables<"assets">;

interface AssetCardProps {
  asset: AssetRow;
  propertyName?: string;
  spaceName?: string;
  onClick?: () => void;
}

export function AssetCard({ asset, propertyName, spaceName, onClick }: AssetCardProps) {
  const conditionScore = asset.condition_score ?? 100;
  const assetName = asset.serial || "Unnamed Asset";
  
  const getConditionColor = (score: number) => {
    if (score >= 80) return "bg-green-500/10 text-green-700 border-green-500/20";
    if (score >= 60) return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
    return "bg-red-500/10 text-red-700 border-red-500/20";
  };

  const getConditionBadge = (score: number) => {
    if (score >= 80) {
      return (
        <Badge variant="success">
          Good
        </Badge>
      );
    }
    if (score >= 60) {
      return (
        <Badge variant="warning">
          Fair
        </Badge>
      );
    }
    return (
      <Badge variant="danger">
        Poor
      </Badge>
    );
  };

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardHeader>
        <CardTitle className="text-lg flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <span>{assetName}</span>
          </div>
          {getConditionBadge(conditionScore)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {asset.serial && (
            <Badge variant="neutral" size="sm">
              Serial: {asset.serial}
            </Badge>
          )}
          {propertyName && (
            <Badge variant="neutral" size="sm" className="flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              {propertyName}
            </Badge>
          )}
          {spaceName && (
            <Badge variant="neutral" size="sm">
              {spaceName}
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
                  conditionScore >= 80
                    ? "bg-green-500"
                    : conditionScore >= 60
                    ? "bg-yellow-500"
                    : "bg-red-500"
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

