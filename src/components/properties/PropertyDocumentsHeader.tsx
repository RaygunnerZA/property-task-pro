import { useProperty } from "@/hooks/property/useProperty";
import { Chip } from "@/components/chips/Chip";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface PropertyDocumentsHeaderProps {
  propertyId: string;
  onUpload: () => void;
  missingCount?: number;
  lastUpdated?: string | null;
  className?: string;
}

export function PropertyDocumentsHeader({
  propertyId,
  onUpload,
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
        <Button
          variant="default"
          size="sm"
          onClick={onUpload}
          className="shrink-0"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload
        </Button>
      </div>
      {missingCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-warning/10 border border-warning/20">
          <Chip role="status" label={`${missingCount} important documents missing`} color="hsl(var(--warning))" />
        </div>
      )}
    </div>
  );
}
