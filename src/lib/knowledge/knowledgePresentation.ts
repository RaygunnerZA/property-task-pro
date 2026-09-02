/**
 * Canonical Knowledge review presentation + gate helpers.
 * Used by Review list, Ready to publish, and Open review detail.
 */

import type {
  KnowledgeApplicability,
  KnowledgeRow,
  KnowledgeSourceKind,
} from "@/types/knowledge";
import {
  assessGuidanceQuality,
  formatCriticField,
} from "@/lib/knowledge/knowledgeGuidanceQuality";

export type TrustCheckStatus =
  | "passed"
  | "failed"
  | "incomplete"
  | "not_run"
  | "required";

export type TrustCheckId =
  | "guidance"
  | "source_authority"
  | "source_freshness"
  | "applicability"
  | "classification"
  | "trigger"
  | "contradiction"
  | "human";

export type TrustCheck = {
  id: TrustCheckId;
  label: string;
  status: TrustCheckStatus;
  detail?: string;
  /** Optional UI anchor for editable fields */
  fieldHint?: "guidance" | "sources" | "applicability" | "critic" | "human";
};

export type KnowledgeSourcePreview = {
  id?: string;
  label?: string | null;
  url?: string | null;
  source_type?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type SourceHealthItem = {
  id?: string;
  title: string;
  publisher: string | null;
  authorityType: string;
  url: string | null;
  lastCheckedIso: string | null;
  lastCheckedLabel: string | null;
  freshness: "current" | "stale" | "unknown";
  isAuthoritative: boolean;
  isIntakeProvenance: boolean;
};

export type CriticSummary = {
  status: "passed" | "failed" | "not_run" | "stale";
  resultLabel: string;
  /** Human-facing banner when guidance/fields changed since last critic. */
  staleMessage: string | null;
  claimsChecked: string | null;
  sourceAlignment: string | null;
  applicabilityConcerns: string | null;
  contradictions: string | null;
  requiredCorrections: string | null;
  rawNotes: string | null;
  ranAt: string | null;
  /** True when a completed critic result matches the current content fingerprint. */
  isCurrent: boolean;
};

export type KnowledgeOpportunity = {
  id: string;
  label: string;
  reason: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,;|]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

/** Spreadsheet row / cell refs must never become guidance or URLs. */
export function looksLikeRowNumberOrCellRef(value: string): boolean {
  const t = value.trim();
  if (/^\d{1,6}$/.test(t)) return true;
  if (/^[A-Za-z]{1,3}\d{1,6}$/.test(t)) return true;
  if (/^row\s*\d+$/i.test(t)) return true;
  return false;
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Legacy non-empty prose gate (IDs/URLs/fragments fail). Prefer assessGuidanceQuality. */
export function isMeaningfulGuidanceText(value: string | null | undefined): boolean {
  const t = (value ?? "").trim();
  if (t.length < 12) return false;
  if (looksLikeRowNumberOrCellRef(t)) return false;
  if (/^https?:\/\//i.test(t)) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(t)) return false;
  return true;
}

export function looksLikeKnowledgeCode(title: string): boolean {
  const t = title.trim();
  if (t.length < 6 || t.length > 48) return false;
  return /^[A-Z0-9]+(?:-[A-Z0-9]+){1,5}$/.test(t);
}

export function parseApplicability(
  raw: KnowledgeRow["applicability"]
): KnowledgeApplicability {
  const record = asRecord(raw);
  return {
    jurisdictions: asStringList(record.jurisdictions),
    regions: asStringList(record.regions),
    languages: asStringList(record.languages),
    audiences: asStringList(record.audiences) as KnowledgeApplicability["audiences"],
    unscoped: record.unscoped === true,
  };
}

export function attrString(
  attributes: Record<string, unknown> | undefined | null,
  key: string
): string | null {
  return asString(asRecord(attributes)[key]);
}

export function displayKnowledgeTitle(
  row: Pick<KnowledgeRow, "title" | "summary" | "attributes">
): string {
  const title = row.title?.trim() || "Untitled";
  if (!looksLikeKnowledgeCode(title)) return title;

  const attrs = asRecord(row.attributes);
  const fromAttrs =
    asString(attrs.task) ||
    asString(attrs.title) ||
    asString(attrs.name) ||
    asString(attrs.category);
  if (fromAttrs && !looksLikeRowNumberOrCellRef(fromAttrs)) return fromAttrs;

  const summary = row.summary?.trim();
  if (summary && isMeaningfulGuidanceText(summary)) {
    const first = summary.split(/[.?\n]/)[0]?.trim();
    if (first && first.length >= 8 && first.length <= 120) return first;
  }

  return title;
}

/** Guidance for humans — never row numbers; never invent text. */
export function displayKnowledgeGuidance(
  row: Pick<KnowledgeRow, "summary" | "body" | "attributes" | "provenance">
): string {
  for (const candidate of [
    row.summary,
    row.body,
    attrString(row.attributes, "action"),
    attrString(row.attributes, "notes"),
  ]) {
    if (candidate && isMeaningfulGuidanceText(candidate)) {
      return candidate.length > 420 ? `${candidate.slice(0, 417)}…` : candidate;
    }
  }
  return "No guidance written yet.";
}

export function isGuidanceDraft(
  row: Pick<KnowledgeRow, "provenance">
): boolean {
  const draft = asRecord(asRecord(row.provenance).guidance_draft);
  return draft.unverified === true;
}

export function guidanceDraftLabel(
  row: Pick<KnowledgeRow, "provenance">
): string | null {
  if (!isGuidanceDraft(row)) return null;
  const draft = asRecord(asRecord(row.provenance).guidance_draft);
  const source = asString(draft.source);
  const label = asString(draft.label);
  if (label) return label;
  if (source === "ai") return "AI-proposed draft";
  if (source?.startsWith("imported")) return "Imported draft";
  return "Draft";
}

export function formatApplicabilityLine(app: KnowledgeApplicability): string {
  const parts: string[] = [];
  if (app.unscoped) parts.push("Unscoped (global)");
  if (app.jurisdictions.length) parts.push(app.jurisdictions.join(" · "));
  if (app.regions.length) parts.push(app.regions.join(" · "));
  if (app.audiences.length) parts.push(app.audiences.join(" · "));
  return parts.join(" · ") || "Applicability not set";
}

/** Presentation type vs legal classification — separate axes. */
export function presentationTypeLabel(
  row: Pick<KnowledgeRow, "attributes">
): string {
  const category = attrString(row.attributes, "category");
  if (category && !/mandatory|statutory/i.test(category)) return category;
  return "Guidance";
}

export function legalClassificationLabel(
  row: Pick<KnowledgeRow, "attributes">
): string {
  const legal =
    attrString(row.attributes, "legal_status") ||
    attrString(row.attributes, "classification");
  if (!legal) return "Classification not set";
  if (/mandatory|required|statutory|obligation/i.test(legal)) {
    return "Mandatory requirement";
  }
  if (/contract|insurance/i.test(legal)) {
    return "Contractual or insurance requirement";
  }
  if (/recommend|good practice|advisory|prevent/i.test(legal)) {
    return "Preventative good practice";
  }
  return legal;
}

export function triggerLabel(row: Pick<KnowledgeRow, "attributes">): string {
  const when =
    attrString(row.attributes, "applies_when") ||
    attrString(row.attributes, "timing") ||
    attrString(row.attributes, "frequency") ||
    "";
  if (/before|prior|pre-work|consent|notice|when (planning|starting)/i.test(when)) {
    return "Event-driven";
  }
  if (/annual|yearly|monthly|quarter|every\s+\d|recurring|schedule/i.test(when)) {
    return "Scheduled";
  }
  if (/threshold|exceed|above|below|limit/i.test(when)) {
    return "Threshold-based";
  }
  if (/ongoing|continuous|always|at all times|maintain/i.test(when)) {
    return "Continuous";
  }
  if (attrString(row.attributes, "frequency")) return "Scheduled";
  return "Trigger not set";
}

/** @deprecated Prefer presentationTypeLabel + legalClassificationLabel */
export function classificationLabel(
  row: Pick<KnowledgeRow, "attributes" | "source_kind">
): string {
  return legalClassificationLabel(row);
}

export function sourceKindLabel(kind: KnowledgeSourceKind): string {
  switch (kind) {
    case "filla_curated":
      return "Filla curated";
    case "org_upload":
      return "Organisation upload";
    case "operational_discovery":
      return "Operational discovery";
    case "community_brain":
      return "Community brain";
    default:
      return kind;
  }
}

function daysAgoLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const days = Math.max(0, Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24)));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function formatCheckedDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function titleFromGovUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const slug = u.pathname.split("/").filter(Boolean).pop() || "";
    if (/gov\.uk|service-public\.fr|legifrance|nidirect/i.test(host) && slug) {
      const pretty = decodeURIComponent(slug)
        .replace(/[-_]+/g, " ")
        .replace(/\.[a-z]+$/i, "");
      if (pretty.length > 8) {
        return pretty.charAt(0).toUpperCase() + pretty.slice(1);
      }
    }
    return null;
  } catch {
    return null;
  }
}

