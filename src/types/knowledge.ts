export type KnowledgeScope = "platform" | "organisation";

export type KnowledgeStatus =
  | "candidate"
  | "verified"
  | "published"
  | "stale"
  | "archived";

export type KnowledgeSourceKind =
  | "filla_curated"
  | "org_upload"
  | "operational_discovery"
  | "community_brain";

export interface KnowledgeRow {
  id: string;
  scope: KnowledgeScope;
  status: KnowledgeStatus;
  org_id: string | null;
  title: string;
  summary: string | null;
  body: string | null;
  content: Record<string, unknown>;
  source_kind: KnowledgeSourceKind;
  trust_score: number | null;
  provenance: Record<string, unknown>;
  cohort_size: number | null;
  version: number;
  supersedes_id: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
