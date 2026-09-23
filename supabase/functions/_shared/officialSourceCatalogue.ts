/**
 * Official Source Catalogue — bounded official sections Filla may watch.
 *
 * Catalogue review finds sections. Coverage Watch detects new / changed /
 * withdrawn official guidance. News Watch detects developments that might
 * later affect guidance. Knowledge is created only after an authoritative
 * source supports actionable claims.
 *
 * A large GOV.UK service-result page is orientation only — never a source
 * and never the queue.
 */

export type CataloguePublisher = "gov.uk" | "hse" | "legislation.gov.uk" | "gov.scot";
export type CatalogueStatus = "proposed" | "accepted" | "paused";
export type CataloguePageStatus = "tracked" | "assessing" | "withdrawn" | "ignored";
export type CatalogueDetection =
  | "none"
  | "new_guidance"
  | "guidance_changed"
  | "potential_change"
  | "withdrawn";
export type CatalogueAdapter =
  | "govuk_search"
  | "govuk_content"
  | "path_prefix"
  | "collection_page";
export type CatalogueHitClass =
  | "compliance_guidance"
  | "property_relevant"
  | "news_lead"
  | "excluded"
  | "index_only";
export type CatalogueQueueLane = "monitoring" | "attention";

export type CatalogueLocator = {
  adapter: CatalogueAdapter;
  taxon_id?: string;
  organisation_slug?: string;
  path_prefixes: string[];
  /** Known official paths to track once the section is accepted — not Knowledge. */
  seed_paths?: string[];
  /** News Watch query. Hits are leads, never proof. */
  news_query?: string;
  /** Orientation-only seed (e.g. housing services). Never imported wholesale. */
  orientation_seed?: boolean;
  /** Canonical collection URL (e.g. Scottish Building Standards). */
  collection_url?: string;
  /** Human-facing active watch areas for Accept/Adjust. */
  watch_areas?: string[];
  /** Indexed for historical applicability — not routinely analysed. */
  index_only?: string[];
  /** Bounded change notice to prioritise sections (not a queue flood). */
  priority_change_notice?: string;
  /** Official warrant-date applicability rule (Scotland). */
  applicability_rule?: string;
};

export type OfficialCatalogueSection = {
  id: string;
  jurisdiction: string;
  publisher: CataloguePublisher;
  title: string;
  family: string;
  locator: CatalogueLocator;
  include_types: string[];
  exclude_types: string[];
  poll_interval_hours: number;
  subject_keys: string[];
};

export type CatalogueSearchHit = {
  title: string;
  description?: string;
  link: string;
  content_id?: string;
  public_timestamp?: string;
  document_type?: string;
  content_purpose_supergroup?: string;
  organisations?: string[];
};

export type CatalogueReviewReport = {
  seed_label: string;
  total_found: number;
  relevant_count: number;
  compliance_guidance_count: number;
  excluded_count: number;
  news_lead_count: number;
  recommended_section_ids: string[];
  recommended_watch_areas: string[];
  sample_size: number;
  source: "orientation" | "govuk_search";
  note: string;
  adapter_error?: string | null;
  generated_at?: string;
};

export const COVERAGE_INCLUDE_TYPES = [
  "guide",
  "guidance",
  "detailed_guide",
  "statutory_guidance",
  "document_collection",
  "publication",
  "official",
] as const;

export const COVERAGE_EXCLUDE_TYPES = [
  "transaction",
  "local_transaction",
  "answer",
  "smart_answer",
  "simple_smart_answer",
  "completed_transaction",
  "form",
  "place",
  "licence",
  "service_manual_guide",
  "finder",
] as const;

export const NEWS_WATCH_TYPES = [
  "news_article",
  "press_release",
  "speech",
  "consultation",
  "consultation_outcome",
  "government_response",
  "world_news_story",
  "fatality_notice",
] as const;

const PROPERTY_RELEVANT =
  /\b(landlord|landlords|renting|rented|tenanc|private.?rent|hmo|deposit|right to rent|gas safet|electrical|eicr|asbestos|epc|energy performance|mees|minimum energy|building regulation|approved document|planning permission|permitted development|fire safet|building safet|smoke alarm|carbon monoxide|legionella|hhsrs|accountable person)\b/i;

const COMPLIANCE_GUIDANCE =
  /\b(must|duty|duties|legal|statutor|regulation|approved document|safety standard|inspection|certificate required|responsible person|accountable person)\b/i;

