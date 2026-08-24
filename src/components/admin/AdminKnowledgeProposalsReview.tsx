import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ProposedKnowledgeCandidate } from "@/lib/knowledge/knowledgeDocumentIntake";
import {
  EMPTY_APPLICABILITY,
  type KnowledgeApplicability,
} from "@/types/knowledge";

function ApplicabilityMini({
  value,
  onChange,
}: {
  value: KnowledgeApplicability;
  onChange: (next: KnowledgeApplicability) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 text-xs">
      <label className="space-y-1 sm:col-span-2">
        <span className="text-muted-foreground">Jurisdictions</span>
        <Input
          className="h-8"
          value={value.jurisdictions.join(", ")}
          onChange={(e) =>
            onChange({
              ...value,
              jurisdictions: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="GB-ENG, IE"
        />
      </label>
      <label className="flex items-center gap-2 sm:col-span-2">
        <input
          type="checkbox"
          checked={Boolean(value.unscoped)}
          onChange={(e) => onChange({ ...value, unscoped: e.target.checked })}
        />
        <span className="text-muted-foreground">Unscoped (platform-global)</span>
      </label>
    </div>
  );
}

export function AdminKnowledgeProposalsReview({
  proposals,
  onChange,
  sourceLabel,
  busy,
  onImport,
}: {
  proposals: ProposedKnowledgeCandidate[];
  onChange: (next: ProposedKnowledgeCandidate[]) => void;
  sourceLabel: string;
  busy?: boolean;
  onImport: () => void;
}) {
  const selectedCount = proposals.filter((p) => p.selected).length;
  const readyCount = proposals.filter(
    (p) =>
      p.selected &&
      (p.applicability.jurisdictions.length > 0 || p.applicability.unscoped)
  ).length;

  const patch = (clientId: string, patch: Partial<ProposedKnowledgeCandidate>) => {
    onChange(proposals.map((p) => (p.clientId === clientId ? { ...p, ...patch } : p)));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Source: {sourceLabel} · {proposals.length} proposed candidate
        {proposals.length === 1 ? "" : "s"} from extraction (review before import)
      </p>
      <div className="space-y-3 max-h-[28rem] overflow-auto pr-1">
        {proposals.map((p) => (
          <div
            key={p.clientId}
            className={cn(
              "rounded-lg border border-border/40 p-3 space-y-2",
              !p.selected && "opacity-60"
            )}
          >
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={p.selected}
                onChange={(e) => patch(p.clientId, { selected: e.target.checked })}
              />
              Include in import
            </label>
            <Input
              className="text-sm"
              value={p.title}
              onChange={(e) => patch(p.clientId, { title: e.target.value })}
              placeholder="Title"
            />
            <Input
              className="text-sm"
              value={p.summary}
              onChange={(e) => patch(p.clientId, { summary: e.target.value })}
              placeholder="Summary"
            />
            <Textarea
              className="text-sm min-h-[4rem]"
              value={p.body}
              onChange={(e) => patch(p.clientId, { body: e.target.value })}
              placeholder="Body / guidance"
              rows={3}
            />
            {Object.keys(p.attributes).length > 0 && (
              <p className="text-[11px] text-muted-foreground truncate">
                attrs:{" "}
                {Object.entries(p.attributes)
                  .slice(0, 5)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(" · ")}
              </p>
            )}
            <ApplicabilityMini
              value={p.applicability}
              onChange={(applicability) => patch(p.clientId, { applicability })}
            />
          </div>
        ))}
      </div>
      <Button
        size="sm"
        className="shadow-primary-btn border-0"
        disabled={busy || readyCount === 0}
        onClick={onImport}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Add {readyCount} to review
      </Button>
      {selectedCount > readyCount && (
        <p className="text-xs text-[hsl(16_70%_40%)]">
          {selectedCount - readyCount} selected candidate(s) need jurisdiction or Unscoped.
        </p>
      )}
    </div>
  );
}

export function emptyApplicability(): KnowledgeApplicability {
  return { ...EMPTY_APPLICABILITY };
}
