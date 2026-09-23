import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAdminAddKnowledgeSource,
  useAdminRemoveKnowledgeSourceUrl,
  useAdminReplaceKnowledgeSourceUrl,
  useAdminUpdateKnowledgeSource,
} from "@/hooks/admin/useAdminKnowledge";
import { isValidHttpUrl } from "@/lib/knowledge/knowledgePresentation";
import {
  sourceUrlRemoveTarget,
  sourceUrlSaveIntent,
} from "@/lib/knowledge/knowledgeSourceUrlEdit";
import { toast } from "sonner";

type EditableSource = {
  id?: string;
  title?: string | null;
  url?: string | null;
  label?: string | null;
};

type Props = {
  knowledgeId: string;
  sources: EditableSource[];
  /** Compact layout for Content Tree stage */
  compact?: boolean;
};

function sourceErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : "Couldn't save source URL";
  if (message.includes("invalid_source_url")) return "Enter a valid http(s) URL";
  if (message.includes("not_platform_admin")) return "Platform admin access required";
  if (message.includes("knowledge_source_not_found")) return "That source is no longer there";
  if (message.includes("source_not_url")) return "That source is a file, not a URL";
  return message;
}

export function KnowledgeSourceUrlEditor({ knowledgeId, sources, compact }: Props) {
  const addSource = useAdminAddKnowledgeSource();
  const updateSource = useAdminUpdateKnowledgeSource();
  const replaceSource = useAdminReplaceKnowledgeSourceUrl();
  const removeSource = useAdminRemoveKnowledgeSourceUrl();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [replacingUrl, setReplacingUrl] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [labelDraft, setLabelDraft] = useState("");

  const busy =
    addSource.isPending ||
    updateSource.isPending ||
    replaceSource.isPending ||
    removeSource.isPending;
  const withIds = sources.filter((s) => Boolean(s.id) && Boolean(s.url));
  const orphans = sources.filter((s) => !s.id && Boolean(s.url));

  const startEdit = (source: EditableSource) => {
    if (!source.id) {
      setEditingId("new");
      setReplacingUrl(source.url ?? null);
      setUrlDraft(source.url ?? "");
      setLabelDraft(source.label || source.title || "");
      return;
    }
    setEditingId(source.id);
    setReplacingUrl(source.url ?? null);
    setUrlDraft(source.url ?? "");
    setLabelDraft(source.label || source.title || "");
  };

  const startAdd = () => {
    setEditingId("new");
    setReplacingUrl(null);
    setUrlDraft("");
    setLabelDraft("");
  };

  const cancel = () => {
    setEditingId(null);
    setReplacingUrl(null);
    setUrlDraft("");
    setLabelDraft("");
  };

  const save = async () => {
    const url = urlDraft.trim();
    if (!isValidHttpUrl(url)) {
      toast.error("Enter a valid http(s) URL");
      return;
    }
    const intent = sourceUrlSaveIntent({ editingId, previousUrl: replacingUrl });
    try {
      if (intent.kind === "update") {
        await updateSource.mutateAsync({
          sourceId: intent.sourceId,
          knowledgeId,
          url,
          label: labelDraft.trim(),
        });
        toast.success("Source URL updated — re-run critic after extracting claims");
      } else if (intent.kind === "replace") {
        await replaceSource.mutateAsync({
          knowledgeId,
          url,
          previousUrl: intent.previousUrl,
          label: labelDraft.trim() || null,
        });
        toast.success("Source URL replaced — extract claims, then re-run critic");
      } else {
        await addSource.mutateAsync({
          knowledgeId,
          url,
          label: labelDraft.trim() || null,
        });
        toast.success("Source URL added — extract claims, then re-run critic");
      }
      cancel();
    } catch (err) {
      toast.error(sourceErrorMessage(err));
    }
  };

  const remove = async (source: EditableSource) => {
    const target = sourceUrlRemoveTarget(source);
    if (!target) return;
    if (!window.confirm("Remove this source URL?")) return;
    try {
      await removeSource.mutateAsync({
        knowledgeId,
        sourceId: target.sourceId,
        url: target.url,
      });
      toast.success("Source URL removed");
      if (editingId === source.id || replacingUrl === source.url) cancel();
    } catch (err) {
      toast.error(sourceErrorMessage(err));
    }
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {withIds.map((s) => (
        <div key={s.id} className="space-y-1.5 pb-2 last:pb-0 border-b border-border/20 last:border-0">
          {(s.title || s.label) && (
            <p className="text-sm font-medium text-foreground">{s.title || s.label}</p>
          )}
          {editingId === s.id ? (
            <SourceUrlForm
              url={urlDraft}
              label={labelDraft}
              busy={busy}
              onUrlChange={setUrlDraft}
              onLabelChange={setLabelDraft}
              onSave={() => void save()}
              onCancel={cancel}
              onRemove={() => void remove(s)}
            />
          ) : (
            <SourceUrlRow source={s} onEdit={() => startEdit(s)} onRemove={() => void remove(s)} />
          )}
        </div>
      ))}

      {orphans.map((s, i) => (
        <div key={`orphan-${i}`} className="space-y-1.5 pb-2 border-b border-border/20 last:border-0">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Provenance URL only — replace it to keep a single linked source.
          </p>
          {editingId === "new" && replacingUrl === (s.url ?? "") ? (
            <SourceUrlForm
              url={urlDraft}
              label={labelDraft}
              busy={busy}
              onUrlChange={setUrlDraft}
              onLabelChange={setLabelDraft}
              onSave={() => void save()}
              onCancel={cancel}
              onRemove={() => void remove(s)}
            />
          ) : (
            <SourceUrlRow
              source={s}
              replace
              onEdit={() => startEdit(s)}
              onRemove={() => void remove(s)}
            />
          )}
        </div>
      ))}

      {editingId === "new" && replacingUrl === null ? (
        <SourceUrlForm
          url={urlDraft}
          label={labelDraft}
          busy={busy}
          onUrlChange={setUrlDraft}
          onLabelChange={setLabelDraft}
          onSave={() => void save()}
          onCancel={cancel}
        />
      ) : editingId === null ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={startAdd}
        >
          <Plus className="h-3.5 w-3.5" />
          {sources.length === 0 ? "Add source URL" : "Add another source URL"}
        </Button>
      ) : null}
    </div>
  );
}