const EXCLUDE_TOPIC =
  /\b(housing benefit|council housing|social housing|waiting list|rubbish|fly.?tip|abandoned vehicle|noise complaint|stamp duty|sdlt|land registry|help to buy|first homes|homeless|universal credit|find a home|apply for|report a|pay (your|for)|book a|council tax (bill|reduction|support))\b/i;

/**
 * Housing, local and community — GOV.UK taxon used only as an orientation seed.
 * Search API is unsupported; treat this id as replaceable.
 */
export const GOVUK_HOUSING_TAXON_ID = "4794066e-e3d2-4833-898b-52a2912c64b5";

export const ENGLAND_OFFICIAL_CATALOGUE: OfficialCatalogueSection[] = [
  {
    id: "england-landlord-renting",
    jurisdiction: "England",
    publisher: "gov.uk",
    title: "Landlord duties and renting",
    family: "Landlord duties and renting",
    locator: {
      adapter: "govuk_search",
      taxon_id: undefined,
      organisation_slug: "ministry-of-housing-communities-and-local-government",
      path_prefixes: [
        "/renting-out-a-property",
        "/private-renting",
        "/government/publications/how-to-let",
        "/government/publications/how-to-rent",
      ],
      seed_paths: ["/renting-out-a-property", "/private-renting"],
      news_query: "private rented sector landlord duties",
    },
    include_types: [...COVERAGE_INCLUDE_TYPES],
    exclude_types: [...COVERAGE_EXCLUDE_TYPES],
    poll_interval_hours: 24,
    subject_keys: [
      "landlord-duties",
      "smoke-carbon-monoxide-alarms",
      "before-heating-season",
    ],
  },
  {
    id: "england-building-regs",
    jurisdiction: "England",
    publisher: "gov.uk",
    title: "Building regulations and Approved Documents",
    family: "Building regulations and Approved Documents",
    locator: {
      adapter: "govuk_search",
      organisation_slug: "ministry-of-housing-communities-and-local-government",
      path_prefixes: [
        "/building-regulations",
        "/government/collections/approved-documents",
        "/guidance/building-regulations-and-approved-documents-index",
      ],
      seed_paths: [
        "/building-regulations",
        "/government/collections/approved-documents",
      ],
      news_query: "building regulations approved documents",
    },
    include_types: [...COVERAGE_INCLUDE_TYPES],
    exclude_types: [...COVERAGE_EXCLUDE_TYPES],
    poll_interval_hours: 24,
    subject_keys: ["building-regulations"],
  },
  {
    id: "england-planning-pd",
    jurisdiction: "England",
    publisher: "gov.uk",
    title: "Planning and permitted development",
    family: "Planning and permitted development",
    locator: {
      adapter: "govuk_search",
      path_prefixes: [
        "/planning-permission-england-wales",
        "/guidance/when-you-need-planning-permission",
        "/guidance/permitted-development-rights-for-householders",
      ],
      seed_paths: ["/planning-permission-england-wales"],
      news_query: "planning permission permitted development",
    },
    include_types: [...COVERAGE_INCLUDE_TYPES],
    exclude_types: [...COVERAGE_EXCLUDE_TYPES],
    poll_interval_hours: 24,
    subject_keys: ["planning-permission", "permitted-development"],
  },
  {
    id: "england-epc-energy",
    jurisdiction: "England",
    publisher: "gov.uk",
    title: "EPC and property energy standards",
    family: "EPC and property energy standards",
    locator: {
      adapter: "govuk_search",
      path_prefixes: [
        "/buy-sell-your-home/energy-performance-certificates",
        "/guidance/domestic-private-rented-property-minimum-energy-efficiency-standard-minimum-energy-efficiency-standard-mees",
      ],
      seed_paths: ["/buy-sell-your-home/energy-performance-certificates"],
      news_query: "energy performance certificate private rented MEES",
    },
    include_types: [...COVERAGE_INCLUDE_TYPES],
    exclude_types: [...COVERAGE_EXCLUDE_TYPES, "transaction"],
    poll_interval_hours: 24,
    subject_keys: ["energy-performance", "epc"],
  },
  {
    id: "england-hse-property-safety",
    jurisdiction: "England",
    publisher: "hse",
    title: "HSE property-safety guidance",
    family: "HSE property-safety guidance",
    locator: {
      adapter: "path_prefix",
      organisation_slug: "health-and-safety-executive",
      path_prefixes: ["/gas/landlords", "/gas/domestic", "/electricity", "/asbestos"],
      seed_paths: [
        "https://www.hse.gov.uk/gas/landlords/index.htm",
        "https://www.hse.gov.uk/asbestos/duty.htm",
      ],
      news_query: "HSE landlord gas electrical asbestos",
    },
    include_types: [...COVERAGE_INCLUDE_TYPES],
    exclude_types: [...COVERAGE_EXCLUDE_TYPES],
    poll_interval_hours: 24,
    subject_keys: ["before-heating-season", "electrical-safety", "asbestos"],
  },
  {
    id: "england-bsr",
    jurisdiction: "England",
    publisher: "gov.uk",
    title: "Building Safety Regulator guidance",
    family: "Building Safety Regulator guidance",
    locator: {
      adapter: "govuk_search",
      organisation_slug: "building-safety-regulator",
      path_prefixes: [
        "/government/organisations/building-safety-regulator",
        "/guidance/the-building-safety-act",
        "/guidance/manage-a-building-as-an-accountable-person",
      ],
      seed_paths: ["/government/organisations/building-safety-regulator"],
      news_query: "building safety regulator accountable person",
    },
    include_types: [...COVERAGE_INCLUDE_TYPES],
    exclude_types: [...COVERAGE_EXCLUDE_TYPES],
    poll_interval_hours: 24,
    subject_keys: ["building-safety"],
  },
];

