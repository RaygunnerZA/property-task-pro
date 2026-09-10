import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  useAdminGenerateKnowledgeGuidance,
  useAdminExtractKnowledgeClaims,
  useAdminKnowledgeDetail,
  useAdminRunKnowledgeCritic,
  useAdminSetDraftGuidance,
  useAdminSetKnowledgeStatus,
} from "@/hooks/admin/useAdminKnowledge";
import { KnowledgeClaimsList } from "@/components/admin/KnowledgeClaimsList";
import { KnowledgeSourceUrlEditor } from "@/components/admin/KnowledgeSourceUrlEditor";
import { needsGuidanceGeneration } from "@/lib/knowledge/knowledgeDraftGuidance";
import {
  isEligibleForGuidanceImprovement,
  primaryActionForRow,
} from "@/lib/knowledge/knowledgeReviewState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { sideSheetDesktopWidthClass } from "@/lib/layoutClasses";
import type { KnowledgeStatus } from "@/types/knowledge";
import {
  attrString,
  blockingChecksForPublish,
  blockingChecksForVerify,
  buildTrustChecks,
  canPublish,
  canVerify,
  computeSourceHealth,
  deriveOpportunities,
  displayKnowledgeGuidance,
  displayKnowledgeTitle,
  formatApplicabilityLine,
  guidanceDraftLabel,
  legalClassificationLabel,
  parseApplicability,
  parseCriticSummary,
  presentationTypeLabel,
  sourceKindLabel,
  statusLabel,
  triggerLabel,
  type TrustCheck,
  type TrustCheckStatus,
} from "@/lib/knowledge/knowledgePresentation";
import { toast } from "sonner";

function statusTone(status: string): string {
  switch (status) {
    case "published":
      return "bg-primary/15 text-foreground";
    case "verified":
      return "bg-emerald-500/15 text-foreground";
    case "candidate":
      return "bg-amber-500/15 text-foreground";
    case "stale":
      return "bg-orange-500/15 text-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

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

function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="space-y-2 scroll-mt-4">
      <h3 className="text-caption font-mono uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="rounded-xl bg-card/80 shadow-sm p-4 space-y-2 text-sm">{children}</div>
    </section>
  );
}

