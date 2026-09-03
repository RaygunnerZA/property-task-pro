import { AlertTriangle } from "lucide-react";
import {
  getGroundingRemedies,
  type GroundingRemedyId,
  type SeoReadiness,
} from "@/lib/content/contentTopicWorkflow";

const COMPACT_ACTIONS: Partial<
  Record<GroundingRemedyId, { label: string; primary?: boolean }>
> = {
  retrieve_source: { label: "Retrieve source", primary: true },
  add_source: { label: "Replace source", primary: true },
  return_knowledge: { label: "View Knowledge", primary: true },
  research_evidence: { label: "Research missing evidence" },
};

type Props = {
  readiness: SeoReadiness;
  busy?: boolean;
  onRemedy: (id: GroundingRemedyId) => void;
};

export function AdminContentResolveGrounding({ readiness, busy, onRemedy }: Props) {
  if (readiness.canApprove || readiness.status === "approved" || readiness.status === "blocked") {
    return null;
  }

  const { headline, remedies } = getGroundingRemedies(readiness);
  const primaryRemedies = remedies.filter((r) => COMPACT_ACTIONS[r.id]?.primary && r.available);
  const secondaryRemedies = remedies.filter((r) => !COMPACT_ACTIONS[r.id]?.primary);

  return (
    <section className="rounded-lg bg-[hsl(16_82%_56%)]/10 px-3 py-2 space-y-1">
      <p className="text-sm font-semibold flex items-center gap-2 text-[hsl(16_72%_40%)]">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {readiness.status === "source_retrieval_required" ? "Source unavailable" : headline}
      </p>
      <p className="text-xs flex flex-wrap items-center gap-x-1 gap-y-0.5">
        {primaryRemedies.map((remedy, index) => (
          <span key={remedy.id} className="inline-flex items-center gap-1">
            {index > 0 ? <span className="text-muted-foreground">·</span> : null}
            <button
              type="button"
              disabled={busy}
              className="text-xs font-medium text-foreground hover:underline disabled:opacity-50"
              onClick={() => onRemedy(remedy.id)}
            >
              {COMPACT_ACTIONS[remedy.id]?.label ?? remedy.label}
            </button>
          </span>
        ))}
      </p>
      {secondaryRemedies.map((remedy) => (
        <p key={remedy.id} className="text-[10px] text-muted-foreground">
          {COMPACT_ACTIONS[remedy.id]?.label ?? remedy.label}
          {!remedy.available ? " — coming soon" : null}
        </p>
      ))}
    </section>
  );
}