export const ENGLAND_RECOMMENDED_CATALOGUE_IDS = ENGLAND_OFFICIAL_CATALOGUE.map(
  (s) => s.id
);

export const ENGLAND_HOUSING_ORIENTATION_REVIEW: CatalogueReviewReport = {
  seed_label: "Housing, local and community",
  total_found: 447,
  relevant_count: 38,
  compliance_guidance_count: 14,
  excluded_count: 312,
  news_lead_count: 0,
  recommended_section_ids: [...ENGLAND_RECOMMENDED_CATALOGUE_IDS],
  recommended_watch_areas: ENGLAND_OFFICIAL_CATALOGUE.map((s) => s.family),
  sample_size: 0,
  source: "orientation",
  note:
    "Service-result pages are orientation only — not a source and not the queue. Accepting the catalogue watches bounded official sections, it does not import the 447 results.",
};

/**
 * One bounded Scotland catalogue — the gov.scot Building Standards collection.
 * Accept watches current handbooks, supporting guidance, procedures, legislation
 * and consultations. Previous editions are indexed only; no wholesale PDF import.
 * https://www.gov.scot/collections/building-standards/
 */
export const SCOTLAND_BUILDING_STANDARDS_CATALOGUE: OfficialCatalogueSection = {
  id: "scotland-building-standards",
  jurisdiction: "Scotland",
  publisher: "gov.scot",
  title: "Scottish Building Standards",
  family: "Scottish Building Standards",
  locator: {
    adapter: "collection_page",
    collection_url: "https://www.gov.scot/collections/building-standards/",
    path_prefixes: [
      "/collections/building-standards",
      "/publications/",
      "/binaries/content/documents/govscot/publications",
    ],
    seed_paths: ["https://www.gov.scot/collections/building-standards/"],
    news_query: "building standards scotland consultation",
    watch_areas: [
      "Current domestic handbook",
      "Current non-domestic handbook",
      "Summary and notices of changes",
      "Supporting guidance for Sections 0–7",
      "Procedural and enforcement guidance",
      "Building-standards legislation",
    ],
    index_only: [
      "superseded handbooks",
      "archived supporting publications",
      "research reports",
      "specialist non-domestic material",
      "external tools and calculators",
    ],
    priority_change_notice:
      "April 2026 — General, Fire, Environment and Safety (traditional-building conversions, automatic fire suppression, flooding/groundwater, letterplate positioning)",
    applicability_rule:
      "Applicable regulations and guidance depend on the date of the building-warrant application; where no warrant is required, the date work commenced.",
  },
  include_types: [...COVERAGE_INCLUDE_TYPES, "consultation"],
  exclude_types: [...COVERAGE_EXCLUDE_TYPES, "calculator", "tool"],
  poll_interval_hours: 24,
  subject_keys: [
    "building-regulations",
    "building-standards",
    "scotland-building-standards",
  ],
};

export const SCOTLAND_RECOMMENDED_CATALOGUE_IDS = [
  SCOTLAND_BUILDING_STANDARDS_CATALOGUE.id,
] as const;

