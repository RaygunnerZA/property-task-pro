import { complianceReviews } from "./reviews";
import { complianceClauses } from "./clauses";

export type ComplianceReviewRow = {
  id: string;
  org_id: string;
  rule_id: string | null;
  status?: string | null;
  reviewer_id?: string | null;
  notes?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

/**
 * Single payload for review workspace + batch rewrite: one review row plus its clauses.
 */
export async function loadReviewWorkspace(reviewId: string) {
  const { data: review, error: re } =
    await complianceReviews.getById(reviewId);
  if (re) throw new Error(re);
  if (!review) return null;

  const r = review as ComplianceReviewRow;
  const { data: clauses, error: ce } = await complianceClauses.listForReview({
    org_id: r.org_id,
    rule_id: r.rule_id ?? null,
  });
  if (ce) throw new Error(ce);

  return {
    ...r,
    clauses: clauses ?? [],
  };
}
