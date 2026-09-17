import { Download, FolderInput, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RecordsExplorerBulkBarProps = {
  count: number;
  filingEnabled: boolean;
  onFileTo: () => void;
  onChangeCategory: () => void;
  onDownload: () => void;
  onClear: () => void;
  className?: string;
};

export function RecordsExplorerBulkBar({
  count,
  filingEnabled,
  onFileTo,
  onChangeCategory,
  onDownload,
  onClear,
  className,
}: RecordsExplorerBulkBarProps) {
  if (count <= 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-[10px] bg-card px-3 py-2 shadow-e1",
        "ring-1 ring-primary/30",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
        {count} selected
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {filingEnabled ? (
          <Button type="button" size="sm" variant="secondary" className="h-7 gap-1 text-xs" onClick={onFileTo}>
            <FolderInput className="h-3.5 w-3.5" />
            File to…
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 gap-1 text-xs"
          onClick={onChangeCategory}
        >
          <Tag className="h-3.5 w-3.5" />
          Change category
        </Button>
        <Button type="button" size="sm" variant="secondary" className="h-7 gap-1 text-xs" onClick={onDownload}>
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={onClear}>
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      </div>
    </div>
  );
}