export type CatalogueProposalSource = "orientation" | "govuk_search" | "collection";

export type CatalogueProposal = {
  id: string;
  jurisdiction: string;
  title: string;
  summary: string;
  recommended_section_ids: string[];
  recommended_watch_areas: string[];
  index_note: string;
  potential_change_note: string;
  applicability_rule?: string;
  priority_change_notice?: string;
  collection_url?: string;
  source: CatalogueProposalSource;
};

export const SCOTLAND_BUILDING_STANDARDS_PROPOSAL: CatalogueProposal = {
  id: "scotland-building-standards",
  jurisdiction: "Scotland",
  title: "Scottish Building Standards",
  summary:
    "Official collection containing current and historical technical handbooks, supporting guidance, procedures and legislation.",
  recommended_section_ids: [...SCOTLAND_RECOMMENDED_CATALOGUE_IDS],
  recommended_watch_areas: [
    ...(SCOTLAND_BUILDING_STANDARDS_CATALOGUE.locator.watch_areas ?? []),
  ],
  index_note:
    "Previous editions will be indexed for historical applicability but not routinely processed.",
  potential_change_note:
    "Consultations will be monitored as Potential changes.",
  applicability_rule:
    SCOTLAND_BUILDING_STANDARDS_CATALOGUE.locator.applicability_rule,
  priority_change_notice:
    SCOTLAND_BUILDING_STANDARDS_CATALOGUE.locator.priority_change_notice,
  collection_url: SCOTLAND_BUILDING_STANDARDS_CATALOGUE.locator.collection_url,
  source: "collection",
};

export const ALL_OFFICIAL_CATALOGUE: OfficialCatalogueSection[] = [
  ...ENGLAND_OFFICIAL_CATALOGUE,
  SCOTLAND_BUILDING_STANDARDS_CATALOGUE,
];

export function catalogueSectionById(id: string): OfficialCatalogueSection | undefined {
  return ALL_OFFICIAL_CATALOGUE.find((s) => s.id === id);
}

/** April 2026 domestic handbook warrant trigger — first-class Scottish Knowledge shape. */
export function scotlandHandbookAppliesWhen(editionEffectiveDate: string): {
  jurisdiction: "Scotland";
  building_scope: "domestic";
  edition: string;
  applies_when: {
    warrant_submitted_on_or_after: string;
    or_unwarranted_work_commenced_on_or_after: string;
  };
} {
  return {
    jurisdiction: "Scotland",
    building_scope: "domestic",
    edition: editionEffectiveDate.startsWith("2026-04")
      ? "April 2026"
      : editionEffectiveDate,
    applies_when: {
      warrant_submitted_on_or_after: editionEffectiveDate,
      or_unwarranted_work_commenced_on_or_after: editionEffectiveDate,
    },
  };
}

/**
 * Classify a link title from the Scottish Building Standards collection.
 * Index-only items are tracked for historical lookup — never queue noise.
 */
export function classifyScottishBuildingStandardsHit(input: {
  title: string;
  link?: string;
}): CatalogueHitClass {
  const text = `${input.title} ${input.link ?? ""}`.toLowerCase();
  if (
    /\b(consultation|consultations|analysis of responses|blog|announcement)\b/.test(text)
  ) {
    return "news_lead";
  }
  if (
    /\b(previous edition|superseded|archived|research report|calculator|tool|excel)\b/.test(
      text
    )
  ) {
    return "index_only";
  }
  if (
    /\b(technical handbook|domestic|non-domestic|supporting guidance|building warrant|completion certificate|enforcement|verification|building \(scotland\) act|building regulations|procedure regulations)\b/.test(
      text
    )
  ) {
    return "compliance_guidance";
  }
  if (/\bbuilding standards?\b/.test(text)) return "property_relevant";
  return "excluded";
}

