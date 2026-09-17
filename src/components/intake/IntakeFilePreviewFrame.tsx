import { ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IntakePreviewKind } from "@/lib/intakeFileKind";

interface IntakeFilePreviewFrameProps {
  kind: IntakePreviewKind;
  thumbnailUrl: string | null;
  openUrl: string | null;
  title: string;
  loading?: boolean;
  className?: string;
}

export function IntakeFilePreviewFrame({
  kind,
  thumbnailUrl,
  openUrl,
  title,
  loading = false,
  className,
}: IntakeFilePreviewFrameProps) {
  if (loading) {
    return (
      <div
        className={cn(
          "flex h-[min(32vh,280px)] w-full items-center justify-center rounded-xl bg-muted/35 shadow-engraved",
          className
        )}
      >
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
        <span className="sr-only">Loading preview</span>
      </div>
    );
  }

  if (thumbnailUrl) {
    const image = (
      <img
        src={thumbnailUrl}
        alt={`Preview of ${title}`}
        className="max-h-[min(32vh,280px)] w-full object-contain"
      />
    );

    if (openUrl) {
      return (
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "block overflow-hidden rounded-xl bg-muted/35 shadow-engraved focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className
          )}
        >
          {image}
        </a>
      );
    }

    return (
      <div className={cn("overflow-hidden rounded-xl bg-muted/35 shadow-engraved", className)}>
        {image}
      </div>
    );
  }

  if (kind === "pdf" && openUrl) {
    return (
      <iframe
        src={`${openUrl}#toolbar=0&navpanes=0`}
        title={title}
        className={cn("h-[min(32vh,280px)] w-full rounded-xl bg-muted/35 shadow-engraved", className)}
      />
    );
  }

  if (openUrl) {
    return (
      <a
        href={openUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl bg-muted/35 px-3 py-6 text-sm font-medium text-foreground shadow-engraved hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      >
        <ExternalLink className="h-4 w-4" />
        Open file
      </a>
    );
  }

  return null;
}