function authorityTypeFor(url: string | null, sourceType: string | null): string {
  if (!url) {
    if ((sourceType || "").includes("attachment")) return "Intake workbook";
    return "Unclassified";
  }
  const host = domainFromUrl(url) || "";
  if (/gov\.uk|service-public\.fr|legifrance\.gouv\.fr|nidirect\.gov/i.test(host)) {
    return "Official guidance";
  }
  if (/\.gov\./i.test(host) || /gouv\.fr/i.test(host)) return "Official guidance";
  return "Reference";
}

function publisherFor(url: string | null): string | null {
  if (!url) return null;
  const host = domainFromUrl(url);
  if (!host) return null;
  if (host.includes("gov.uk")) return "GOV.UK";
  if (host.includes("service-public.fr")) return "Service-Public.fr";
  if (host.includes("legifrance")) return "Légifrance";
  if (host.includes("nidirect")) return "nidirect";
  return host;
}

function isSpreadsheetLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  return /\.(xlsx|xls|csv)$/i.test(label) || /spreadsheet/i.test(label);
}

/**
 * Canonical source health for list + detail. Authoritative = valid http(s) URL.
 * Spreadsheet attachment is intake provenance, not the authority.
 */
export function computeSourceHealth(
  sources: KnowledgeSourcePreview[],
  row: Pick<KnowledgeRow, "provenance" | "updated_at" | "created_at" | "title">
): {
  authoritative: SourceHealthItem[];
  intakeProvenance: SourceHealthItem[];
  summaryLine: string;
} {
  const provenance = asRecord(row.provenance);
  const intake = asRecord(provenance.intake_provenance);
  const authoritative: SourceHealthItem[] = [];
  const intakeProvenance: SourceHealthItem[] = [];

  for (const s of sources) {
    const url = asString(s.url);
    const validUrl = url && isValidHttpUrl(url) ? url : null;
    const meta = asRecord(s.metadata);
    const reviewed =
      asString(meta.reviewed_date) ||
      asString(intake.reviewed_date) ||
      asString(provenance.critic_at) ||
      s.created_at ||
      null;
    const reviewedIso = reviewed
      ? /^\d{4}-\d{2}-\d{2}/.test(reviewed)
        ? new Date(reviewed).toISOString()
        : s.created_at || null
      : s.created_at || null;

    const label = asString(s.label);
    const spreadsheet = isSpreadsheetLabel(label) || (s.source_type || "").includes("attachment");

    if (validUrl) {
      const title =
        (!spreadsheet && label) ||
        titleFromGovUrl(validUrl) ||
        publisherFor(validUrl) ||
        "Official source";
      const ageDays = reviewedIso
        ? Math.floor((Date.now() - new Date(reviewedIso).getTime()) / 86400000)
        : null;
      authoritative.push({
        id: s.id,
        title,
        publisher: publisherFor(validUrl),
        authorityType: authorityTypeFor(validUrl, s.source_type),
        url: validUrl,
        lastCheckedIso: reviewedIso,
        lastCheckedLabel: formatCheckedDate(reviewedIso),
        freshness: ageDays == null ? "unknown" : ageDays > 365 ? "stale" : "current",
        isAuthoritative: true,
        isIntakeProvenance: false,
      });
    }

    if (spreadsheet || ((s.source_type || "").includes("attachment") && !validUrl)) {
      intakeProvenance.push({
        id: s.id,
        title: label || "Intake workbook",
        publisher: null,
        authorityType: "Intake workbook",
        url: null,
        lastCheckedIso: s.created_at || null,
        lastCheckedLabel: formatCheckedDate(s.created_at || null),
        freshness: "unknown",
        isAuthoritative: false,
        isIntakeProvenance: true,
      });
    }
  }

  // Provenance URL without a source row
  const orphanUrl = asString(intake.source_url) || asString(provenance.source_url);
  if (orphanUrl && isValidHttpUrl(orphanUrl) && !authoritative.some((a) => a.url === orphanUrl)) {
    authoritative.push({
      title: titleFromGovUrl(orphanUrl) || publisherFor(orphanUrl) || "Official source",
      publisher: publisherFor(orphanUrl),
      authorityType: authorityTypeFor(orphanUrl, "url"),
      url: orphanUrl,
      lastCheckedIso: row.updated_at || null,
      lastCheckedLabel: formatCheckedDate(row.updated_at || null),
      freshness: "unknown",
      isAuthoritative: true,
      isIntakeProvenance: false,
    });
  }

  const summaryLine =
    authoritative.length === 0
      ? "No authoritative sources linked"
      : authoritative.length === 1
        ? `${authoritative[0]!.title}${
            authoritative[0]!.publisher ? ` · ${authoritative[0]!.publisher}` : ""
          }`
        : `${authoritative.length} authoritative sources`;

  return { authoritative, intakeProvenance, summaryLine };
}

