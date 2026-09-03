/**
 * Bounded, source-backed scan interpretation written onto the uploaded
 * attachment (`attachments.metadata`). AI output stays advisory; this is a
 * copy of what the user already reviewed, not a second inference.
 */

import type { AggregatedIntakeScanReview } from "@/lib/aggregateIntakeScanReview";

export const INTAKE_SCAN_PROVENANCE_KEY = "intake_scan";

export type IntakeScanProvenance = {
  source: "document_scan" | "image_scan" | "mixed";
  captured_at: string;
  outcome: string | null;
  outcome_severity: AggregatedIntakeScanReview["outcomeSeverity"];
  primary_issue: string | null;
  dates: Array<{ label: string; date: string; kind: string }>;
  findings: Array<{ text: string; status: string }>;
  confirmed_action_ids: string[];
  linked_asset_ids: string[];
};

export function buildIntakeScanProvenance(input: {
  review: AggregatedIntakeScanReview;
  source: IntakeScanProvenance["source"];
  confirmedActionIds: string[];
  linkedAssetIds: string[];
  now?: Date;
}): IntakeScanProvenance {
  const findings = [...input.review.failFindings, ...input.review.otherFindings].slice(0, 12);
  return {
    source: input.source,
    captured_at: (input.now ?? new Date()).toISOString(),
    outcome: input.review.outcome,
    outcome_severity: input.review.outcomeSeverity,
    primary_issue: input.review.primaryIssue,
    dates: input.review.dates.slice(0, 12).map((d) => ({
      label: d.label.slice(0, 80),
      date: d.date,
      kind: d.kind,
    })),
    findings: findings.map((f) => ({
      text: f.text.slice(0, 240),
      status: f.status,
    })),
    confirmed_action_ids: input.confirmedActionIds.slice(0, 12),
    linked_asset_ids: input.linkedAssetIds.slice(0, 20),
  };
}

export function intakeScanProvenanceMetadata(
  provenance: IntakeScanProvenance,
  existing?: Record<string, unknown> | null
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    [INTAKE_SCAN_PROVENANCE_KEY]: provenance,
  };
}
