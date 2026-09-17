import {
  MoreHorizontal,
  Download,
  ExternalLink,
  FolderInput,
  Pencil,
  Trash2,
  GripVertical,
  FileText,
  FileImage,
} from "lucide-react";
import { SemanticChip } from "@/components/chips/semantic";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { DraggableRecordShell } from "@/components/records/DraggableRecordShell";
import { recordDragId } from "@/components/onboarding/onboardingAreasDnd";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import { documentDisplayTitle } from "@/lib/records/attachmentSpaces";
import { documentExpiryState } from "@/lib/records/explorerFilters";
import { formatDueText } from "@/components/records/complianceRecordModel";
import { cn } from "@/lib/utils";

type RecordsExplorerDocumentRowProps = {
  document: PropertyDocument;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  filingEnabled?: boolean;
  onOpen?: () => void;
  onFileTo?: () => void;
  onEdit?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  onRemoveSpaceLink?: (spaceId: string, spaceName: string) => void;
  className?: string;
};

function FileTypeIcon({ fileType }: { fileType: string | null }) {
  if (fileType?.startsWith("image/")) {
    return <FileImage className="h-4 w-4 text-muted-foreground" aria-hidden />;
  }
  return <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />;
}

function expiryLabel(doc: PropertyDocument): string | null {
  const state = documentExpiryState(doc);
  if (!doc.expiry_date) return null;
  if (state === "overdue") return `Expired ${formatDueText(doc.expiry_date)}`;
  if (state === "expiring") return `Expires ${formatDueText(doc.expiry_date)}`;
  return `Expires ${formatDueText(doc.expiry_date)}`;
}

export function RecordsExplorerDocumentRow({
  document,
  selected = false,
  onSelectedChange,
  filingEnabled = false,
  onOpen,
  onFileTo,
  onEdit,
  onDownload,
  onDelete,
  onRemoveSpaceLink,
  className,
}: RecordsExplorerDocumentRowProps) {
  const title = documentDisplayTitle(document);
  const category =
    document.category?.trim() ||
    document.document_type?.trim() ||
    "Uncategorised";
  const linkedSpaces = document.linked_spaces ?? [];
  const spaceIds = linkedSpaces.map((s) => s.id);
  const expiry = expiryLabel(document);
  const expiryState = documentExpiryState(document);

  const body = ({
    dragHandleProps,
  }: {
    dragHandleProps: Record<string, unknown>;
    isDragging: boolean;
  }) => (
    <div
      className={cn(
        "group flex items-start gap-2 rounded-[10px] bg-card/90 px-2.5 py-2 shadow-e1",
        "transition-shadow hover:shadow-md",
        selected && "ring-1 ring-primary/45 bg-primary/5",
        className
      )}
    >
      {onSelectedChange ? (
        <div className="pt-1">
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => onSelectedChange(v === true)}
            aria-label={`Select ${title}`}
          />
        </div>
      ) : null}

      {filingEnabled ? (
        <button
          type="button"
          aria-label={`Drag ${title}`}
          className={cn(
            "mt-1 flex h-6 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/40",
            "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
            "hover:text-muted-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          )}
          {...dragHandleProps}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}

      <button
        type="button"
        onClick={onOpen}
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/40 shadow-e1"
        aria-label={`Open ${title}`}
      >
        {document.thumbnail_url ? (
          <img
            src={document.thumbnail_url}
            alt=""
            className="h-full w-full object-cover"
            decoding="async"
          />
        ) : (
          <FileTypeIcon fileType={document.file_type} />
        )}
      </button>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 text-left text-sm font-medium leading-snug text-foreground hover:text-primary focus-visible:outline-none focus-visible:text-primary"
            title={title}
          >
            <span className="line-clamp-2">{title}</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`More actions for ${title}`}
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]",
                  "bg-background/80 opacity-70 shadow-[2px_2px_4px_rgba(0,0,0,0.08)]",
                  "transition-all group-hover:opacity-100",
                  "hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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

        <p className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
          <span>{category}</span>
          {expiry ? (
            <>
              <span aria-hidden> · </span>
              <span
                className={cn(
                  expiryState === "overdue" && "text-destructive",
                  expiryState === "expiring" && "text-warning-foreground"
                )}
              >
                {expiry}
              </span>
            </>
          ) : null}
        </p>

        {linkedSpaces.length > 0 ? (
          <div className="flex flex-wrap gap-1">
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
                className="!h-5 !px-1.5 !text-[10px] opacity-75"
                color="hsl(var(--muted))"
              />
            ))}
          </div>
        ) : (
          <p className="font-mono text-2xs uppercase tracking-wide text-muted-foreground/70">
            Property level
          </p>
        )}
      </div>
    </div>
  );

  if (!filingEnabled) {
    return body({ dragHandleProps: {}, isDragging: false });
  }

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
