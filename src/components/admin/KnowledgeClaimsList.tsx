import { Check, CircleHelp, Link2, X } from "lucide-react";
import {
  claimStatusLabel,
  summarizeKnowledgeClaims,
} from "@/lib/knowledge/knowledgeClaims";
import { cn } from "@/lib/utils";

export type KnowledgeClaimListItem = {
  id?: string;
  claim_text: string;
  category?: string;
  verification_status?: string;
  source_id?: string | null;
  source_location?: string | null;
};

export type KnowledgeClaimSourceRef = {
  id: string;
  label?: string | null;
  url?: string | null;
};

type Props = {
  claims: KnowledgeClaimListItem[];
  sources?: KnowledgeClaimSourceRef[];
  className?: string;
  compact?: boolean;
  showHeading?: boolean;
  emptyHint?: string;
};

function StatusMark({ status }: { status: string }) {
  if (status === "verified") {
    return <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />;
  }
  if (status === "unknown" || status === "unresolved") {
    return <CircleHelp className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />;
  }
  if (status === "rejected") {
    return <X className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />;
  }
  return (
    <span
      className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50"
      aria-hidden
    />
  );
}

function sourceForClaim(
  claim: KnowledgeClaimListItem,
  sources: KnowledgeClaimSourceRef[]
): KnowledgeClaimSourceRef | null {
  if (!claim.source_id) return null;
  return sources.find((s) => s.id === claim.source_id) ?? null;
}

export function KnowledgeClaimsList({
  claims,
  sources = [],
  className,
  compact = false,
  showHeading = true,
  emptyHint = "No claims extracted yet. Extract from linked sources to capture atomic facts.",
}: Props) {
  const summary = summarizeKnowledgeClaims(claims);
  const checked = summary.verified + summary.extracted;

  if (claims.length === 0) {
    return (
      <div className={cn("space-y-1", className)}>
        {showHeading && (
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Claims</p>
        )}
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        {showHeading ? (
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Claims</p>
        ) : (
          <span />
        )}
        <p className="text-[10px] text-muted-foreground">
          {checked} claim{checked === 1 ? "" : "s"}
          {summary.unknown + summary.unresolved > 0
            ? ` · ${summary.unknown + summary.unresolved} gap${
                summary.unknown + summary.unresolved === 1 ? "" : "s"
              }`
            : ""}
          {summary.verified > 0 ? ` · ${summary.verified} verified` : ""}
        </p>
      </div>
      <ul className={cn("space-y-1.5", compact ? "max-h-56 overflow-y-auto pr-1" : "")}>
        {claims.map((claim, idx) => {
          const status = String(claim.verification_status ?? "extracted");
          const source = sourceForClaim(claim, sources);
          const href = source?.url ?? null;
          return (
            <li
              key={claim.id ?? `${idx}-${claim.claim_text.slice(0, 24)}`}
              className="flex gap-2 text-xs leading-snug"
            >
              <StatusMark status={status} />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-foreground">{claim.claim_text}</p>
                <p className="text-[10px] text-muted-foreground">
                  {[
                    claim.category && claim.category !== "other" ? claim.category : null,
                    claimStatusLabel(status),
                    claim.source_location || null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline truncate max-w-full"
                  >
                    <Link2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">{source?.label || href}</span>
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
