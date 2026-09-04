import { toast } from "sonner";
import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { KnowledgeClaimsList } from "@/components/admin/KnowledgeClaimsList";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { KnowledgeRow } from "@/types/knowledge";
import type { KnowledgeSourceRow } from "@/hooks/admin/useAdminKnowledge";
import {
  attrString,
  statusLabel,
  type TrustCheck,
  type TrustCheckStatus,
} from "@/lib/knowledge/knowledgePresentation";
import {
  displayCanonicalGuidance,
  hasCanonicalGuidance,
  isReadyForHumanVerify,
  type PrimaryActionKind,
} from "@/lib/knowledge/knowledgeReviewState";
import { deriveOpportunities } from "@/lib/knowledge/knowledgePresentation";

function checkTone(status: TrustCheckStatus): string {
  switch (status) {
    case "passed":
      return "text-emerald-700 dark:text-emerald-400";
    case "failed":
      return "text-destructive";
    case "required":
    case "not_run":
      return "text-amber-700 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

function StatusIcon({ status }: { status: TrustCheckStatus }) {
  if (status === "passed") {
    return <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />;
  }
  return <X className="h-3.5 w-3.5 shrink-0 text-destructive/80" aria-hidden />;
}

function MicroDetail({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/70"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-mono uppercase tracking-wide text-[9px] opacity-70">{label}</span>
        <span className="truncate text-foreground/80">{value}</span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 min-w-[14rem] max-w-sm rounded-lg bg-card p-2 text-xs shadow-md">
          {children ?? <p className="text-muted-foreground">{value}</p>}
        </div>
      )}
    </div>
  );
}

export type ExpandedReviewModel = {
  row: KnowledgeRow;
  sources: KnowledgeSourceRow[];
  checks: TrustCheck[];
  blockers: TrustCheck[];
  jurisdiction: string;
  classification: string;
  trigger: string;
  qualityLabel: string;
  provenanceChip: string | null;
  eligibleGenerate: boolean;
  eligibleImprove: boolean;
  critic: {
    status: string;
    resultLabel: string;
    staleMessage: string | null;
    claimsChecked: string | null;
    sourceAlignment: string | null;
    applicabilityConcerns: string | null;
    contradictions: string | null;
    requiredCorrections: string | null;
  };
  health: {
    authoritative: Array<{
      id?: string;
      title: string;
      publisher: string | null;
      authorityType: string | null;
      url: string | null;
      lastCheckedLabel: string | null;
    }>;
    intakeProvenance: Array<{ title: string }>;
    summaryLine: string;
  };
  primary: { kind: PrimaryActionKind; label: string };
};

type ClaimsPayload = {
  id?: string;
  claim_text?: string;
  category?: string;
  verification_status?: string;
  source_id?: string | null;
  source_location?: string | null;
};

type Props = {
  model: ExpandedReviewModel;
  editValue: string;
  onEditChange: (value: string) => void;
  draftDirty: boolean;
  claims: ClaimsPayload[];
  claimsLoading: boolean;
  detailSources: KnowledgeSourceRow[];
  busy: boolean;
  extractPending: boolean;
  onSaveDraft: () => void;
  onGenerate: () => void;
  onImprove: () => void;
  onRunCritic: () => void;
  onVerify: () => void;
  onExtractClaims: () => void;
  onCollapse: () => void;
};