export function sourcesSummaryLine(
  sources: KnowledgeSourcePreview[],
  row: Pick<KnowledgeRow, "provenance" | "updated_at" | "created_at" | "title">
): string {
  return computeSourceHealth(sources, row).summaryLine;
}

function jurisdictionNeedsSubdivision(
  app: KnowledgeApplicability,
  attrs: Record<string, unknown>
): string | null {
  if (app.unscoped) return null;
  if (app.jurisdictions.length === 0) return "Country or jurisdiction required.";

  const joined = app.jurisdictions.join(" ").toLowerCase();
  const regionText = app.regions.join(" ").toLowerCase();
  const hasUkNation = /england|wales|scotland|northern ireland|great britain|\bgb\b|gb-eng|gb-wls|gb-sct|gb-nir|uk-eng/i.test(
    joined + " " + regionText
  );
  const mentionsUk =
    /\buk\b|united kingdom|britain/i.test(joined) &&
    !/england|wales|scotland|northern ireland|great britain|\bgb\b|gb-eng|gb-wls|gb-sct|gb-nir/i.test(
      joined
    );

  if (mentionsUk && !hasUkNation && app.regions.length === 0) {
    return "UK nation required (England, Wales, Scotland, Northern Ireland, or Great Britain).";
  }

  const mentionsFr = /\bfr\b|france|french/i.test(joined);
  const localVar = attrString(attrs, "local_variation") || "";
  const when = attrString(attrs, "applies_when") || "";
  const indicatesLocal = /lookup|local.?authority|department|commune|spanc|mapped|varies locally|autorité/i.test(
    `${localVar} ${when} ${regionText}`
  );
  const documentsLookup =
    localVar.trim().length >= 8 &&
    /lookup|local|department|commune|spanc|authority|autorité|mairie/i.test(localVar);

  // France: country alone is fine for national rules; when Knowledge indicates
  // local variation, require regions or documented apply-time lookup.
  if (mentionsFr && indicatesLocal && app.regions.length === 0 && !documentsLookup) {
    return "Local-authority lookup required before this guidance can be applied.";
  }

  return null;
}

