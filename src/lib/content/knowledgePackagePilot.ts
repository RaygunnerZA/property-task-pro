/**
 * Pilot helpers for Knowledge subject packages — eligibility, hierarchy, navigation.
 * Keep in lockstep with @Docs/29_Knowledge.md Review package rules.
 */

import type { ContentOutputRow, KnowledgeRow, KnowledgeStatus } from "@/types/knowledge";

type CoverageStatus =
  | "Ready"
  | "Sourced"
  | "Being researched"
  | "Needs a decision"
  | "Not relevant"
  | "Incomplete";

type DeliverableState =
  | "Planned"
  | "Generating"
  | "Ready to review"
  | "Ready to upload"
  | "Approved"
  | "Held"
  | "Blocked"
  | "Waiting";

type SubjectCoverage = {
  id: string;
  label: string;
  status: CoverageStatus;
  knowledgeId?: string;
  parentLabel?: string;
};

type PackagePrimaryKind =
  | "accept_plan"
  | "review_drafts"
  | "resolve_gap"
  | "approve_distribution"
  | "view"
  | "none";

const UK_ALIASES = new Set(["uk", "united kingdom", "great britain", "gb"]);
const UK_CHILDREN = ["England", "Scotland", "Wales"] as const;

const STATUS_RANK: Record<CoverageStatus, number> = {
  Sourced: 5,
  Ready: 5,
  "Needs a decision": 4,
  Incomplete: 3,
  "Being researched": 2,
  "Not relevant": 1,
};

export type CoverageNavTarget =
  | { kind: "knowledge"; knowledgeId: string }
  | { kind: "research"; jurisdictions: string[] }
  | { kind: "none"; explanation: string };

export type DeliverableNavTarget =
  | { kind: "output"; outputId: string }
  | { kind: "images" }
  | { kind: "none"; explanation: string };

/** Expand compound / UK parent labels into display jurisdictions. */
export function expandJurisdictionLabels(label: string): string[] {
  const trimmed = label.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  if (UK_ALIASES.has(lower)) return [...UK_CHILDREN];
  if (lower === "england and wales" || lower === "england & wales") {
    return ["England", "Wales"];
  }
  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .flatMap((p) => expandJurisdictionLabels(p));
  }
  return [trimmed];
}

export function jurisdictionsFromKnowledgeRow(row: KnowledgeRow): string[] {
  const app = (row.applicability ?? {}) as {
    jurisdictions?: string[];
    unscoped?: boolean;
  };
  if (app.unscoped) return [];
  const fromApp = (app.jurisdictions ?? []).map((x) => x.trim()).filter(Boolean);
  if (fromApp.length > 0) {
    return [...new Set(fromApp.flatMap((j) => expandJurisdictionLabels(j)))];
  }
  const m = row.title.match(
    /\s*[—–\-|:]\s*(France|Scotland|England|Wales|Northern Ireland|UK|United Kingdom|Germany|Switzerland)\s*$/i
  );
  return m?.[1] ? expandJurisdictionLabels(m[1]) : [];
}

function coverageStatusForKnowledge(status: KnowledgeStatus): CoverageStatus {
  if (status === "published" || status === "verified") return "Sourced";
  if (status === "candidate" || status === "stale") return "Needs a decision";
  return "Being researched";
}

function rawJurisdictionLabels(row: KnowledgeRow): string[] {
  const app = (row.applicability ?? {}) as { jurisdictions?: string[] };
  return (app.jurisdictions ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean);
}

export function rowFitsPackageSubject(
  subjectKey: string | undefined,
  row: Pick<KnowledgeRow, "title" | "summary">
): boolean {
  if (!subjectKey) return true;
  const blob = `${row.title} ${row.summary ?? ""}`.toLowerCase();
  if (subjectKey === "before-heating-season") {
    if (
      /energy performance|\bepc\b|before marketing|selling a home/.test(blob) &&
      !/heating season|boiler|chaudière|gas appliance/.test(blob)
    ) {
      return false;
    }
    return /heating|boiler|chaudière|gas appliance|landlord.{0,20}gas|pipework|frost|radiator|heat pump/.test(
      blob
    );
  }
  if (subjectKey === "landlord-gas-maintenance") {
    return /gas appliance|gas safe|landlord.{0,40}gas|installation pipework|landlords?.{0,20}dut/.test(
      blob
    );
  }
  if (subjectKey === "chimney-flue-sweeping") {
    if (/gas appliance|gas safe|landlord.{0,20}gas/.test(blob)) return false;
    return /chimney|ramonage|sweep|flue/.test(blob);
  }
  return true;
}