export function AdminKnowledgeReviewExpanded({
  model,
  editValue,
  onEditChange,
  draftDirty,
  claims,
  claimsLoading,
  detailSources,
  busy,
  extractPending,
  onSaveDraft,
  onGenerate,
  onImprove,
  onRunCritic,
  onVerify,
  onExtractClaims,
  onCollapse,
}: Props) {
  const { row } = model;
  const [criticOpen, setCriticOpen] = useState(
    model.critic.status === "failed" || model.critic.status === "stale"
  );
  const opportunities = deriveOpportunities(row).slice(0, 3);
  const authSource = model.health.authoritative[0];
  const checkById = (id: string) => model.checks.find((c) => c.id === id);

  const guidanceCheck = checkById("guidance");
  const sourceAuth = checkById("source_authority");
  const sourceFresh = checkById("source_freshness");
  const applicability = checkById("applicability");
  const classification = checkById("classification");
  const trigger = checkById("trigger");
  const contradiction = checkById("contradiction");
  const human = checkById("human");

  const claimRows = claims
    .filter((c) => typeof c.claim_text === "string")
    .map((c) => ({
      id: c.id,
      claim_text: c.claim_text as string,
      category: c.category,
      verification_status: c.verification_status,
      source_id: c.source_id,
      source_location: c.source_location,
    }));

  const sourceRefs = (detailSources.length ? detailSources : model.sources).map((s) => ({
    id: s.id,
    label: s.label,
    url: s.url,
  }));

  function CheckRow({
    check,
    value,
    action,
    hint,
  }: {
    check?: TrustCheck;
    value?: string | null;
    action?: ReactNode;
    hint?: string | null;
  }) {
    if (!check) return null;
    const display = value || check.detail || statusLabel(check.status);
    return (
      <div className="space-y-1 border-b border-border/30 py-2 last:border-0">
        <div className="flex items-start gap-2 text-xs">
          <StatusIcon status={check.status} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-medium text-foreground">{check.label}</span>
              <span className={cn("truncate", checkTone(check.status))}>{display}</span>
            </div>
            {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
            {action && <div className="mt-1.5">{action}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-1 my-3 rounded-xl bg-card shadow-md ring-1 ring-border/40">
      <div className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
                {row.title}
              </h3>
              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-mono uppercase text-foreground">
                {row.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <MicroDetail label="Applies" value={attrString(row.attributes, "applies_when") || "—"}>
                <p>{attrString(row.attributes, "applies_when") || "Not set"}</p>
              </MicroDetail>
              <MicroDetail label="Jurisdiction" value={model.jurisdiction}>
                <p>{model.jurisdiction}</p>
              </MicroDetail>
              <MicroDetail label="Class" value={model.classification}>
                <p>{model.classification}</p>
                <p className="mt-1 text-muted-foreground">Trigger · {model.trigger}</p>
              </MicroDetail>
              <MicroDetail
                label="Source"
                value={
                  authSource?.publisher ||
                  authSource?.title ||
                  (model.health.authoritative.length === 0 ? "None" : "Source")
                }
              >
                {model.health.authoritative.length === 0 ? (
                  <p className="text-amber-700">No authoritative source linked.</p>
                ) : (
                  model.health.authoritative.map((s) => (
                    <div key={s.url || s.title} className="space-y-0.5 pb-2 last:pb-0">
                      <p className="font-medium">{s.title}</p>
                      <p className="text-muted-foreground">
                        {[s.publisher, s.authorityType].filter(Boolean).join(" · ")}
                      </p>
                      {s.lastCheckedLabel && (
                        <p className="text-muted-foreground">Checked {s.lastCheckedLabel}</p>
                      )}
                      {s.url && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-primary hover:underline"
                        >
                          {s.url}
                        </a>
                      )}
                    </div>
                  ))
                )}
                {model.health.intakeProvenance.length > 0 && (
                  <p className="mt-1 text-muted-foreground">
                    Intake · {model.health.intakeProvenance.map((p) => p.title).join(", ")}
                  </p>
                )}
              </MicroDetail>
            </div>
          </div>
          <button
            type="button"
            className="text-[11px] text-muted-foreground inline-flex items-center gap-1 shrink-0"
            onClick={onCollapse}
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-180" />
            Collapse
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]">
          <div className="space-y-5 min-w-0">
            <section className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Draft guidance
                {model.provenanceChip
                  ? ` · ${model.provenanceChip}`
                  : ` · ${model.qualityLabel}`}
              </p>
              {draftDirty && (
                <p className="text-[11px] text-muted-foreground">
                  Saved: {displayCanonicalGuidance(row)}
                </p>
              )}
              <Textarea
                value={editValue}
                onChange={(e) => onEditChange(e.target.value)}
                rows={5}
                className="text-sm"
                placeholder="Homeowner-readable draft guidance…"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="shadow-primary-btn border-0"
                  disabled={busy}
                  onClick={onSaveDraft}
                >
                  Save draft
                </Button>
                {model.eligibleGenerate && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-0 btn-neomorphic"
                    disabled={busy}
                    onClick={onGenerate}
                  >
                    Generate guidance
                  </Button>
                )}
                {model.eligibleImprove && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-0 btn-neomorphic"
                    disabled={busy}
                    onClick={onImprove}
                  >
                    Improve guidance
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Saves as unverified draft. Critic and human verify still required. AI proposals must
                be saved before running critic.
              </p>
            </section>

            <section className="space-y-2">
              {claimsLoading ? (
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading claims…
                </p>
              ) : (
                <KnowledgeClaimsList claims={claimRows} sources={sourceRefs} compact />
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-0 btn-neomorphic text-[11px]"
                disabled={extractPending || busy}
                onClick={onExtractClaims}
              >
                {extractPending ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Extracting…
                  </>
                ) : (
                  "Extract claims from sources"
                )}
              </Button>
            </section>

            <section className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Opportunities
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px] border-0 btn-neomorphic"
                  onClick={() => toast.message("Add opportunity — coming next")}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px] border-0 btn-neomorphic"
                  onClick={() => toast.message("Identify more opportunities — coming next")}
                >
                  Identify more
                </Button>
              </div>
              {opportunities.length === 0 ? (
                <p className="text-xs text-muted-foreground">No opportunities suggested yet.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {opportunities.map((o) => (
                    <li key={o.id}>{o.label}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="rounded-xl bg-muted/25 p-3 shadow-sm space-y-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
              Review checks
            </p>

            <CheckRow
              check={guidanceCheck}
              value={
                guidanceCheck?.status === "passed"
                  ? model.qualityLabel
                  : guidanceCheck?.detail || "Incomplete"
              }
              action={
                guidanceCheck && guidanceCheck.status !== "passed" && model.eligibleGenerate ? (
                  <Button
                    size="sm"
                    className="h-7 shadow-primary-btn border-0 text-[11px]"
                    disabled={busy}
                    onClick={onGenerate}
                  >
                    Generate
                  </Button>
                ) : guidanceCheck &&
                  guidanceCheck.status !== "passed" &&
                  model.eligibleImprove ? (
                  <Button
                    size="sm"
                    className="h-7 shadow-primary-btn border-0 text-[11px]"
                    disabled={busy}
                    onClick={onImprove}
                  >
                    Improve
                  </Button>
                ) : null
              }
            />

            <CheckRow
              check={sourceAuth}
              value={
                authSource?.publisher ||
                authSource?.title ||
                sourceAuth?.detail ||
                null
              }
            />
            <CheckRow
              check={sourceFresh}
              value={
                authSource?.lastCheckedLabel ||
                sourceFresh?.detail ||
                null
              }
            />
            <CheckRow check={applicability} value={applicability?.detail || model.jurisdiction} />
            <CheckRow
              check={classification}
              value={classification?.detail || model.classification}
            />
            <CheckRow check={trigger} value={trigger?.detail || model.trigger} />

            <CheckRow
              check={contradiction}
              value={statusLabel(contradiction?.status ?? "not_run")}
              hint={
                contradiction?.status === "passed"
                  ? model.critic.resultLabel
                  : model.critic.staleMessage ||
                    contradiction?.detail ||
                    "Critic must evaluate claims against linked sources. Re-run the critic before verification."
              }
              action={
                <div className="space-y-1.5">
                  {(model.critic.status === "not_run" ||
                    model.critic.status === "stale" ||
                    model.critic.status === "failed") &&
                    hasCanonicalGuidance(row) && (
                      <Button
                        size="sm"
                        className="h-7 shadow-primary-btn border-0 text-[11px]"
                        disabled={busy}
                        onClick={onRunCritic}
                      >
                        {model.critic.status === "failed" ? "Rerun critic" : "Run critic"}
                      </Button>
                    )}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => setCriticOpen((v) => !v)}
                  >
                    Details / critic findings
                    <ChevronDown
                      className={cn("h-3 w-3 transition-transform", criticOpen && "rotate-180")}
                    />
                  </button>
                  {criticOpen && (
                    <div className="rounded-lg bg-card/80 p-2 text-[11px] text-muted-foreground space-y-1">
                      <p className={checkTone(
                        model.critic.status === "passed"
                          ? "passed"
                          : model.critic.status === "failed"
                            ? "failed"
                            : "not_run"
                      )}>
                        {model.critic.resultLabel}
                        {model.critic.status === "stale" ? " (stale)" : ""}
                      </p>
                      {model.critic.claimsChecked && (
                        <p>Claims · {model.critic.claimsChecked}</p>
                      )}
                      {model.critic.sourceAlignment && (
                        <p>Source alignment · {model.critic.sourceAlignment}</p>
                      )}
                      {model.critic.applicabilityConcerns && (
                        <p>Applicability · {model.critic.applicabilityConcerns}</p>
                      )}
                      {model.critic.contradictions && <p>{model.critic.contradictions}</p>}
                      {model.critic.requiredCorrections && (
                        <p className="text-amber-700 dark:text-amber-400">
                          Required · {model.critic.requiredCorrections}
                        </p>
                      )}
                      {!model.critic.claimsChecked &&
                        !model.critic.sourceAlignment &&
                        !model.critic.contradictions &&
                        model.critic.status === "not_run" && (
                          <p>No critic findings yet.</p>
                        )}
                    </div>
                  )}
                </div>
              }
            />

            <CheckRow
              check={human}
              value={statusLabel(human?.status ?? "required")}
              hint={
                human?.status === "passed"
                  ? "Verified by a platform admin."
                  : isReadyForHumanVerify(row, model.checks)
                    ? "All automated checks clear — ready to verify."
                    : "Run after Contradiction check approved."
              }
              action={
                isReadyForHumanVerify(row, model.checks) ? (
                  <Button
                    size="sm"
                    className="h-7 shadow-primary-btn border-0 text-[11px]"
                    disabled={busy}
                    onClick={onVerify}
                  >
                    Verify
                  </Button>
                ) : null
              }
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