function TrustChecksList({
  checks,
  onFocusField,
}: {
  checks: TrustCheck[];
  onFocusField?: (hint: NonNullable<TrustCheck["fieldHint"]>) => void;
}) {
  return (
    <ul className="space-y-2">
      {checks.map((check) => {
        const actionable =
          check.fieldHint &&
          (check.status === "failed" ||
            check.status === "incomplete" ||
            check.status === "not_run" ||
            check.status === "required");
        return (
          <li key={check.id} className="flex gap-3 items-start">
            <span className={cn("shrink-0 text-xs font-medium w-24", checkTone(check.status))}>
              {statusLabel(check.status)}
            </span>
            <div className="min-w-0">
              {actionable ? (
                <button
                  type="button"
                  className="text-sm font-medium text-foreground text-left hover:underline"
                  onClick={() => onFocusField?.(check.fieldHint!)}
                >
                  {check.label}
                </button>
              ) : (
                <p className="text-sm font-medium text-foreground">{check.label}</p>
              )}
              {check.detail && (
                <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function gateErrorMessage(msg: string): string {
  if (msg.includes("guidance_required")) return "Guidance is missing or invalid";
  if (msg.includes("authoritative_source_required")) {
    return "An authoritative source URL is required";
  }
  if (msg.includes("critic_required")) return "Critic must pass before this action";
  if (msg.includes("applicability_uk_nation_required")) {
    return "UK nation required (England, Wales, Scotland, or Northern Ireland)";
  }
  if (msg.includes("applicability_jurisdiction_required")) {
    return "Applicability jurisdiction is required";
  }
  if (msg.includes("verify_before_publish")) return "Verify this item before publishing";
  if (msg.includes("human_verifier_required")) return "Human verifier required";
  return msg;
}

export function AdminKnowledgeDetailSheet({
  knowledgeId,
  open,
  onOpenChange,
}: {
  knowledgeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detail = useAdminKnowledgeDetail(open ? knowledgeId : null);
  const setStatus = useAdminSetKnowledgeStatus();
  const runCritic = useAdminRunKnowledgeCritic();
  const extractClaims = useAdminExtractKnowledgeClaims();
  const generateGuidance = useAdminGenerateKnowledgeGuidance();
  const setDraft = useAdminSetDraftGuidance();
  const [techOpen, setTechOpen] = useState(false);
  const [criticTechOpen, setCriticTechOpen] = useState(false);
  const [draftEdit, setDraftEdit] = useState<string | null>(null);

  const row = detail.data?.knowledge ?? null;
  const sources = detail.data?.sources ?? [];
  const events = detail.data?.verification_events ?? [];
  const claims = (detail.data?.claims ?? []) as Array<{
    id?: string;
    claim_text?: string;
    category?: string;
    verification_status?: string;
    source_id?: string | null;
    source_location?: string | null;
  }>;

  const checks = useMemo(
    () =>
      row
        ? buildTrustChecks(row, {
            sources,
            verificationEvents: events,
          })
        : [],
    [row, sources, events]
  );

  const critic = row ? parseCriticSummary(row, events, { sources }) : null;
  const health = row ? computeSourceHealth(sources, row) : null;
  const app = row ? parseApplicability(row.applicability) : null;
  const opportunities = row ? deriveOpportunities(row) : [];
  const blocking =
    row?.status === "verified"
      ? blockingChecksForPublish(checks)
      : blockingChecksForVerify(checks);

  const action = row ? attrString(row.attributes, "action") : null;
  const evidence = row ? attrString(row.attributes, "evidence") : null;
  const appliesWhen = row ? attrString(row.attributes, "applies_when") : null;
  const frequency = row ? attrString(row.attributes, "frequency") : null;
  const risk = row ? attrString(row.attributes, "risk_or_consequence") : null;

  const reviewPrimary = row
    ? primaryActionForRow(row, checks, sources)
    : null;

  const primary =
    row && row.status === "candidate" && canVerify(row, checks)
      ? ({ label: "Verify", status: "verified" as KnowledgeStatus, kind: "verify" as const })
      : row &&
          row.status === "verified" &&
          !row.reviewed_by &&
          blockingChecksForVerify(checks).length === 0
        ? ({
            label: "Confirm verification",
            status: "verified" as KnowledgeStatus,
            kind: "verify" as const,
          })
        : row && row.status === "verified" && canPublish(row, checks)
          ? ({
              label: "Publish",
              status: "published" as KnowledgeStatus,
              kind: "publish" as const,
            })
          : null;

  const guidanceEditorValue =
    draftEdit ?? (row?.summary || row?.body || "");

  const focusField = (hint: NonNullable<TrustCheck["fieldHint"]>) => {
    const id =
      hint === "guidance"
        ? "ko-guidance"
        : hint === "sources"
          ? "ko-sources"
          : hint === "applicability"
            ? "ko-applicability"
            : hint === "critic"
              ? "ko-critic"
              : "ko-checks";
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const runStatus = (status: KnowledgeStatus) => {
    if (!knowledgeId) return;
    setStatus.mutate(
      { knowledgeId, status },
      {
        onSuccess: () => {
          toast.success(
            status === "verified"
              ? "Verified — ready to publish"
              : status === "published"
                ? "Published"
                : status === "archived"
                  ? "Rejected"
                  : status === "candidate"
                    ? "Returned to review"
                    : `Status → ${status}`
          );
          if (status === "archived" || status === "published") onOpenChange(false);
        },
        onError: (e) => {
          const msg = e instanceof Error ? e.message : "Update failed";
          toast.error(gateErrorMessage(msg));
        },
      }
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          sideSheetDesktopWidthClass,
          "sm:max-w-xl"
        )}
      >
        <SheetHeader className="shrink-0 px-5 pt-5 pb-3 pr-12 text-left space-y-2 border-b border-border/20">
          <SheetTitle className="text-lg font-semibold leading-snug">
            {row ? displayKnowledgeTitle(row) : "Knowledge"}
          </SheetTitle>
          {row && (
            <div className="flex flex-wrap gap-1.5">
              <span
                className={cn(
                  "inline-flex px-2 py-0.5 rounded-[6px] text-caption font-mono uppercase tracking-wider",
                  statusTone(row.status)
                )}
              >
                {row.status}
              </span>
              {app && (app.jurisdictions[0] || app.unscoped) && (
                <span className="inline-flex px-2 py-0.5 rounded-[6px] text-caption bg-muted text-muted-foreground">
                  {app.unscoped ? "Global" : app.jurisdictions.slice(0, 2).join(" · ")}
                </span>
              )}
              <span className="inline-flex px-2 py-0.5 rounded-[6px] text-caption bg-muted text-muted-foreground">
                {presentationTypeLabel(row)}
              </span>
              <span className="inline-flex px-2 py-0.5 rounded-[6px] text-caption bg-muted text-muted-foreground">
                {legalClassificationLabel(row)}
              </span>
            </div>
          )}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
          {detail.isLoading && (
            <div className="flex justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
          {detail.error && (
            <p className="text-sm text-destructive">
              {detail.error instanceof Error ? detail.error.message : "Failed to load"}
            </p>
          )}
          {row && (
            <>
              <Section id="ko-guidance" title="Guidance">
                {row.status === "candidate" ? (
                  <Textarea
                    value={guidanceEditorValue}
                    onChange={(e) => setDraftEdit(e.target.value)}
                    rows={4}
                    className="text-sm"
                  />
                ) : (
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                    {displayKnowledgeGuidance(row)}
                  </p>
                )}
                {guidanceDraftLabel(row) && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {guidanceDraftLabel(row)} — still requires critic and human verification.
                  </p>
                )}
                {critic?.staleMessage && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {critic.staleMessage}
                  </p>
                )}
                {knowledgeId && row.status === "candidate" && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button
                      size="sm"
                      className="shadow-primary-btn border-0"
                      disabled={setDraft.isPending}
                      onClick={() => {
                        const text = guidanceEditorValue.trim();
                        if (text.length < 12) {
                          toast.error("Guidance must be meaningful prose");
                          return;
                        }
                        setDraft.mutate(
                          { knowledgeId, summary: text },
                          {
                            onSuccess: () => {
                              toast.success(
                                "Draft saved — critic is not run for this version"
                              );
                              setDraftEdit(null);
                            },
                            onError: (e) =>
                              toast.error(
                                e instanceof Error ? e.message : "Save failed"
                              ),
                          }
                        );
                      }}
                    >
                      Save draft
                    </Button>
                    {needsGuidanceGeneration({
                      summary: row.summary,
                      body: row.body,
                      attributes: (row.attributes ?? {}) as Record<string, string>,
                    }) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-0 btn-neomorphic"
                        disabled={generateGuidance.isPending}
                        onClick={() => {
                          if (
                            !window.confirm(
                              "Generate draft guidance? It will be placed in the editor for you to save."
                            )
                          ) {
                            return;
                          }
                          generateGuidance.mutate(
                            {
                              knowledgeIds: [knowledgeId],
                              mode: "generate",
                              persist: false,
                            },
                            {
                              onSuccess: (res) => {
                                const summary = res.results.find((r) => r.ok)?.summary;
                                if (summary) setDraftEdit(summary);
                                toast.success(
                                  "AI-proposed draft placed in editor (unverified)"
                                );
                              },
                              onError: (e) =>
                                toast.error(
                                  e instanceof Error ? e.message : "Generation failed"
                                ),
                            }
                          );
                        }}
                      >
                        {generateGuidance.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Generate guidance"
                        )}
                      </Button>
                    )}
                    {isEligibleForGuidanceImprovement(row, sources) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-0 btn-neomorphic"
                        disabled={generateGuidance.isPending}
                        onClick={() => {
                          if (
                            !window.confirm(
                              "Improve this guidance? Proposed text stays unverified until you save."
                            )
                          ) {
                            return;
                          }
                          generateGuidance.mutate(
                            {
                              knowledgeIds: [knowledgeId],
                              mode: "improve",
                              persist: false,
                            },
                            {
                              onSuccess: (res) => {
                                const summary = res.results.find((r) => r.ok)?.summary;
                                if (summary) setDraftEdit(summary);
                                toast.success(
                                  "Improved draft placed in editor (unverified)"
                                );
                              },
                              onError: (e) =>
                                toast.error(
                                  e instanceof Error ? e.message : "Improvement failed"
                                ),
                            }
                          );
                        }}
                      >
                        Improve guidance
                      </Button>
                    )}
                  </div>
                )}
              </Section>

              <Section id="ko-applicability" title="Why it applies">
                <p className="text-foreground">{app ? formatApplicabilityLine(app) : "—"}</p>
                {appliesWhen && (
                  <p className="text-muted-foreground text-xs pt-1">{appliesWhen}</p>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  Trigger · {triggerLabel(row)}
                </p>
              </Section>

              {(action || evidence || frequency || risk) && (
                <Section title="Action & evidence">
                  {action && (
                    <p>
                      <span className="text-muted-foreground">Action · </span>
                      {action}
                    </p>
                  )}
                  {evidence && (
                    <p>
                      <span className="text-muted-foreground">Evidence · </span>
                      {evidence}
                    </p>
                  )}
                  {frequency && (
                    <p>
                      <span className="text-muted-foreground">Frequency · </span>
                      {frequency}
                    </p>
                  )}
                  {risk && (
                    <p>
                      <span className="text-muted-foreground">Risk · </span>
                      {risk}
                    </p>
                  )}
                </Section>
              )}

              <Section id="ko-sources" title="Sources">
                {health && health.authoritative.length === 0 && (
                  <p className="text-muted-foreground mb-2">No authoritative sources linked.</p>
                )}
                {row && (
                  <KnowledgeSourceUrlEditor
                    knowledgeId={row.id}
                    sources={[
                      ...(health?.authoritative ?? []).map((s) => ({
                        id: s.id,
                        title: s.title,
                        url: s.url,
                        label: s.title,
                      })),
                      ...sources
                        .filter(
                          (s) =>
                            s.url &&
                            !(health?.authoritative ?? []).some((a) => a.id === s.id)
                        )
                        .map((s) => ({
                          id: s.id,
                          title: s.label,
                          url: s.url,
                          label: s.label,
                        })),
                    ]}
                  />
                )}
                {health && health.intakeProvenance.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-border/20 pt-3">
                    <p className="text-xs font-medium text-muted-foreground">Intake provenance</p>
                    {health.intakeProvenance.map((s) => (
                      <p key={s.id || s.title} className="text-xs text-muted-foreground">
                        {s.title}
                        {s.lastCheckedLabel ? ` · ${s.lastCheckedLabel}` : ""}
                      </p>
                    ))}
                  </div>
                )}
              </Section>

              <Section id="ko-claims" title="Claims">
                <KnowledgeClaimsList
                  showHeading={false}
                  claims={claims
                    .filter((c) => typeof c.claim_text === "string")
                    .map((c) => ({
                      id: c.id,
                      claim_text: c.claim_text as string,
                      category: c.category,
                      verification_status: c.verification_status,
                      source_id: c.source_id,
                      source_location: c.source_location,
                    }))}
                  sources={sources.map((s) => ({
                    id: s.id,
                    label: s.label,
                    url: s.url,
                  }))}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={extractClaims.isPending || !row}
                  onClick={() => {
                    if (!row) return;
                    void extractClaims
                      .mutateAsync(row.id)
                      .then((res) => {
                        toast.success(
                          `Extracted ${res?.inserted_count ?? 0} claims from sources`
                        );
                        return runCritic.mutateAsync(row.id);
                      })
                      .then(() => toast.success("Critic re-run on claims"))
                      .catch((err: Error) =>
                        toast.error(err.message || "Claim extraction failed")
                      );
                  }}
                >
                  {extractClaims.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      Extracting…
                    </>
                  ) : (
                    "Extract claims from sources"
                  )}
                </Button>
              </Section>

              <Section id="ko-checks" title="Review checks">
                <TrustChecksList checks={checks} onFocusField={focusField} />
              </Section>

              <Section id="ko-critic" title="Critic findings">
                {critic ? (
                  <>
                    <p
                      className={cn(
                        "font-medium",
                        checkTone(
                          critic.status === "passed"
                            ? "passed"
                            : critic.status === "failed"
                              ? "failed"
                              : "not_run"
                        )
                      )}
                    >
                      {critic.resultLabel}
                      {critic.status === "stale" ? " (stale)" : ""}
                    </p>
                    {critic.staleMessage && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {critic.staleMessage}
                      </p>
                    )}
                    {critic.claimsChecked && (
                      <p className="text-xs text-muted-foreground">
                        Claims · {critic.claimsChecked}
                      </p>
                    )}
                    {critic.sourceAlignment && (
                      <p className="text-xs text-muted-foreground">
                        Source alignment · {critic.sourceAlignment}
                      </p>
                    )}
                    {critic.applicabilityConcerns && (
                      <p className="text-xs text-muted-foreground">
                        Applicability · {critic.applicabilityConcerns}
                      </p>
                    )}
                    {critic.contradictions && (
                      <p className="text-xs text-muted-foreground">{critic.contradictions}</p>
                    )}
                    {critic.requiredCorrections && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Required · {critic.requiredCorrections}
                      </p>
                    )}
                    {critic.rawNotes && (
                      <div className="pt-1">
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline"
                          onClick={() => setCriticTechOpen((v) => !v)}
                        >
                          {criticTechOpen ? "Hide technical view" : "Technical view"}
                        </button>
                        {criticTechOpen && (
                          <p className="text-xs font-mono text-muted-foreground mt-1 whitespace-pre-wrap">
                            {critic.rawNotes}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground text-xs">Critic has not run yet.</p>
                )}
                {knowledgeId && (row.status === "candidate" || row.status === "verified") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-0 btn-neomorphic mt-2"
                    disabled={runCritic.isPending}
                    onClick={() =>
                      runCritic.mutate(knowledgeId, {
                        onSuccess: () => toast.success("Critic finished"),
                        onError: (e) =>
                          toast.error(e instanceof Error ? e.message : "Critic failed"),
                      })
                    }
                  >
                    {runCritic.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : critic?.status === "not_run" ||
                      critic?.status === "stale" ||
                      critic?.status === "failed" ? (
                      "Run critic"
                    ) : (
                      "Re-run critic"
                    )}
                  </Button>
                )}
              </Section>

              <Section title="Activity">
                {events.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No verification events yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {events.slice(0, 12).map((ev) => (
                      <li
                        key={ev.id}
                        className="flex flex-col gap-0.5 border-b border-border/30 border-dashed pb-2 last:border-0"
                      >
                        <span className="text-xs font-medium text-foreground">
                          {ev.event_type.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {new Date(ev.created_at).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Used by">
                <p className="text-muted-foreground">
                  0 tasks · 0 properties · 0 answers · 0 articles
                </p>
                <p className="text-xs text-muted-foreground">
                  Usage appears after Knowledge is published into product experiences.
                </p>
              </Section>

              {opportunities.length > 0 && (
                <Section title="Opportunities">
                  <ul className="space-y-2">
                    {opportunities.map((o) => (
                      <li key={o.id}>
                        <p className="text-foreground">{o.label}</p>
                        <p className="text-xs text-muted-foreground">{o.reason}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground pt-1">
                    Suggestions only — nothing is created automatically.
                  </p>
                </Section>
              )}

              <div className="rounded-xl bg-card/60 shadow-sm">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  onClick={() => setTechOpen((v) => !v)}
                >
                  <span className="text-caption font-mono uppercase tracking-wider text-muted-foreground">
                    Technical details
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      techOpen && "rotate-180"
                    )}
                  />
                </button>
                {techOpen && (
                  <div className="px-4 pb-4 space-y-1 text-xs text-muted-foreground font-mono">
                    <p>Intake title: {row.title}</p>
                    <p>Source kind: {sourceKindLabel(row.source_kind)}</p>
                    {typeof row.trust_score === "number" && (
                      <p>Internal trust score: {row.trust_score.toFixed(2)} (ranking only)</p>
                    )}
                    {health?.intakeProvenance.map((p) => (
                      <p key={p.id || p.title}>Intake file: {p.title}</p>
                    ))}
                    {row.provenance && (
                      <p className="break-all">
                        Provenance: {JSON.stringify(row.provenance).slice(0, 280)}
                        {JSON.stringify(row.provenance).length > 280 ? "…" : ""}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {row && (
          <div className="shrink-0 border-t border-border/20 px-5 py-4 space-y-2 bg-background/80">
            {blocking.length > 0 &&
              (row.status === "candidate" || row.status === "verified") && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Resolve {blocking.length} issue{blocking.length === 1 ? "" : "s"} before{" "}
                  {row.status === "candidate" ? "verification" : "publication"}
                  {": "}
                  {blocking.map((b) => b.label).join(", ")}
                </p>
              )}
            <div className="flex flex-wrap gap-2">
              {primary ? (
                <Button
                  className="shadow-primary-btn border-0"
                  disabled={setStatus.isPending}
                  onClick={() => runStatus(primary.status)}
                >
                  {setStatus.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    primary.label
                  )}
                </Button>
              ) : row.status === "candidate" &&
                reviewPrimary?.kind === "run_critic" &&
                knowledgeId ? (
                <Button
                  className="shadow-primary-btn border-0"
                  disabled={runCritic.isPending}
                  onClick={() =>
                    runCritic.mutate(knowledgeId, {
                      onSuccess: () => toast.success("Critic finished"),
                      onError: (e) =>
                        toast.error(e instanceof Error ? e.message : "Critic failed"),
                    })
                  }
                >
                  {runCritic.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Run critic"
                  )}
                </Button>
              ) : row.status === "candidate" &&
                (reviewPrimary?.kind === "improve" ||
                  reviewPrimary?.kind === "generate") ? (
                <Button
                  className="shadow-primary-btn border-0"
                  disabled={generateGuidance.isPending || !knowledgeId}
                  onClick={() => {
                    const mode =
                      reviewPrimary.kind === "improve" ? "improve" : "generate";
                    generateGuidance.mutate(
                      {
                        knowledgeIds: [knowledgeId!],
                        mode,
                        persist: false,
                      },
                      {
                        onSuccess: (res) => {
                          const summary = res.results.find((r) => r.ok)?.summary;
                          if (summary) setDraftEdit(summary);
                          toast.success("Proposed draft placed in editor");
                          focusField("guidance");
                        },
                        onError: (e) =>
                          toast.error(
                            e instanceof Error ? e.message : "Guidance failed"
                          ),
                      }
                    );
                  }}
                >
                  {reviewPrimary.label}
                </Button>
              ) : row.status === "candidate" ? (
                <Button className="shadow-primary-btn border-0" disabled>
                  Verify
                </Button>
              ) : null}
              {(row.status === "candidate" || row.status === "verified") && (
                <Button
                  variant="outline"
                  className="border-0 btn-neomorphic"
                  disabled={setStatus.isPending}
                  onClick={() =>
                    runStatus(row.status === "verified" ? "candidate" : "archived")
                  }
                >
                  {row.status === "verified" ? "Return to review" : "Reject"}
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
