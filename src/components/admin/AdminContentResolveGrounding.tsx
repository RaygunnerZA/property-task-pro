import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getGroundingRemedies,
  type GroundingRemedyId,
  type SeoReadiness,
} from "@/lib/content/contentTopicWorkflow";
import {
  researchProgressCopy,
  type ContentEvidenceResearchMeta,
  type EvidenceResearchPhase,
} from "@/lib/content/contentEvidenceResearch";

const COMPACT_ACTIONS: Partial<
  Record<GroundingRemedyId, { label: string; primary?: boolean }>
> = {
  retrieve_source: { label: "Retrieve source", primary: true },
  add_source: { label: "Replace source", primary: true },
  return_knowledge: { label: "Open Knowledge", primary: true },
  research_evidence: { label: "Research missing evidence", primary: true },
};

type Props = {
  readiness: SeoReadiness;
  busy?: boolean;
  onRemedy: (id: GroundingRemedyId) => void;
  researchPhase?: EvidenceResearchPhase | null;
  researchMeta?: ContentEvidenceResearchMeta | null;
  onVerifyClaims?: () => void;
  /** Stuck after earlier verify+regen left soft gaps — clears them so Approve appears. */
  onEnableApprove?: () => void;
  verifyBusy?: boolean;
};

export function AdminContentResolveGrounding({
  readiness,
  busy,
  onRemedy,
  researchPhase,
  researchMeta,
  onVerifyClaims,
  onEnableApprove,
  verifyBusy,
}: Props) {
  if (readiness.canApprove || readiness.status === "approved" || readiness.status === "blocked") {
    return null;
  }

  const { headline, remedies } = getGroundingRemedies(readiness);
  const primaryRemedies = remedies.filter((r) => COMPACT_ACTIONS[r.id]?.primary && r.available);
  const secondaryRemedies = remedies.filter(
    (r) => !(COMPACT_ACTIONS[r.id]?.primary && r.available)
  );
  const progress = researchProgressCopy({ phase: researchPhase, meta: researchMeta });
  const researching =
    researchPhase === "classifying" ||
    researchPhase === "packing" ||
    researchPhase === "critic" ||
    researchMeta?.research_status === "running";
  const humanVerified = researchMeta?.research_status === "human_verified";
  const needsHumanVerify =
    Boolean(onVerifyClaims) &&
    !humanVerified &&
    (researchPhase === "awaiting_human" ||
      researchPhase === "verify_only" ||
      researchMeta?.research_status === "awaiting_human" ||
      researchMeta?.research_status === "verify_only");
  const needsEnableApprove =
    Boolean(onEnableApprove) &&
    humanVerified &&
    !readiness.sourceUnavailable &&
    readiness.sourceIssues.length === 0;

  return (
    <section className="rounded-lg bg-[hsl(16_82%_56%)]/10 px-3 py-2 space-y-2">
      <p className="text-sm font-semibold flex items-center gap-2 text-[hsl(16_72%_40%)]">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {readiness.status === "source_retrieval_required"
          ? "Source unavailable"
          : humanVerified
            ? "Ready to approve"
            : headline}
      </p>
      {progress ? (
        <p className="text-xs text-foreground flex items-center gap-1.5">
          {researching ? (
            <Loader2 className="h-3 w-3 animate-spin shrink-0" aria-hidden />
          ) : null}
          {progress}
        </p>
      ) : null}
      {needsEnableApprove ? (
        <Button
          type="button"
          size="sm"
          className="shadow-primary-btn border-0"
          disabled={busy || verifyBusy}
          onClick={() => onEnableApprove?.()}
        >
          {verifyBusy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              Updating…
            </>
          ) : (
            "Enable Approve SEO"
          )}
        </Button>
      ) : null}
      {needsHumanVerify ? (
        <Button
          type="button"
          size="sm"
          className="shadow-primary-btn border-0"
          disabled={busy || researching || verifyBusy}
          onClick={() => onVerifyClaims?.()}
        >
          {verifyBusy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              Verifying…
            </>
          ) : (
            "Verify claims"
          )}
        </Button>
      ) : null}
      {!needsEnableApprove ? (
        <>
          <p className="text-xs flex flex-wrap items-center gap-x-1 gap-y-0.5">
            {primaryRemedies.map((remedy, index) => (
              <span key={remedy.id} className="inline-flex items-center gap-1">
                {index > 0 ? <span className="text-muted-foreground">·</span> : null}
                <button
                  type="button"
                  disabled={busy || researching || verifyBusy}
                  className="text-xs font-medium text-foreground hover:underline disabled:opacity-50"
                  onClick={() => onRemedy(remedy.id)}
                >
                  {COMPACT_ACTIONS[remedy.id]?.label ?? remedy.label}
                </button>
              </span>
            ))}
          </p>
          {secondaryRemedies.map((remedy) =>
            remedy.available ? (
              <p key={remedy.id} className="text-[10px] text-muted-foreground">
                <button
                  type="button"
                  disabled={busy || researching || verifyBusy}
                  className="hover:underline disabled:opacity-50"
                  onClick={() => onRemedy(remedy.id)}
                >
                  {COMPACT_ACTIONS[remedy.id]?.label ?? remedy.label}
                </button>
              </p>
            ) : (
              <p key={remedy.id} className="text-[10px] text-muted-foreground">
                {COMPACT_ACTIONS[remedy.id]?.label ?? remedy.label}
                {" — coming soon"}
              </p>
            )
          )}
        </>
      ) : (
        <p className="text-[10px] text-muted-foreground">
          Clears leftover claim-gap strings from SEO so Approve is available. Source issues stay.
        </p>
      )}
    </section>
  );
}
