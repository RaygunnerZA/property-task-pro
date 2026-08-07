import { HardDrive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvidenceQuota } from "@/hooks/useEvidenceQuota";
import { EVIDENCE_STORAGE_PACK_BYTES, formatEvidenceBytes } from "@/lib/evidence/uploadLimits";
import { cn } from "@/lib/utils";

type PropertyLabel = { id: string; label: string };

type Props = {
  propertyLabels?: PropertyLabel[];
  onBuyStoragePack: () => void;
  busy?: boolean;
};

export function EvidenceUsageCard({
  propertyLabels = [],
  onBuyStoragePack,
  busy,
}: Props) {
  const {
    storageUsedBytes,
    allowance,
    warning,
    byProperty,
    usageRatio,
    formatBytes,
  } = useEvidenceQuota();

  const pct = Math.min(usageRatio * 100, 100);
  const labelById = new Map(propertyLabels.map((p) => [p.id, p.label]));

  return (
    <Card className="shadow-e1">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            <CardTitle>Evidence storage</CardTitle>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={onBuyStoragePack}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Add {formatEvidenceBytes(EVIDENCE_STORAGE_PACK_BYTES)} pack
          </Button>
        </div>
        <CardDescription>
          Organisation-pooled. Existing files stay readable when over allowance — only new
          uploads are limited. Large images are optimised after upload where supported.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Used</span>
            <span className="text-muted-foreground">
              {formatBytes(storageUsedBytes)} / {formatBytes(allowance)}
            </span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300",
                pct >= 100
                  ? "bg-destructive"
                  : pct >= 85
                    ? "bg-warning"
                    : "bg-primary"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          {warning && (
            <p
              className={cn(
                "text-xs",
                pct >= 100 ? "text-destructive" : "text-warning-foreground"
              )}
            >
              {warning}
            </p>
          )}
        </div>

        {byProperty.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Highest usage properties
            </p>
            <ul className="space-y-1.5">
              {byProperty.slice(0, 5).map((row) => (
                <li
                  key={row.property_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate text-foreground">
                    {labelById.get(row.property_id) ?? "Property"}
                  </span>
                  <span className="text-muted-foreground shrink-0 ml-3">
                    {formatEvidenceBytes(row.bytes)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
