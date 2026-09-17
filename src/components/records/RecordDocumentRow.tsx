import { MoreHorizontal, Download, ExternalLink, FolderInput, Pencil, Trash2 } from "lucide-react";
import { SemanticChip } from "@/components/chips/semantic";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DraggableRecordShell } from "@/components/records/DraggableRecordShell";
import { recordDragId } from "@/components/onboarding/onboardingAreasDnd";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import { documentDisplayTitle } from "@/lib/records/attachmentSpaces";
import { cn } from "@/lib/utils";
import { formatDueText } from "@/components/records/complianceRecordModel";

type RecordDocumentRowProps = {
  document: PropertyDocument;
  filingEnabled?: boolean;
  onOpen?: () => void;
  onFileTo?: () => void;
  onEdit?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  onRemoveSpaceLink?: (spaceId: string, spaceName: string) => void;
  className?: string;
};

/** Legacy compact row — prefer RecordsExplorerDocumentRow in the explorer. */
export function RecordDocumentRow({
  document,
  filingEnabled = false,
  onOpen,
  onFileTo,
  onEdit,
  onDownload,
  onDelete,
  onRemoveSpaceLink,
  className,
}: RecordDocumentRowProps) {
  const title = documentDisplayTitle(document);
  const category =
    document.category?.trim() ||
    document.document_type?.trim() ||
    "Uncategorised";
  const linkedSpaces = document.linked_spaces ?? [];
  const spaceIds = linkedSpaces.map((s) => s.id);

  const body = ({
    dragHandleProps,
  }: {
    dragHandleProps: Record<string, unknown>;
    isDragging: boolean;
  }) => (
    <div
      className={cn(
        "group flex items-start gap-2 rounded-xl bg-card/80 px-3 py-2.5 shadow-e1",
        "transition-shadow hover:shadow-md",
        className
      )}
      {...dragHandleProps}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full text-left text-sm font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:text-primary"
          title={title}
        >
          <span className="line-clamp-2">{title}</span>
        </button>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
          <span>{category}</span>
          {document.expiry_date ? (
            <>
              <span aria-hidden>·</span>
              <span>Expires {formatDueText(document.expiry_date)}</span>
            </>
          ) : null}
        </div>
        {linkedSpaces.length > 0 ? (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {linkedSpaces.map((space) => (
              <SemanticChip
                key={space.id}
                epistemic="fact"
                size="compact"
                label={space.name}
                removable={Boolean(onRemoveSpaceLink)}
                onRemove={
                  onRemoveSpaceLink
                    ? () => onRemoveSpaceLink(space.id, space.name)
                    : undefined
                }
                className="!h-5 !px-1.5 !text-[10px] opacity-80"
                color="hsl(var(--muted))"
              />
            ))}
          </div>
        ) : (
          <p className="text-2xs font-mono uppercase tracking-wide text-muted-foreground/80">
            Property level
          </p>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`More actions for ${title}`}
            className={cn(
              "flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px]",
              "bg-background opacity-70 shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)]",
              "transition-all group-hover:opacity-100",
              "hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            )}
          >
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => onOpen?.()}>
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            Open
          </DropdownMenuItem>
          {filingEnabled ? (
            <DropdownMenuItem onSelect={() => onFileTo?.()}>
              <FolderInput className="mr-2 h-3.5 w-3.5" />
              File to…
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => onEdit?.()}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDownload?.()}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Download
          </DropdownMenuItem>
          {onDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onDelete()}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  if (!filingEnabled) return body({ dragHandleProps: {}, isDragging: false });

  return (
    <DraggableRecordShell
      id={recordDragId(document.id)}
      data={{
        kind: "record",
        recordId: document.id,
        recordName: title,
        spaceIds,
      }}
    >
      {body}
    </DraggableRecordShell>
  );
}