export function classifyCatalogueHit(hit: CatalogueSearchHit): CatalogueHitClass {
  const type = (hit.document_type ?? "").toLowerCase();
  const purpose = (hit.content_purpose_supergroup ?? "").toLowerCase();
  const text = `${hit.title} ${hit.description ?? ""} ${hit.link}`;

  if (
    NEWS_WATCH_TYPES.includes(type as (typeof NEWS_WATCH_TYPES)[number]) ||
    purpose === "news_and_communications"
  ) {
    if (EXCLUDE_TOPIC.test(text) || !PROPERTY_RELEVANT.test(text)) return "excluded";
    return "news_lead";
  }

  if (
    COVERAGE_EXCLUDE_TYPES.includes(type as (typeof COVERAGE_EXCLUDE_TYPES)[number]) ||
    purpose === "services" ||
    EXCLUDE_TOPIC.test(text) ||
    /find-energy-certificate|find-a-|report-|apply-|pay-/.test(hit.link)
  ) {
    return "excluded";
  }

  if (!PROPERTY_RELEVANT.test(text)) return "excluded";

  const isGuidanceType =
    COVERAGE_INCLUDE_TYPES.includes(type as (typeof COVERAGE_INCLUDE_TYPES)[number]) ||
    purpose === "guidance" ||
    type === "";

  if (isGuidanceType && COMPLIANCE_GUIDANCE.test(text)) return "compliance_guidance";
  if (isGuidanceType || PROPERTY_RELEVANT.test(text)) return "property_relevant";
  return "excluded";
}

export function recommendedWatchAreasFromHits(
  hits: CatalogueSearchHit[]
): string[] {
  const areas = new Set<string>();
  for (const hit of hits) {
    if (classifyCatalogueHit(hit) === "excluded") continue;
    const text = `${hit.title} ${hit.description ?? ""} ${hit.link}`.toLowerCase();
    if (/landlord|renting|tenanc|private rent|hmo|deposit|right to rent/.test(text)) {
      areas.add("Being a landlord");
    }
    if (/building regulation|approved document/.test(text)) {
      areas.add("Building regulations");
    }
    if (/planning permission|permitted development/.test(text)) {
      areas.add("Planning permission");
    }
    if (/energy performance|epc|mees|minimum energy/.test(text)) {
      areas.add("Energy performance");
    }
    if (/fire safet|building safet|accountable person/.test(text)) {
      areas.add("Building and fire safety");
    }
    if (/gas safet|electrical|asbestos|hse/.test(text)) {
      areas.add("HSE property safety");
    }
  }
  return ENGLAND_OFFICIAL_CATALOGUE.map((s) => s.family).filter((family) => {
    if (family === "Landlord duties and renting") return areas.has("Being a landlord");
    if (family === "Building regulations and Approved Documents") {
      return areas.has("Building regulations");
    }
    if (family === "Planning and permitted development") {
      return areas.has("Planning permission");
    }
    if (family === "EPC and property energy standards") return areas.has("Energy performance");
    if (family === "HSE property-safety guidance") return areas.has("HSE property safety");
    if (family === "Building Safety Regulator guidance") {
      return areas.has("Building and fire safety");
    }
    return false;
  });
}

export function buildCatalogueReviewReport(input: {
  hits: CatalogueSearchHit[];
  totalFound?: number;
  adapterError?: string | null;
  generatedAt?: string;
}): CatalogueReviewReport {
  const classes = input.hits.map(classifyCatalogueHit);
  const relevant = classes.filter((c) => c === "compliance_guidance" || c === "property_relevant");
  const compliance = classes.filter((c) => c === "compliance_guidance");
  const news = classes.filter((c) => c === "news_lead");
  const excluded = classes.filter((c) => c === "excluded");
  const areas = recommendedWatchAreasFromHits(input.hits);
  const recommendedIds = ENGLAND_OFFICIAL_CATALOGUE.filter((s) => areas.includes(s.family)).map(
    (s) => s.id
  );

  return {
    seed_label: "Housing, local and community",
    total_found: input.totalFound ?? input.hits.length,
    relevant_count: relevant.length,
    compliance_guidance_count: compliance.length,
    excluded_count: excluded.length,
    news_lead_count: news.length,
    recommended_section_ids:
      recommendedIds.length > 0 ? recommendedIds : [...ENGLAND_RECOMMENDED_CATALOGUE_IDS],
    recommended_watch_areas:
      areas.length > 0 ? areas : ENGLAND_OFFICIAL_CATALOGUE.map((s) => s.family),
    sample_size: input.hits.length,
    source: "govuk_search",
    note:
      "Service-result pages are orientation only — not a source and not the queue. Accepting the catalogue watches bounded official sections.",
    adapter_error: input.adapterError ?? null,
    generated_at: input.generatedAt,
  };
}

