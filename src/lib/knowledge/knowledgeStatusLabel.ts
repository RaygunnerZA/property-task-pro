/**
 * Customer-facing Knowledge status labels (Ch 30).
 * Do not surface raw trust_score on org UI.
 */

import type { KnowledgeStatus } from "@/types/knowledge";

export function knowledgeStatusUserLabel(
  status: KnowledgeStatus | string | null | undefined
): string {
  switch (status) {
    case "candidate":
      return "Needs Review";
    case "verified":
      return "Verified";
    case "published":
      return "Published";
    case "stale":
      return "Stale";
    case "archived":
      return "Archived";
    default:
      return status ? String(status) : "Unknown";
  }
}
