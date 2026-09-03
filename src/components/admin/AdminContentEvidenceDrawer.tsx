import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { KnowledgeSourceRow } from "@/hooks/admin/useAdminKnowledge";
import type { KnowledgeStatus } from "@/types/knowledge";

function formatCheckedAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function retrievalLabel(
  source: KnowledgeSourceRow,
  globalUnavailable: boolean
): { label: string; tone: "ok" | "warn" | "muted" } {
  if (globalUnavailable) return { label: "Unavailable", tone: "warn" };
  const meta = source.metadata ?? {};
  const fromMeta = typeof meta.retrieval_status === "string" ? meta.retrieval_status : null;
  if (fromMeta === "unavailable" || fromMeta === "failed") {
    return { label: "Unavailable", tone: "warn" };
  }
  if (fromMeta === "ok" || fromMeta === "available") return { label: "Retrieved", tone: "ok" };
  if (source.url || source.attachment_id) return { label: "Linked", tone: "ok" };
  return { label: "Not checked", tone: "muted" };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: KnowledgeSourceRow[];
  knowledgeStatus: KnowledgeStatus;
  sourceUnavailable: boolean;
};

export function AdminContentEvidenceDrawer({
  open,
  onOpenChange,
  sources,
  knowledgeStatus,
  sourceUnavailable,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Evidence sources</SheetTitle>
          <SheetDescription>
            Provenance for this content topic — linked Knowledge sources and retrieval state.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sources linked to this Knowledge item.</p>
          ) : (
            sources.map((source) => {
              const title = source.label?.trim() || source.url || source.source_type;
              const retrieval = retrievalLabel(source, sourceUnavailable);
              const lastChecked =
                (typeof source.metadata?.last_checked_at === "string"
                  ? source.metadata.last_checked_at
                  : null) || source.created_at;
              return (
                <article
                  key={source.id}
                  className="rounded-xl bg-muted/30 shadow-sm p-3 space-y-2 text-sm"
                >
                  <p className="font-medium leading-snug">{title}</p>
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary break-all hover:underline"
                    >
                      {source.url}
                    </a>
                  ) : source.attachment_id ? (
                    <p className="text-xs text-muted-foreground">File attachment · {source.source_type}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{source.source_type}</p>
                  )}
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <dt className="text-muted-foreground font-mono uppercase tracking-wider">Retrieval</dt>
                    <dd
                      className={
                        retrieval.tone === "warn"
                          ? "text-[hsl(16_72%_40%)] font-medium"
                          : retrieval.tone === "ok"
                            ? "text-primary font-medium"
                            : "text-foreground"
                      }
                    >
                      {retrieval.label}
                    </dd>
                    <dt className="text-muted-foreground font-mono uppercase tracking-wider">Knowledge</dt>
                    <dd className="capitalize">{knowledgeStatus}</dd>
                    <dt className="text-muted-foreground font-mono uppercase tracking-wider">Last checked</dt>
                    <dd>{formatCheckedAt(lastChecked)}</dd>
                  </dl>
                </article>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