export function queueLaneForCatalogueDetection(input: {
  kind: CatalogueDetection;
  affectedKnowledgeIds: string[];
  isImportantNewSubject?: boolean;
  hasConflictingSources?: boolean;
  needsApplicabilityDecision?: boolean;
}): CatalogueQueueLane {
  if (input.hasConflictingSources || input.needsApplicabilityDecision) return "attention";
  if (input.kind === "potential_change" || input.kind === "none") return "monitoring";
  if (input.kind === "new_guidance" && !input.isImportantNewSubject) return "monitoring";
  if (input.kind === "guidance_changed" && input.affectedKnowledgeIds.length > 0) {
    return "attention";
  }
  if (input.kind === "withdrawn" && input.affectedKnowledgeIds.length > 0) return "attention";
  if (input.isImportantNewSubject) return "attention";
  return "monitoring";
}

/** News and consultations are leads. They must never rewrite Knowledge. */
export function shouldCreateKnowledgeFromDetection(_kind: CatalogueDetection): boolean {
  return false;
}

export function shouldFetchCataloguePageBody(input: {
  previous: {
    content_id?: string | null;
    public_updated_at?: string | null;
    section_hash?: string | null;
  } | null;
  next: { content_id?: string | null; public_updated_at?: string | null };
}): boolean {
  const prev = input.previous;
  if (!prev) return false;
  if (prev.content_id && input.next.content_id && prev.content_id !== input.next.content_id) {
    return true;
  }
  if (
    prev.public_updated_at &&
    input.next.public_updated_at &&
    prev.public_updated_at !== input.next.public_updated_at
  ) {
    return true;
  }
  if (!prev.public_updated_at && input.next.public_updated_at) return true;
  return false;
}

/** FNV-1a — change detection only, not a security hash. */
export function hashRelevantSections(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function extractRelevantSectionText(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  const row = content as Record<string, unknown>;
  const details =
    row.details && typeof row.details === "object" && !Array.isArray(row.details)
      ? (row.details as Record<string, unknown>)
      : {};
  const parts: string[] = [];
  if (typeof row.title === "string") parts.push(row.title);
  if (typeof details.body === "string") parts.push(details.body);
  if (Array.isArray(details.parts)) {
    for (const part of details.parts) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (typeof p.title === "string") parts.push(p.title);
      if (typeof p.body === "string") parts.push(p.body);
    }
  }
  return parts.join("\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function canonicalCataloguePath(link: string): string {
  const trimmed = link.trim();
  if (!trimmed) return "";
  try {
    const url = trimmed.startsWith("http") ? new URL(trimmed) : new URL(trimmed, "https://www.gov.uk");
    return url.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return trimmed.startsWith("/") ? trimmed.replace(/\/+$/, "") || "/" : `/${trimmed}`;
  }
}

export function cataloguePageUrl(section: OfficialCatalogueSection, pathOrUrl: string): string {
  if (pathOrUrl.startsWith("https://")) return pathOrUrl;
  const path = canonicalCataloguePath(pathOrUrl);
  if (section.publisher === "hse") return `https://www.hse.gov.uk${path}`;
  if (section.publisher === "legislation.gov.uk") return `https://www.legislation.gov.uk${path}`;
  if (section.publisher === "gov.scot") return `https://www.gov.scot${path}`;
  return `https://www.gov.uk${path}`;
}

export function formatPotentialChangeCopy(input: {
  title: string;
  announcedOn?: string | null;
  relatedKnowledge?: string[];
}): { headline: string; body: string; action: string } {
  const when = input.announcedOn
    ? ` announced proposed changes on ${input.announcedOn}.`
    : " announced a development.";
  const related =
    input.relatedKnowledge && input.relatedKnowledge.length > 0
      ? `Related Knowledge: ${input.relatedKnowledge.join(", ")}. `
      : "";
  return {
    headline: `Potential change: ${input.title}`,
    body: `${input.title}${when} No enacted legislation or updated operational guidance was found. ${related}Current guidance remains valid.`,
    action: "Filla will monitor the linked consultation, legislation and guidance pages.",
  };
}

export function formatMaterialChangeCopy(input: {
  affectedClaimCount: number;
}): string {
  const n = input.affectedClaimCount;
  if (n <= 0) {
    return "Official guidance changed. No accepted claims are linked yet — keeping this in Monitoring.";
  }
  return `Official guidance changed in a way that may alter ${n} accepted claim${n === 1 ? "" : "s"}.`;
}

export function detectionFromHitClass(
  klass: CatalogueHitClass,
  alreadyTracked: boolean
): CatalogueDetection {
  if (klass === "news_lead") return "potential_change";
  if (klass === "excluded" || klass === "index_only") return "none";
  if (alreadyTracked) return "none";
  return "new_guidance";
}