function SourceUrlRow({
  source,
  replace,
  onEdit,
  onRemove,
}: {
  source: EditableSource;
  replace?: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary truncate min-w-0 flex-1 hover:underline"
        >
          {source.url}
        </a>
      ) : (
        <span className="text-xs text-muted-foreground">No URL</span>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 shrink-0 gap-1"
        onClick={onEdit}
      >
        <Pencil className="h-3 w-3" />
        {replace ? "Replace URL" : "Edit URL"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 shrink-0 gap-1 text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="h-3 w-3" />
        Remove
      </Button>
    </div>
  );
}

function SourceUrlForm({
  url,
  label,
  busy,
  onUrlChange,
  onLabelChange,
  onSave,
  onCancel,
  onRemove,
}: {
  url: string;
  label: string;
  busy: boolean;
  onUrlChange: (v: string) => void;
  onLabelChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg bg-muted/20 p-2.5">
      <div className="space-y-1">
        <Label htmlFor="knowledge-source-url" className="text-xs">
          Source URL
        </Label>
        <Input
          id="knowledge-source-url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://www.gov.uk/…"
          disabled={busy}
          className="text-sm"
          autoFocus
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="knowledge-source-label" className="text-xs">
          Label (optional)
        </Label>
        <Input
          id="knowledge-source-label"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="e.g. Chimney fire safety"
          disabled={busy}
          className="text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={onSave}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
          Save URL
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        {onRemove ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            className="text-destructive"
            onClick={onRemove}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