/**
 * Build regional coverage without double-counting UK vs England/Scotland/Wales.
 * Prefer the strongest status, then an exact nation over a UK-expanded sibling,
 * then a row that actually belongs to the package subject.
 */
export function buildRegionalCoverage(
  rows: KnowledgeRow[],
  opts?: { subjectKey?: string }
): SubjectCoverage[] {
  const byLabel = new Map<
    string,
    SubjectCoverage & { exact: boolean; subjectFit: boolean }
  >();

  for (const row of rows) {
    const labels = jurisdictionsFromKnowledgeRow(row);
    const exactRaw = new Set(rawJurisdictionLabels(row));
    const subjectFit = rowFitsPackageSubject(opts?.subjectKey, row);
    for (const label of labels) {
      const key = label.toLowerCase();
      const exact = exactRaw.has(key);
      const next = {
        id: `${row.id}:${key}`,
        label,
        status: coverageStatusForKnowledge(row.status),
        knowledgeId: row.id,
        exact,
        subjectFit,
      };
      const prev = byLabel.get(key);
      if (!prev) {
        byLabel.set(key, next);
        continue;
      }
      if (STATUS_RANK[next.status] !== STATUS_RANK[prev.status]) {
        if (STATUS_RANK[next.status] > STATUS_RANK[prev.status]) byLabel.set(key, next);
        continue;
      }
      if (next.exact && !prev.exact) {
        byLabel.set(key, next);
        continue;
      }
      if (next.exact === prev.exact && next.subjectFit && !prev.subjectFit) {
        byLabel.set(key, next);
      }
    }
  }

  const labels = [...byLabel.keys()];
  const hasChild = UK_CHILDREN.some((c) => labels.includes(c.toLowerCase()));
  if (hasChild) {
    for (const alias of UK_ALIASES) {
      byLabel.delete(alias);
    }
  }

  return [...byLabel.values()]
    .map(({ exact: _e, subjectFit: _s, ...cell }) => cell)
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function knowledgeIdForReviewDecision(input: {
  coverage: SubjectCoverage[];
  decisionRegion?: string | null;
  decisionKnowledgeIds: string[];
  rows: KnowledgeRow[];
  subjectKey?: string;
}): string | null {
  const region = (input.decisionRegion ?? "").trim().toLowerCase();
  if (region) {
    const cell = input.coverage.find(
      (c) => c.label.toLowerCase() === region && c.knowledgeId
    );
    if (cell?.knowledgeId) return cell.knowledgeId;
    const fitted = input.rows.find((r) => {
      if (!rowFitsPackageSubject(input.subjectKey, r)) return false;
      return jurisdictionsFromKnowledgeRow(r).some((l) => l.toLowerCase() === region);
    });
    if (fitted) return fitted.id;
    const anyRegion = input.rows.find((r) =>
      jurisdictionsFromKnowledgeRow(r).some((l) => l.toLowerCase() === region)
    );
    if (anyRegion) return anyRegion.id;
  }
  return input.decisionKnowledgeIds[0] ?? input.rows[0]?.id ?? null;
}

/** True when an output drifted from the accepted subject (e.g. certificates vs seasonal prep). */
export function draftDriftedFromSubject(
  subjectKey: string,
  output: Pick<ContentOutputRow, "title" | "body" | "output_kind">
): boolean {
  if (subjectKey !== "before-heating-season") return false;
  const blob = `${output.title ?? ""}\n${output.body ?? ""}`.toLowerCase();
  const certificateHeavy =
    /(certificate|filing|renewal timeline|record.?keep|organis|organiz).{0,40}(heating|service record)/i.test(
      blob
    ) ||
    /how to organiz[ea] heating certificates/i.test(blob) ||
    (/certificate/.test(blob) &&
      /fil(e|ing)|renewal|record store|visibility over property compliance/i.test(blob) &&
      !/before the heating season|prepare.{0,20}(boiler|heating)|service.{0,20}(boiler|heating)|chaudière|pre-season/i.test(
        blob
      ));
  return certificateHeavy;
}

export function internationalSupportedFromCoverage(coverage: SubjectCoverage[]): boolean {
  return (
    coverage.filter(
      (c) => c.id !== "international" && (c.status === "Sourced" || c.status === "Ready")
    ).length >= 2
  );
}

export function imageStateFromGates(input: {
  hasImage: boolean;
  planAccepted: boolean;
  eligibleTextApproved: boolean;
}): { state: DeliverableState; hint: string } {
  if (input.hasImage) {
    return {
      state: "Approved",
      hint: "Attached to this package for channel use. Not published until a channel runs.",
    };
  }
  if (!input.planAccepted) {
    return {
      state: "Waiting",
      hint: "Waiting on Accept plan — images unlock after the plan is confirmed and eligible text drafts are approved.",
    };
  }
  if (!input.eligibleTextApproved) {
    return {
      state: "Waiting",
      hint: "Waiting on approved eligible text drafts for this package. Images unlock after those drafts are approved (not while international coverage is still blocked).",
    };
  }
  return {
    state: "Ready to upload",
    hint: "Your turn — upload a square (and optional formats). Not generated until you add files or run a visual concept.",
  };
}

/** Deduplicate gap strings while keeping first provenance order. */
export function dedupeImportantGaps(gaps: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of gaps) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * Prefer seasonal-prep Knowledge as the package anchor over certificate-filing siblings.
 */
export function pickPrimaryKnowledgeId(
  subjectKey: string,
  rows: KnowledgeRow[],
  topicKnowledgeId: string | null | undefined
): string | null {
  if (subjectKey === "before-heating-season") {
    const seasonal = rows.find((r) => {
      if (!rowFitsPackageSubject(subjectKey, r)) return false;
      const t = r.title.toLowerCase();
      if (/certificate|filing|record keep|organis|organiz/.test(t) && !/before the heating|service heating|chaudière|boiler/.test(t)) {
        return false;
      }
      return (
        /before the heating|service heating|heating season|chaudière|boiler|gas appliances|flues \(landlords\)|repairing standard.*gas/i.test(
          t
        ) && (r.status === "published" || r.status === "verified" || r.status === "candidate")
      );
    });
    if (seasonal) return seasonal.id;
  }
  const fitted = rows.find(
    (r) =>
      rowFitsPackageSubject(subjectKey, r) &&
      (r.status === "verified" || r.status === "published" || r.status === "candidate")
  );
  return (
    (topicKnowledgeId && rows.some((r) => r.id === topicKnowledgeId && rowFitsPackageSubject(subjectKey, r))
      ? topicKnowledgeId
      : null) ??
    fitted?.id ??
    rows.find((r) => r.status === "verified" || r.status === "published")?.id ??
    rows[0]?.id ??
    null
  );
}

export function coverageNavTarget(c: SubjectCoverage): CoverageNavTarget {
  if (c.knowledgeId && (c.status === "Needs a decision" || c.status === "Sourced" || c.status === "Ready")) {
    return { kind: "knowledge", knowledgeId: c.knowledgeId };
  }
  if (c.status === "Being researched" && c.id !== "international") {
    return { kind: "research", jurisdictions: [c.label] };
  }
  if (c.id === "international" && c.status === "Incomplete") {
    return {
      kind: "none",
      explanation:
        "International unlocks when at least two regional layers are Sourced (Accept candidates first).",
    };
  }
  return {
    kind: "none",
    explanation: "No further action on this layer right now.",
  };
}

export function deliverableNavTarget(d: {
  id: string;
  state: DeliverableState;
  outputId?: string;
  blockedReason?: string;
}): DeliverableNavTarget {
  if (d.outputId) return { kind: "output", outputId: d.outputId };
  if (d.id === "images" && d.state === "Ready to upload") return { kind: "images" };
  return {
    kind: "none",
    explanation:
      d.blockedReason ||
      (d.state === "Blocked" || d.state === "Waiting" || d.state === "Planned"
        ? "No draft or upload target yet — follow Next decision above."
        : "No openable record for this deliverable."),
  };
}

/** Best-effort map from a gap string to priority jurisdictions for Resolve gap. */
export function jurisdictionsFromGapText(text: string): string[] {
  const t = text.toLowerCase();
  const found: string[] = [];
  for (const j of ["England", "Scotland", "Wales", "France", "Switzerland", "United Kingdom"]) {
    if (new RegExp(`\\b${j.toLowerCase()}\\b`).test(t) || (j === "United Kingdom" && /\buk\b/.test(t))) {
      if (j === "United Kingdom") {
        found.push("England", "Scotland", "Wales");
      } else {
        found.push(j);
      }
    }
  }
  return [...new Set(found)];
}

/** Eligible text drafts for image unlock — never count drifted certificate drafts. */
export function eligibleTextApprovedForImages(input: {
  planAccepted: boolean;
  intlOk: boolean;
  outputs: Array<Pick<ContentOutputRow, "status" | "title" | "body" | "output_kind">>;
  subjectKey: string;
}): boolean {
  if (!input.planAccepted || !input.intlOk) return false;
  const nonDrifted = input.outputs.filter((o) => !draftDriftedFromSubject(input.subjectKey, o));
  const hasApproved = nonDrifted.some((o) => o.status === "approved");
  const hasPending = nonDrifted.some((o) => o.status === "draft" || o.status === "needs_review");
  return hasApproved && !hasPending;
}

export function coverageDecisionLabels(coverage: SubjectCoverage[]): string[] {
  return coverage
    .filter((c) => c.status === "Needs a decision" && c.id !== "international")
    .map((c) => c.label);
}

export function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function isPlaceholderOutput(
  output: Pick<ContentOutputRow, "title" | "body" | "status" | "output_kind">,
  contentScope?: string | null
): boolean {
  if (
    output.output_kind === "in_app_tip" &&
    (contentScope === "international_overview" || contentScope === "regional_comparison")
  ) {
    return true;
  }
  if (output.status === "needs_update" || output.status === "archived") return true;
  return !(output.title?.trim() || output.body?.trim());
}

/** Remaining machine work after the current human decision. */
export function nextAutomaticCopy(input: {
  missingRegions: string[];
  comparisonReady: boolean;
  planAccepted: boolean;
}): string | null {
  const steps: string[] = [];
  if (input.missingRegions.length > 0) {
    steps.push(`research ${joinList(input.missingRegions)}`);
  }
  if (!input.comparisonReady) {
    steps.push("build the comparison");
  }
  if (!input.planAccepted) {
    steps.push("propose the article plan");
  }
  if (steps.length === 0) return null;
  if (steps.length === 1) return `Filla will ${steps[0]}.`;
  const last = steps[steps.length - 1];
  return `Filla will ${steps.slice(0, -1).join(", ")}, and ${last}.`;
}

export function nextDecisionCopy(input: {
  primaryKind: PackagePrimaryKind;
  missingRegions: string[];
  decisionKnowledgeIds: string[];
  decisionRegions?: string[];
  staleDraftCount: number;
}): { title: string; reason: string } {
  const decisionRegions = input.decisionRegions ?? [];
  switch (input.primaryKind) {
    case "accept_plan":
      return {
        title: "Accept plan",
        reason:
          "Confirm the angle for this package. Eligible drafts generate only after Accept.",
      };
    case "review_drafts":
      return {
        title: "Review drafts",
        reason:
          input.staleDraftCount > 0
            ? `${input.staleDraftCount} draft(s) held as off-subject — regenerate against the accepted subject, or Approve / Hold eligible drafts.`
            : "Eligible drafts are ready for Approve or Hold.",
      };
    case "resolve_gap":
      if (decisionRegions.length > 1) {
        return {
          title: "Review candidates",
          reason: `Open ${joinList(decisionRegions)} and accept or hold each source.`,
        };
      }
      if (decisionRegions.length === 1) {
        const region = decisionRegions[0];
        return {
          title: `Review ${region}`,
          reason: `Review the official ${region} source and proposed guidance.`,
        };
      }
      return {
        title: "Resolve gap",
        reason: input.missingRegions.length
          ? `Research missing regions: ${joinList(input.missingRegions)}.`
          : "Close the open coverage gap for this subject.",
      };
    case "approve_distribution":
      return {
        title: "Approve distribution",
        reason:
          "Marks approved drafts (and images) channel-ready. Does not publish or run channels.",
      };
    default:
      return {
        title: "No decision required",
        reason: "Machine work or monitoring — open a layer below if you need detail.",
      };
  }
}
