import { useProperty } from "@/hooks/property/useProperty";
import { SemanticChip } from "@/components/chips/semantic";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface PropertyDocumentsHeaderProps {
  propertyId: string;
  onUpload: () => void;
  onReanalyse?: () => void;
  reanalyseLoading?: boolean;
  missingCount?: number;
  lastUpdated?: string | null;
  className?: string;
}

export function PropertyDocumentsHeader({
  propertyId,
  onUpload,
  onReanalyse,
  reanalyseLoading,
  missingCount = 0,
  lastUpdated,
  className,
}: PropertyDocumentsHeaderProps) {
  const { property } = useProperty(propertyId);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {property?.name || "Property Documents"}
          </h2>
          {lastUpdated && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Last updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {onReanalyse && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReanalyse}
              disabled={reanalyseLoading}
            >
              {reanalyseLoading ? "Re-running…" : "Re-run AI"}
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={onUpload}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>
      {missingCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-warning/10 border border-warning/20">
          <SemanticChip epistemic="fact" label={`${missingCount} important documents missing`} color="hsl(var(--warning))" />
        </div>
      )}
    </div>
  );
}