export function parseCriticSummary(
  row: KnowledgeRow,
  verificationEvents?: Array<{
    event_type: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>,
  opts?: { sources?: KnowledgeSourcePreview[] }
): CriticSummary {
  const provenance = asRecord(row.provenance);
  const structured = asRecord(provenance.critic_result);
  const criticAt = asString(provenance.critic_at);
  const notes = asString(provenance.critic_notes);
  const criticStatus = asString(provenance.critic_status);
  const event = (verificationEvents || []).find((e) => e.event_type === "critic");
  // opts.sources reserved for future fingerprint checks; status/timestamp are authoritative in UI.
  void opts;

  const empty: CriticSummary = {
    status: "not_run",
    resultLabel: "Not run",
    staleMessage: null,
    claimsChecked: null,
    sourceAlignment: null,
    applicabilityConcerns: null,
    contradictions: null,
    requiredCorrections: null,
    rawNotes: null,
    ranAt: null,
    isCurrent: false,
  };

  const unavailable =
    /critic unavailable|default trust retained|no eligible strategy|no_ai_provider/i.test(
      notes || ""
    ) || criticStatus === "unavailable";

  const staleByStatus =
    criticStatus === "stale_after_guidance_edit" ||
    criticStatus === "stale" ||
    criticStatus === "stale_after_field_edit";

  // Legacy: draft guidance proposed after critic_at while still unverified.
  const draft = asRecord(provenance.guidance_draft);
  const draftAt = asString(draft.proposed_at);
  const draftAfterCritic =
    Boolean(criticAt) &&
    Boolean(draftAt) &&
    new Date(draftAt).getTime() > new Date(criticAt!).getTime() &&
    draft.unverified === true;

  const isStale = staleByStatus || draftAfterCritic;

  if ((!criticAt && !event) || unavailable) {
    return {
      ...empty,
      requiredCorrections: unavailable
        ? "Run the critic before verification."
        : null,
      rawNotes: unavailable ? notes : null,
      ranAt: criticAt,
    };
  }

  if (isStale) {
    return {
      status: "stale",
      resultLabel: "Not run",
      staleMessage: "Guidance changed since the last critic review.",
      claimsChecked: null,
      sourceAlignment: null,
      applicabilityConcerns: null,
      contradictions: null,
      requiredCorrections: "Run the critic on the current guidance before verification.",
      rawNotes: notes,
      ranAt: criticAt || event?.created_at || null,
      isCurrent: false,
    };
  }

  // Legacy critic runs (pre-gate) often auto-verified on trust_score / prose praise.
  const praiseOnly =
    /enhancing its credibility|well-structured|writing quality|provenance indicates/i.test(
      notes || ""
    );
  const explicitPass =
    provenance.critic_passed === true || structured.verified === true;
  const explicitFail =
    provenance.critic_passed === false || structured.verified === false;

  if (!explicitPass && !explicitFail) {
    return {
      ...empty,
      requiredCorrections:
        "Critic must evaluate claims against linked sources. Re-run the critic before verification.",
      rawNotes: notes,
      ranAt: criticAt,
    };
  }

  if (praiseOnly && !explicitFail) {
    return {
      ...empty,
      requiredCorrections: "Re-run the critic against linked official sources.",
      rawNotes: notes,
      ranAt: criticAt || event?.created_at || null,
    };
  }

  const claimsChecked = formatCriticField(
    asString(structured.claims_checked) || asString(structured.claimsChecked)
  );
  const sourceAlignment = formatCriticField(
    asString(structured.source_alignment) || asString(structured.sourceAlignment)
  );
  const applicabilityConcerns = formatCriticField(
    asString(structured.applicability_concerns) ||
      asString(structured.applicabilityConcerns)
  );
  const requiredCorrections = formatCriticField(
    asString(structured.required_corrections) ||
      asString(structured.requiredCorrections)
  );

  if (explicitFail) {
    return {
      status: "failed",
      resultLabel: "Failed",
      staleMessage: null,
      claimsChecked,
      sourceAlignment,
      applicabilityConcerns,
      contradictions:
        formatCriticField(asString(structured.contradictions)) ||
        formatCriticField(notes) ||
        null,
      requiredCorrections:
        requiredCorrections || "Address critic findings, then re-run the critic.",
      rawNotes: notes,
      ranAt: criticAt || event?.created_at || null,
      isCurrent: true,
    };
  }

  const contradictions =
    formatCriticField(asString(structured.contradictions)) ||
    "No contradictions found.";

  return {
    status: "passed",
    resultLabel: "Passed",
    staleMessage: null,
    claimsChecked,
    sourceAlignment,
    applicabilityConcerns,
    contradictions,
    requiredCorrections,
    rawNotes: notes,
    ranAt: criticAt || event?.created_at || null,
    isCurrent: true,
  };
}

export function buildTrustChecks(
  row: KnowledgeRow,
  opts?: {
    sources?: KnowledgeSourcePreview[];
    verificationEvents?: Array<{
      event_type: string;
      payload: Record<string, unknown>;
      created_at: string;
    }>;
  }
): TrustCheck[] {
  const app = parseApplicability(row.applicability);
  const attrs = asRecord(row.attributes);
  const sources = opts?.sources ?? [];
  const health = computeSourceHealth(sources, row);
  const critic = parseCriticSummary(row, opts?.verificationEvents, { sources });

  const quality = assessGuidanceQuality(row);
  const guidanceOk =
    quality.state === "meaningful_draft" || quality.state === "verified";

  const hasAuth = health.authoritative.length > 0;
  const freshnessOk =
    hasAuth &&
    health.authoritative.every((s) => s.freshness !== "stale");

  let applicabilityDetail = formatApplicabilityLine(app);
  let applicabilityStatus: TrustCheckStatus = "incomplete";

  if (app.unscoped === true) {
    applicabilityStatus = "passed";
  } else if (app.jurisdictions.length === 0) {
    applicabilityStatus = "incomplete";
    applicabilityDetail = "Country or jurisdiction required.";
  } else if (
    app.jurisdictions.some((j) => /^(all|any|global|worldwide)$/i.test(j.trim()))
  ) {
    applicabilityStatus = "incomplete";
    applicabilityDetail =
      "Jurisdiction missing — All/Any is not valid for country-specific rules.";
  } else {
    const sub = jurisdictionNeedsSubdivision(app, attrs);
    const localVar = attrString(attrs, "local_variation") || "";
    if (sub) {
      applicabilityStatus = "incomplete";
      applicabilityDetail = sub;
    } else if (
      localVar.trim().length >= 8 &&
      /lookup|local|department|commune|spanc|authority/i.test(localVar)
    ) {
      applicabilityStatus = "passed";
      applicabilityDetail = `${formatApplicabilityLine(app)} · Local confirmation at apply time`;
    } else {
      applicabilityStatus = "passed";
    }
  }

  const humanEvent = (opts?.verificationEvents || []).some(
    (e) => e.event_type === "human_approve" && Boolean(e.actor_id)
  );
  const humanDone =
    (row.status === "verified" || row.status === "published") &&
    (Boolean(row.reviewed_by) || humanEvent);

  const contradictionStatus: TrustCheckStatus =
    critic.status === "not_run" || critic.status === "stale"
      ? "not_run"
      : critic.status === "failed"
        ? "failed"
        : "passed";

  const legalStatus =
    attrString(attrs, "legal_status") ||
    attrString(attrs, "classification") ||
    "";
  const classificationOk =
    Boolean(legalStatus.trim()) && !/not set|unknown|n\/?a/i.test(legalStatus);
  const triggerBlob = `${attrString(attrs, "applies_when") || ""} ${attrString(attrs, "timing") || ""} ${attrString(attrs, "frequency") || ""}`;
  const triggerOk = Boolean(
    attrString(attrs, "trigger_type") ||
      attrString(attrs, "event_trigger") ||
      (/before|prior|annual|year|month|quarter|every|schedule|threshold|ongoing|continuous|always|maintain|when |after |present|planned/i.test(
        triggerBlob
      ) ||
        Boolean(triggerBlob.trim()))
  );

  const guidanceDetail =
    quality.state === "missing"
      ? "Canonical summary or body required."
      : quality.state === "needs_improvement"
        ? quality.reasons[0] || "Guidance needs improvement before critic."
        : undefined;

  const checks: TrustCheck[] = [
    {
      id: "guidance",
      label: "Guidance text",
      status: guidanceOk ? "passed" : "incomplete",
      detail: guidanceDetail,
      fieldHint: "guidance",
    },
    {
      id: "source_authority",
      label: "Source authority",
      status: hasAuth ? "passed" : "incomplete",
      detail: hasAuth
        ? health.summaryLine
        : "Link at least one authoritative http(s) source. Workbook files are intake provenance only.",
      fieldHint: "sources",
    },
    {
      id: "source_freshness",
      label: "Source freshness",
      status: !hasAuth ? "incomplete" : freshnessOk ? "passed" : "failed",
      detail: !hasAuth
        ? "Requires an authoritative source first."
        : freshnessOk
          ? health.authoritative[0]?.lastCheckedLabel
            ? `Last checked ${health.authoritative[0]!.lastCheckedLabel}`
            : "Current"
          : "One or more sources are older than 12 months — re-check before publish.",
      fieldHint: "sources",
    },
    {
      id: "applicability",
      label: "Applicability",
      status: applicabilityStatus,
      detail: applicabilityDetail,
      fieldHint: "applicability",
    },
    {
      id: "classification",
      label: "Classification",
      status: classificationOk ? "passed" : "incomplete",
      detail: classificationOk
        ? legalStatus
        : "legal_status / classification required from imported fields.",
      fieldHint: "applicability",
    },
    {
      id: "trigger",
      label: "Trigger",
      status: triggerOk ? "passed" : "incomplete",
      detail: triggerOk
        ? attrString(attrs, "trigger_type") ||
          attrString(attrs, "frequency") ||
          attrString(attrs, "applies_when") ||
          undefined
        : "frequency / timing / applies_when required to set trigger.",
      fieldHint: "applicability",
    },
    {
      id: "contradiction",
      label: "Contradiction check",
      status: contradictionStatus,
      detail:
        critic.status === "stale"
          ? critic.staleMessage ||
            "Guidance changed since the last critic review."
          : contradictionStatus === "not_run"
            ? "Critic unavailable or not run. Run the critic before verification."
            : critic.contradictions || critic.rawNotes || undefined,
      fieldHint: "critic",
    },
    {
      id: "human",
      label: "Human verification",
      status: humanDone ? "passed" : "required",
      detail: humanDone
        ? "Verified by a platform admin."
        : "Explicit human verify is required after checks pass.",
      fieldHint: "human",
    },
  ];

  return checks;
}

export function statusLabel(status: TrustCheckStatus): string {
  switch (status) {
    case "passed":
      return "Passed";
    case "failed":
      return "Failed";
    case "not_run":
      return "Not run";
    case "required":
      return "Required";
    default:
      return "Incomplete";
  }
}

const VERIFY_BLOCKING: TrustCheckId[] = [
  "guidance",
  "source_authority",
  "source_freshness",
  "applicability",
  "classification",
  "trigger",
  "contradiction",
];

const PUBLISH_BLOCKING: TrustCheckId[] = [
  "guidance",
  "source_authority",
  "source_freshness",
  "applicability",
  "classification",
  "trigger",
  "contradiction",
  "human",
];

function isBlockingStatus(status: TrustCheckStatus): boolean {
  return status === "failed" || status === "incomplete" || status === "not_run" || status === "required";
}

export function blockingChecksForVerify(checks: TrustCheck[]): TrustCheck[] {
  return checks.filter(
    (c) => VERIFY_BLOCKING.includes(c.id) && isBlockingStatus(c.status)
  );
}

export function blockingChecksForPublish(checks: TrustCheck[]): TrustCheck[] {
  return checks.filter(
    (c) => PUBLISH_BLOCKING.includes(c.id) && isBlockingStatus(c.status)
  );
}

export function canVerify(row: KnowledgeRow, checks: TrustCheck[]): boolean {
  return row.status === "candidate" && blockingChecksForVerify(checks).length === 0;
}

export function canPublish(row: KnowledgeRow, checks: TrustCheck[]): boolean {
  return (
    row.status === "verified" &&
    Boolean(row.reviewed_by) &&
    blockingChecksForPublish(checks).length === 0
  );
}

export function isPublicationReady(row: KnowledgeRow, checks: TrustCheck[]): boolean {
  return row.status === "verified" && canPublish(row, checks);
}

export function trustChecksSummary(checks: TrustCheck[]): string {
  const blocking = checks.filter((c) => isBlockingStatus(c.status));
  if (!blocking.length) return "Ready for human verify";
  return blocking.map((c) => `${statusLabel(c.status)} — ${c.label}`).slice(0, 3).join(" · ");
}

export function deriveOpportunities(row: KnowledgeRow): KnowledgeOpportunity[] {
  const legal = legalClassificationLabel(row);
  const trigger = triggerLabel(row);
  const evidence = attrString(row.attributes, "evidence");
  const localVar = attrString(row.attributes, "local_variation") || "";
  const when = attrString(row.attributes, "applies_when") || "";
  const title = displayKnowledgeTitle(row).toLowerCase();
  const out: KnowledgeOpportunity[] = [];

  const add = (id: string, label: string, reason: string) => {
    if (!out.some((o) => o.id === id)) out.push({ id, label, reason });
  };

  if (trigger === "Event-driven") {
    add("prework", "Create pre-work protection check", "Event-driven requirement");
    add("consent", "Create consent/notice evidence checklist", "Triggered before work starts");
  } else if (trigger === "Scheduled") {
    const freq = attrString(row.attributes, "frequency") || "its stated interval";
    add("recurring", `Create recurring task template (${freq})`, "Scheduled requirement");
  } else if (trigger === "Continuous") {
    add("monitor", "Create inspection or monitoring guidance", "Continuous requirement");
  }

  if (evidence) {
    add("evidence", "Create evidence checklist", `Evidence: ${evidence.slice(0, 80)}`);
  }

  if (/lookup|local.?authority|mapped|commune|department|spanc/i.test(localVar + " " + when + " " + title)) {
    add("lookup", "Add local-authority lookup step", "Local variation requires a location check");
  }

  if (/homeowner|owner|tenant|particulier/i.test(when + " " + title) || legal.includes("Mandatory")) {
    add("explain", "Create homeowner explanation", "Complex rule that benefits from plain language");
  }

  if (/spanc|sanitation|assainissement/i.test(title + " " + when)) {
    add("spanc-task", "Create inspection/remediation task from local report deadline", "SPANC local deadline");
    add("spanc-evidence", "Create SPANC evidence checklist", "SPANC compliance evidence");
  }

  if (/rainwater|eaux pluviales|surface.?water|drain/i.test(title + " " + when)) {
    add("rain-inspect", "Create system inspection checklist", "Network separation / connection check");
    add("rain-install", "Create installation evidence checklist", "Installation proof");
  }

  if (/tree|tpo|conservation/i.test(title + " " + when)) {
    add("tree-pre", "Create pre-work protection check", "Protected tree work");
    add("tree-consent", "Create consent/notice evidence checklist", "Consent or notice before works");
  }

  // Never suggest annual task for event-driven
  return out.filter((o) => {
    if (trigger === "Event-driven" && /annual/i.test(o.label)) return false;
    return true;
  });
}

export function queueCardPreview(row: KnowledgeRow, sources: KnowledgeSourcePreview[] = []) {
  const app = parseApplicability(row.applicability);
  const checks = buildTrustChecks(row, { sources });
  const health = computeSourceHealth(sources, row);
  return {
    title: displayKnowledgeTitle(row),
    guidance: displayKnowledgeGuidance(row),
    applicability: formatApplicabilityLine(app),
    appliesWhen: attrString(row.attributes, "applies_when"),
    presentationType: presentationTypeLabel(row),
    classification: legalClassificationLabel(row),
    trigger: triggerLabel(row),
    sourcesLine: health.summaryLine,
    criticLine: trustChecksSummary(checks),
    checks,
    blockingVerify: blockingChecksForVerify(checks),
    blockingPublish: blockingChecksForPublish(checks),
    publicationReady: isPublicationReady(row, checks),
    codeTitle: looksLikeKnowledgeCode(row.title) ? row.title : null,
    authoritativeSources: health.authoritative,
  };
}
