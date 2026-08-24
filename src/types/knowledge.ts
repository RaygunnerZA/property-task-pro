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

export type KnowledgeAudience = "owner" | "manager" | "field" | "tenant" | "public";

const AUDIENCE_ALIASES: Record<string, KnowledgeAudience> = {
  owner: "owner",
  landlord: "owner",
  homeowner: "owner",
  proprietor: "owner",
  freeholder: "owner",
  manager: "manager",
  "property manager": "manager",
  "managing agent": "manager",
  agent: "manager",
  admin: "manager",
  administrator: "manager",
  field: "field",
  staff: "field",
  operative: "field",
  technician: "field",
  contractor: "field",
  tradesperson: "field",
  tenant: "tenant",
  resident: "tenant",
  renter: "tenant",
  occupant: "tenant",
  leaseholder: "tenant",
  public: "public",
  anyone: "public",
  general: "public",
  consumer: "public",
};

/** Map spreadsheet audience labels to canonical roles; drop unknowns. */
export function canonicalizeKnowledgeAudiences(raw: string[]): KnowledgeAudience[] {
  const out = new Set<KnowledgeAudience>();
  for (const cell of raw) {
    const parts = cell
      .toLowerCase()
      .split(/\s*(?:,|;|\||\/|&|\+|\band\b)\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const part of parts) {
      const mapped = AUDIENCE_ALIASES[part];
      if (mapped) out.add(mapped);
    }
  }
  return [...out];
}

/** Canonical applicability shape stored on knowledge.applicability */
export type KnowledgeApplicability = {
  jurisdictions: string[];
  regions: string[];
  languages: string[];
  audiences: KnowledgeAudience[];
  /** Explicit platform-global: allowed when jurisdictions is empty */
  unscoped?: boolean;
};

export const EMPTY_APPLICABILITY: KnowledgeApplicability = {
  jurisdictions: [],
  regions: [],
  languages: [],
  audiences: [],
  unscoped: false,
};

export interface KnowledgeRow {
  id: string;
  scope: KnowledgeScope;
  status: KnowledgeStatus;
  org_id: string | null;
  title: string;
  summary: string | null;
  body: string | null;
  content: Record<string, unknown>;
  /** Structured facts from intake / type-specific fields (freeform object). */
  attributes?: Record<string, unknown>;
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
  applicability?: KnowledgeApplicability | Record<string, unknown>;
}

export type ContentTopicStatus = "draft" | "active" | "archived";
export type ContentOutputKind = "core_article" | "faq" | "in_app_tip";
export type ContentOutputStatus =
  | "draft"
  | "needs_review"
  | "approved"
  | "rejected"
  | "needs_update"
  | "archived";

export interface ContentTopicRow {
  id: string;
  knowledge_id: string;
  title: string;
  status: ContentTopicStatus;
  seo: Record<string, unknown>;
  brief: Record<string, unknown>;
  creative: Record<string, unknown>;
  publishing: Record<string, unknown>;
  knowledge_version: number;
  applicability_snapshot: KnowledgeApplicability | Record<string, unknown>;
  upstream_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentOutputRow {
  id: string;
  topic_id: string;
  output_kind: ContentOutputKind;
  status: ContentOutputStatus;
  title: string | null;
  body: string | null;
  structured: Record<string, unknown>;
  provenance: Record<string, unknown>;
  version: number;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}
