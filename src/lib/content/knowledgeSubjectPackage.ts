/**
 * Admin Knowledge control room — subject packages.
 * Constitutional rule: no human task merely because automation is unfinished.
 *
 * Scheduled = Proposed + Confirmed editorial calendar (not published).
 * Needs attention = genuine human decisions only.
 * Planning resumes into Proposed calendar only — never auto-accept or draft unaccepted plans.
 */

import {
  formKindLabel,
  normalizeParentStrategy,
  type ContentFormKind,
  type ContentParentStrategy,
} from "@/lib/content/contentPlan";
import { proposePilotCalendarWindows } from "@/lib/content/knowledgeEditorialCalendar";
import {
  mergeSchedulePrefsIntoPublishing,
  parseSchedulePrefs,
  type SchedulePrefs,
  type ScheduleState,
} from "@/lib/content/knowledgeSchedule";
import {
  buildRegionalCoverage,
  coverageDecisionLabels,
  dedupeImportantGaps,
  draftDriftedFromSubject,
  eligibleTextApprovedForImages,
  imageStateFromGates,
  internationalSupportedFromCoverage,
  isPlaceholderOutput,
  nextAutomaticCopy,
  nextDecisionCopy,
  pickPrimaryKnowledgeId,
} from "@/lib/content/knowledgePackagePilot";
import {
  deriveDiscoverySignals,
  packageMatchesSourceFilter,
  topReasonChips,
  type DiscoverySignal,
  type DiscoverySourceFilter,
} from "@/lib/content/knowledgeWatch";
import type {
  ContentOutputRow,
  ContentTopicRow,
  KnowledgeRow,
  KnowledgeStatus,
} from "@/types/knowledge";

export type ControlFilter = "attention" | "scheduled" | "monitoring" | "complete";
export type AttentionGroup = "now" | "next";

export type CoverageStatus =
  | "Ready"
  | "Sourced"
  | "Being researched"
  | "Needs a decision"
  | "Not relevant"
  | "Incomplete";

export type SubjectCoverage = {
  id: string;
  label: string;
  status: CoverageStatus;
  knowledgeId?: string;
  /** Parent label when this is a UK constituent (England under United Kingdom). */
  parentLabel?: string;
};

export type DeliverableState =
  | "Planned"
  | "Generating"
  | "Ready to review"
  | "Ready to upload"
  | "Approved"
  | "Held"
  | "Blocked"
  | "Waiting";

export type SubjectDeliverable = {
  id: string;
  label: string;
  state: DeliverableState;
  outputId?: string;
  /** Why Blocked / Waiting / Held — same copy everywhere. */
  blockedReason?: string;
  /** Off-subject draft held for regeneration. */
  stale?: boolean;
};

export type PackageActionLabel = string | null;

export type PackagePrimaryKind =
  | "accept_plan"
  | "review_drafts"
  | "resolve_gap"
  | "approve_distribution"
  | "view"
  | "none";

export type MachineState =
  | "planning_queued"
  | "planning"
  | "assessing_opportunity"
  | "awaiting_coverage"
  | "not_timely"
  | "deferred"
  | "scheduled"
  | "ready_for_decision"
  | "complete";

export type SubjectPackage = {
  id: string;
  subjectKey: string;
  title: string;
  knowledgeRows: KnowledgeRow[];
  topic: ContentTopicRow | null;
  prefs: SchedulePrefs;
  strategy: ContentParentStrategy;
  /** Primary inbox filter for Needs attention / Monitoring / Complete. */
  filter: ControlFilter;
  /** Proposed | Confirmed calendar membership (neither means published). */
  scheduleState: ScheduleState | null;
  windowLabel: string | null;
  windowStart: string | null;
  attentionGroup: AttentionGroup | null;
  coverageSummary: string;
  coverage: SubjectCoverage[];
  outcome: string;
  whyNow: string;
  deliverablesSummary: string;
  deliverables: SubjectDeliverable[];
  actionLabel: PackageActionLabel;
  primaryKind: PackagePrimaryKind;
  machineState: MachineState;
  /** Eligible for planning-only auto continuation (create topic + plan stage). */
  autoPlanEligible: boolean;
  rank: number;
  primaryKnowledgeId: string | null;
  /**
   * Why this subject entered the Watch queue (discovery attribution).
   * Not operational Issues `signals`. Not verified Knowledge.
   */
  discoverySignals: DiscoverySignal[];
  /** Strongest one or two reason chip labels for the compact row. */
  reasonChips: string[];
  /** Concise reason under the primary action. */
  nextDecisionReason: string;
  /** Jurisdictions Resolve gap will research (explicit, not generic). */
  resolveGapJurisdictions: string[];
  /** Knowledge candidates that need Accept / Hold for this package. */
  decisionKnowledgeIds: string[];
};

export const CONTROL_FILTER_LABELS: Record<ControlFilter, string> = {
  attention: "Needs attention",
  scheduled: "Scheduled",
  monitoring: "Monitoring",
  complete: "Complete",
};

const JURISDICTION_SUFFIX =
  /\s*[—–\-|:]\s*(France|Scotland|England|Wales|Northern Ireland|UK|United Kingdom|Germany|Switzerland|Austria|Italy|Spain|CH|FR|DE|GB)\s*$/i;

const JURISDICTION_PAREN =
  /\s*\((France|Scotland|England|Wales|UK|United Kingdom|Germany|Switzerland|CH|FR|DE)\)\s*$/i;

export function stripJurisdictionFromTitle(title: string): string {
  return title.replace(JURISDICTION_SUFFIX, "").replace(JURISDICTION_PAREN, "").trim();
}

/**
 * Landlord gas is durable Knowledge. In the heating window it is reviewed on
 * Before the heating season — not a second queue the reviewer has to find.
 */
export function foldLandlordGasIntoHeatingSeason(
  byKey: Map<string, KnowledgeRow[]>,
  heatingSeason: boolean
): void {
  const gas = byKey.get("landlord-gas-maintenance");
  if (!gas?.length) return;
  const heating = byKey.get("before-heating-season") ?? [];
  if (!heatingSeason && heating.length === 0) return;
  byKey.set("before-heating-season", [...heating, ...gas]);
  byKey.delete("landlord-gas-maintenance");
}

export function subjectKeyFromTitle(title: string): string {
  const base = stripJurisdictionFromTitle(title).toLowerCase();

  if (
    /landlord.{0,48}gas|gas.?appliances?|\bgas safety\b|gas safe|installation pipework|landlords?.{0,24}dut/.test(
      base
    ) &&
    !/\bf-?gas\b/.test(base)
  ) {
    return "landlord-gas-maintenance";
  }
  if (/chimney|flue|ramonage|sweep/.test(base) && !/gas.?appliance|gas safe|landlord.{0,20}gas/.test(base)) {
    return "chimney-flue-sweeping";
  }
  if (/drown|piscine|pool\s*fence|anti-?drown|pool\s*safety/.test(base)) {
    return "anti-drowning-safety";
  }
  if (/smoke|carbon monoxide|\bco\s*alarm|smoke\s*alarm|détecteur|detecteur/.test(base)) {
    return "smoke-carbon-monoxide-alarms";
  }
  if (/gutter|gouttière|gouttiere|leaf|leaves|autumn\s*drain|downpipe/.test(base)) {
    return "gutters-autumn-leaf-risk";
  }
  if (/sewage|septic|fosse|private\s*drain/.test(base)) return "private-sewage-systems";
  if (/party\s*wall|mitoyen/.test(base)) return "party-walls";
  if (
    /heating|boiler|chaudière|chaudiere|heat\s*pump|exposed\s*pipe|service\s*heat|winteris|frost|radiator/.test(
      base
    ) ||
    /heating.{0,24}certificate|service records?.{0,24}heat/.test(base)
  ) {
    return "before-heating-season";
  }

  return (
    base
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "subject"
  );
}

export function subjectDisplayTitle(key: string, fallbackTitle: string): string {
  switch (key) {
    case "chimney-flue-sweeping":
      return "Chimney and flue sweeping";
    case "smoke-carbon-monoxide-alarms":
      return "Smoke and carbon monoxide alarms";
    case "before-heating-season":
      return "Before the heating season";
    case "landlord-gas-maintenance":
      return "Landlord gas-appliance and flue maintenance";
    case "gutters-autumn-leaf-risk":
      return "Gutters and autumn leaf risk";
    case "anti-drowning-safety":
      return "Pool safety";
    case "private-sewage-systems":
      return "Private sewage systems";
    case "party-walls":
      return "Party walls";
    default:
      return stripJurisdictionFromTitle(fallbackTitle) || fallbackTitle;
  }
}

/** Priority jurisdictions for international pilot packages (Watch + Resolve gap). */
export const INTL_COVERAGE_PRIORITY_JURISDICTIONS = [
  "England",
  "Scotland",
  "France",
  "Switzerland",
] as const;

const INTL_PILOT_SUBJECT_KEYS = new Set([
  "chimney-flue-sweeping",
  "smoke-carbon-monoxide-alarms",
  "before-heating-season",
  "gutters-autumn-leaf-risk",
]);

export function missingPriorityJurisdictions(coverage: SubjectCoverage[]): string[] {
  const present = new Set(
    coverage
      .filter(
        (c) =>
          c.id !== "international" &&
          (c.status === "Sourced" || c.status === "Ready" || c.status === "Needs a decision")
      )
      .map((c) => c.label.toLowerCase())
  );
  return INTL_COVERAGE_PRIORITY_JURISDICTIONS.filter((j) => !present.has(j.toLowerCase()));
}

function jurisdictionFromRow(row: KnowledgeRow): string | null {
  const app = (row.applicability ?? {}) as {
    jurisdictions?: string[];
    unscoped?: boolean;
  };
  if (app.unscoped) return null;
  const j = (app.jurisdictions ?? []).map((x) => x.trim()).filter(Boolean);
  if (j.length === 1) return j[0];
  if (j.length > 1) return j.join(", ");
  return row.title.match(JURISDICTION_SUFFIX)?.[1] ?? null;
}

function isUnscoped(row: KnowledgeRow): boolean {
  const app = (row.applicability ?? {}) as { unscoped?: boolean };
  return app.unscoped === true;
}

function coverageStatusForKnowledge(status: KnowledgeStatus): CoverageStatus {
  if (status === "published" || status === "verified") return "Sourced";
  if (status === "candidate" || status === "stale") return "Needs a decision";
  return "Being researched";
}

export function isHeatingSeasonMonth(monthIndex: number): boolean {
  return monthIndex >= 8 && monthIndex <= 10;
}

function hasPlanRecommendation(strategy: ContentParentStrategy): boolean {
  return Boolean(strategy.primary_form && strategy.content_scope);
}

function planReadyForAccept(strategy: ContentParentStrategy, topic: ContentTopicRow | null): boolean {
  if (!topic) return false;
  if (!hasPlanRecommendation(strategy)) return false;
  if (strategy.approval_status === "approved") return false;
  return true;
}

/** Representative international framing needs more than one regional source. */
function internationalSupported(coverage: SubjectCoverage[]): boolean {
  return internationalSupportedFromCoverage(coverage);
}

export function recommendFormsForSubject(
  key: string,
  strategy: ContentParentStrategy,
  coverage: SubjectCoverage[]
): { summary: string; forms: ContentFormKind[]; assessing: boolean } {
  if (hasPlanRecommendation(strategy)) {
    const forms: ContentFormKind[] = [];
    const skipInApp =
      strategy.content_scope === "international_overview" ||
      strategy.content_scope === "regional_comparison";
    if (strategy.primary_form && !(skipInApp && strategy.primary_form === "in_app_tip")) {
      forms.push(strategy.primary_form);
    }
    for (const d of strategy.derivative_forms) {
      if (skipInApp && d === "in_app_tip") continue;
      if (!forms.includes(d)) forms.push(d);
    }
    const labels: string[] = [];
    const intlOk = internationalSupported(coverage);
    if (key === "chimney-flue-sweeping" && !intlOk) {
      labels.push("France guide");
    } else {
      for (const f of forms) {
        if (f === "informational_article") labels.push(intlOk ? "Article" : "Regional guide");
        else if (f === "social_carousel") {
          if (intlOk) labels.push("Social carousel");
        } else if (f === "social_post") {
          if (intlOk) labels.push("Social");
        } else if (f === "compliance_checklist") labels.push("Checklist");
        else if (f === "faq") labels.push("FAQ");
        else if (f === "in_app_tip") {
          if (
            strategy.content_scope === "international_overview" ||
            strategy.content_scope === "regional_comparison"
          ) {
            continue;
          }
          labels.push("In-app tip");
        }
        else labels.push(formKindLabel(f));
      }
      if (strategy.supporting_content.some((s) => /france/i.test(s.label))) {
        if (!labels.includes("France guide")) labels.push("France guide");
      }
    }
    if (!labels.includes("Image") && labels.length > 0) labels.push("Image");
    return { summary: labels.join(" · ") || formatCoverageLine(coverage), forms, assessing: false };
  }

  if (key === "before-heating-season") {
    return {
      summary: formatCoverageLine(coverage),
      forms: ["compliance_checklist", "social_carousel", "social_post"],
      assessing: true,
    };
  }
  if (key === "chimney-flue-sweeping") {
    return {
      summary: formatCoverageLine(coverage),
      forms: ["informational_article", "social_carousel", "social_post"],
      assessing: true,
    };
  }
  return { summary: formatCoverageLine(coverage), forms: [], assessing: true };
}

function buildCoverage(
  key: string,
  rows: KnowledgeRow[],
  strategy: ContentParentStrategy
): SubjectCoverage[] {
  const coverage: SubjectCoverage[] = [];
  const regional = buildRegionalCoverage(rows, { subjectKey: key });
  const seen = new Set(regional.map((c) => c.label.toLowerCase()));

  const wantsIntl =
    rows.some(isUnscoped) ||
    strategy.content_scope === "international_overview" ||
    strategy.content_scope === "regional_comparison" ||
    key === "chimney-flue-sweeping" ||
    key === "smoke-carbon-monoxide-alarms" ||
    key === "before-heating-season" ||
    key === "gutters-autumn-leaf-risk";

  if (wantsIntl) {
    const intlOk = regional.filter((c) => c.status === "Sourced" || c.status === "Ready").length >= 2;
    coverage.push({
      id: "international",
      label: "International",
      status: intlOk ? "Ready" : "Incomplete",
    });
  }

  // Mark England/Scotland/Wales as UK constituents when any UK child is present.
  const hasUkChild = regional.some((c) =>
    /^(england|scotland|wales)$/i.test(c.label)
  );
  for (const c of regional) {
    coverage.push(
      hasUkChild && /^(england|scotland|wales)$/i.test(c.label)
        ? { ...c, parentLabel: "United Kingdom" }
        : c
    );
  }

  if (INTL_PILOT_SUBJECT_KEYS.has(key)) {
    for (const j of INTL_COVERAGE_PRIORITY_JURISDICTIONS) {
      if (seen.has(j.toLowerCase())) continue;
      coverage.push({
        id: `gap-${j.toLowerCase()}`,
        label: j,
        status: "Being researched",
        parentLabel: /^(england|scotland|wales)$/i.test(j) ? "United Kingdom" : undefined,
      });
    }
  }

  return coverage;
}

export function formatCoverageLine(coverage: SubjectCoverage[]): string {
  const covered: string[] = [];
  const candidates: string[] = [];
  for (const c of coverage) {
    if (c.id === "international" || c.status === "Not relevant") continue;
    if (c.status === "Sourced" || c.status === "Ready") covered.push(c.label);
    else if (c.status === "Needs a decision") candidates.push(c.label);
  }
  const parts = [
    ...covered.map((label) => `${label} covered`),
    ...candidates.map((label) => `${label} candidate found`),
  ];
  return parts.length ? parts.join(" · ") : "No candidate yet";
}

/** Human progress copy for coverage cells — no false ETAs. */
export function coverageProgressHint(status: CoverageStatus): string {
  switch (status) {
    case "Being researched":
      return "Open work: Watch or Research regions looks for an official source. No clock — finishes when a fetchable allowlisted URL yields a Knowledge candidate you Accept.";
    case "Incomplete":
      return "Needs at least two sourced regions before an international expression can unlock.";
    case "Needs a decision":
      return "Candidate or stale Knowledge is waiting for Accept / review — not automatic.";
    case "Sourced":
    case "Ready":
      return "Verified or published Knowledge covers this layer.";
    case "Not relevant":
      return "Out of scope for this package.";
    default:
      return "";
  }
}

/** Human progress copy for deliverable rows. */
export function deliverableProgressHint(state: DeliverableState): string {
  switch (state) {
    case "Waiting":
      return "Blocked on an earlier step (usually drafts or plan). Nothing is running in the background.";
    case "Ready to upload":
      return "Your turn — upload a square (and optional formats) below. Not generated until you add files or run a visual concept.";
    case "Blocked":
      return "Cannot start until coverage or plan unlocks this layer (e.g. international needs ≥2 regions).";
    case "Planned":
      return "Queued after Accept plan / coverage — machine has not generated it yet.";
    case "Generating":
      return "Machine is writing now — usually minutes; refresh if it stalls.";
    case "Ready to review":
      return "Draft is ready for your Approve / Hold.";
    case "Approved":
      return "Ready to include in Approve distribution.";
    case "Held":
      return "Excluded from distribution until you change it.";
    default:
      return "";
  }
}

/**
 * Derive one next action from the furthest *valid* state.
 * Premature drafts without an accepted plan do not unlock Review drafts.
 */
export function deriveNextAction(input: {
  planAccepted: boolean;
  planReady: boolean;
  hasBlockingGap: boolean;
  validPendingDrafts: boolean;
  allOutputsApproved: boolean;
  distributionReady: boolean;
  deferred: boolean;
}): { actionLabel: PackageActionLabel; primaryKind: PackagePrimaryKind; needsAttention: boolean } {
  if (input.deferred) {
    return { actionLabel: null, primaryKind: "none", needsAttention: false };
  }
  if (input.hasBlockingGap) {
    return { actionLabel: "Resolve gap", primaryKind: "resolve_gap", needsAttention: true };
  }
  if (input.distributionReady) {
    return { actionLabel: "View", primaryKind: "view", needsAttention: false };
  }
  if (input.planAccepted && input.allOutputsApproved) {
    return {
      actionLabel: "Approve distribution",
      primaryKind: "approve_distribution",
      needsAttention: true,
    };
  }
  if (input.planAccepted && input.validPendingDrafts) {
    return { actionLabel: "Review drafts", primaryKind: "review_drafts", needsAttention: true };
  }
  if (input.planReady && !input.planAccepted) {
    // Complete proposed plan awaiting acceptance — even if premature drafts exist
    return { actionLabel: "Accept plan", primaryKind: "accept_plan", needsAttention: true };
  }
  return { actionLabel: null, primaryKind: "none", needsAttention: false };
}

function chimneyDeliverables(
  coverage: SubjectCoverage[],
  outputs: ContentOutputRow[],
  planAccepted: boolean,
  topic: ContentTopicRow | null = null
): SubjectDeliverable[] {
  const france = coverage.find((c) => /france/i.test(c.label));
  const franceSourced = france && (france.status === "Sourced" || france.status === "Ready");
  const intlOk = internationalSupported(coverage);
  const frGuide = outputs.find(
    (o) =>
      o.output_kind === "core_article" ||
      /france/i.test(o.title ?? "")
  );
  const social = outputs.filter(
    (o) => o.output_kind === "social_post" || o.output_kind === "social_carousel"
  );

  const guideState = (): DeliverableState => {
    if (!franceSourced) return "Blocked";
    if (!frGuide) return planAccepted ? "Planned" : "Planned";
    if (frGuide.status === "approved") return "Approved";
    if (frGuide.status === "draft" || frGuide.status === "needs_review") {
      return planAccepted ? "Ready to review" : "Held";
    }
    return "Planned";
  };

  const creative = (topic?.creative ?? {}) as Record<string, unknown>;
  const finalAssets =
    creative.final_assets && typeof creative.final_assets === "object"
      ? (creative.final_assets as Record<string, unknown>)
      : {};
  const hasImage = Boolean(
    finalAssets.square_path ||
      finalAssets.thumbnail_path ||
      creative.square_path ||
      creative.thumbnail_path
  );
  const franceDraftsApproved =
    Boolean(frGuide && frGuide.status === "approved") ||
    (outputs.length > 0 &&
      outputs.every((o) => o.status === "approved" || o.status === "rejected") &&
      outputs.some((o) => o.status === "approved"));

  const image = imageStateFromGates({
    hasImage,
    planAccepted,
    eligibleTextApproved: franceDraftsApproved,
  });

  return [
    {
      id: "france-guide",
      label: "France guide",
      state: guideState(),
    },
    {
      id: "international-article",
      label: "International article",
      state: intlOk
        ? planAccepted && frGuide && (frGuide.status === "draft" || frGuide.status === "needs_review")
          ? "Ready to review"
          : "Planned"
        : "Blocked",
    },
    {
      id: "social",
      label: "International social",
      state: intlOk
        ? social.some((s) => s.status === "draft" || s.status === "needs_review")
          ? planAccepted
            ? "Ready to review"
            : "Held"
          : "Planned"
        : "Blocked",
    },
    {
      id: "images",
      label: "Images",
      state: image.state,
      blockedReason: image.hint,
    },
  ];
}

function heatingSeasonDeliverables(
  coverage: SubjectCoverage[],
  outputs: ContentOutputRow[],
  planAccepted: boolean,
  topic: ContentTopicRow | null = null
): SubjectDeliverable[] {
  const intlOk = internationalSupported(coverage);
  const creative = (topic?.creative ?? {}) as Record<string, unknown>;
  const finalAssets =
    creative.final_assets && typeof creative.final_assets === "object"
      ? (creative.final_assets as Record<string, unknown>)
      : {};
  const hasImage = Boolean(
    finalAssets.square_path ||
      finalAssets.thumbnail_path ||
      creative.square_path ||
      creative.thumbnail_path
  );

  const core = outputs.find((o) => o.output_kind === "core_article");
  const social = outputs.filter(
    (o) => o.output_kind === "social_post" || o.output_kind === "social_carousel"
  );

  const articleState = (): SubjectDeliverable => {
    const drifted = core ? draftDriftedFromSubject("before-heating-season", core) : false;
    if (!intlOk) {
      return {
        id: "international-article",
        label: "International article",
        state: "Blocked",
        outputId: core?.id,
        stale: drifted || undefined,
        blockedReason:
          "Needs at least two Sourced regions before an international overview can be reviewed as production-ready. Off-subject certificate drafts are Held.",
      };
    }
    if (!core) {
      return {
        id: "international-article",
        label: "International article",
        state: planAccepted ? "Planned" : "Planned",
        blockedReason: planAccepted
          ? "Queued after Accept plan — generate drafts next."
          : "Waiting on Accept plan.",
      };
    }
    if (drifted || core.status === "rejected") {
      return {
        id: "international-article",
        label: "International article",
        state: "Held",
        outputId: core.id,
        stale: true,
        blockedReason:
          "Draft drifted from “Before the heating season” (certificate filing). Regenerate against the accepted seasonal angle — draft kept, not deleted.",
      };
    }
    if (core.status === "approved") {
      return {
        id: "international-article",
        label: "International article",
        state: "Approved",
        outputId: core.id,
      };
    }
    if (core.status === "draft" || core.status === "needs_review") {
      return {
        id: "international-article",
        label: "International article",
        state: planAccepted ? "Ready to review" : "Held",
        outputId: core.id,
        blockedReason: planAccepted
          ? undefined
          : "Plan not accepted — premature drafts stay Held.",
      };
    }
    return {
      id: "international-article",
      label: "International article",
      state: "Planned",
      outputId: core.id,
    };
  };

  const socialState = (): SubjectDeliverable => {
    const match = social[0];
    const drifted = match ? draftDriftedFromSubject("before-heating-season", match) : false;
    if (!intlOk) {
      return {
        id: "social",
        label: "International social",
        state: "Blocked",
        outputId: match?.id,
        stale: drifted || undefined,
        blockedReason: "Blocked until international coverage has ≥2 Sourced regions.",
      };
    }
    if (!match) {
      return {
        id: "social",
        label: "International social",
        state: "Planned",
        blockedReason: "Queued with the international article after coverage unlocks.",
      };
    }
    if (drifted || match.status === "rejected") {
      return {
        id: "social",
        label: "International social",
        state: "Held",
        outputId: match.id,
        stale: true,
        blockedReason: "Held — off-subject or rejected. Regenerate when eligible.",
      };
    }
    if (match.status === "approved") {
      return { id: "social", label: "International social", state: "Approved", outputId: match.id };
    }
    if (match.status === "draft" || match.status === "needs_review") {
      return {
        id: "social",
        label: "International social",
        state: planAccepted && intlOk ? "Ready to review" : "Held",
        outputId: match.id,
      };
    }
    return { id: "social", label: "International social", state: "Planned", outputId: match.id };
  };

  const article = articleState();
  const socialDel = socialState();
  const image = imageStateFromGates({
    hasImage,
    planAccepted,
    eligibleTextApproved: eligibleTextApprovedForImages({
      planAccepted,
      intlOk,
      outputs,
      subjectKey: "before-heating-season",
    }),
  });

  return [
    article,
    socialDel,
    {
      id: "images",
      label: "Images",
      state: image.state,
      blockedReason: image.hint,
    },
  ];
}

function deliverablesFromStrategy(
  key: string,
  strategy: ContentParentStrategy,
  coverage: SubjectCoverage[],
  topic: ContentTopicRow | null,
  outputs: ContentOutputRow[],
  planAccepted: boolean,
  formRec: ReturnType<typeof recommendFormsForSubject>
): SubjectDeliverable[] {
  if (key === "chimney-flue-sweeping") {
    return chimneyDeliverables(coverage, outputs, planAccepted, topic);
  }
  if (key === "before-heating-season") {
    return heatingSeasonDeliverables(coverage, outputs, planAccepted, topic);
  }
  if (formRec.assessing && !hasPlanRecommendation(strategy)) return [];
  if (!planAccepted && !hasPlanRecommendation(strategy)) return [];

  const generating =
    topic?.workflow_status === "generating_content" ||
    topic?.workflow_status === "generating_outputs";
  const intlOk = internationalSupported(coverage);
  const wantsIntl =
    strategy.content_scope === "international_overview" ||
    strategy.content_scope === "regional_comparison";

  const forms: Array<{ id: string; label: string; kind: string }> = [];
  if (strategy.primary_form && strategy.primary_form !== "in_app_tip") {
    forms.push({
      id: strategy.primary_form,
      label:
        strategy.primary_form === "informational_article"
          ? "International article"
          : strategy.primary_form === "compliance_checklist"
            ? "Checklist"
            : formKindLabel(strategy.primary_form),
      kind: strategy.primary_form,
    });
  } else if (strategy.primary_form === "in_app_tip" && !wantsIntl) {
    forms.push({
      id: "in_app_tip",
      label: "In-app tip",
      kind: "in_app_tip",
    });
  }
  for (const d of strategy.derivative_forms) {
    if (d === "in_app_tip" && wantsIntl) continue;
    if (forms.some((f) => f.id === d)) continue;
    forms.push({
      id: d,
      label:
        d === "social_carousel"
          ? "Social carousel"
          : d === "social_post"
            ? "Short social post"
            : formKindLabel(d),
      kind: d,
    });
  }
  const creative = (topic?.creative ?? {}) as Record<string, unknown>;
  const finalAssets =
    creative.final_assets && typeof creative.final_assets === "object"
      ? (creative.final_assets as Record<string, unknown>)
      : {};
  const hasImage = Boolean(
    finalAssets.square_path ||
      finalAssets.thumbnail_path ||
      creative.square_path ||
      creative.thumbnail_path
  );
  if (forms.length && (planAccepted || hasImage)) {
    forms.push({ id: "images", label: "Images", kind: "images" });
  }

  return forms.map((f) => {
    if (f.kind === "images") {
      const approvedText = outputs.some(
        (o) => o.status === "approved" && !draftDriftedFromSubject(key, o)
      );
      const image = imageStateFromGates({
        hasImage,
        planAccepted,
        eligibleTextApproved: approvedText,
      });
      return {
        id: f.id,
        label: f.label,
        state: image.state,
        blockedReason: image.hint,
      };
    }
    const outputKind =
      f.kind === "informational_article"
        ? "core_article"
        : f.kind === "social_carousel"
          ? "social_carousel"
          : f.kind === "social_post"
            ? "social_post"
            : f.kind === "compliance_checklist"
              ? "compliance_checklist"
              : f.kind === "faq"
                ? "faq"
                : null;
    const match = outputKind
      ? outputs.find(
          (o) =>
            o.output_kind === outputKind &&
            !isPlaceholderOutput(o, strategy.content_scope || topic?.content_scope)
        )
      : undefined;
    if (f.kind === "in_app_tip" && wantsIntl) {
      return {
        id: f.id,
        label: "In-app tip",
        state: "Blocked" as const,
        blockedReason:
          "In-app tips need an exact applicable jurisdiction or property — not an international overview.",
      };
    }
    const isIntlForm =
      f.kind === "informational_article" ||
      f.kind === "social_carousel" ||
      f.kind === "social_post";
    if (wantsIntl && isIntlForm && !intlOk) {
      return {
        id: f.id,
        label: f.label,
        state: "Blocked" as const,
        outputId: match?.id,
        blockedReason:
          "International expression blocked until ≥2 regions are Sourced.",
      };
    }
    if (match?.status === "approved") {
      return { id: f.id, label: f.label, state: "Approved" as const, outputId: match.id };
    }
    if (match?.status === "rejected") {
      return { id: f.id, label: f.label, state: "Held" as const, outputId: match.id };
    }
    if (match && (match.status === "draft" || match.status === "needs_review")) {
      return {
        id: f.id,
        label: f.label,
        state: (planAccepted ? "Ready to review" : "Held") as DeliverableState,
        outputId: match.id,
      };
    }
    if (generating) return { id: f.id, label: f.label, state: "Generating" as const };
    if (!planAccepted) return null;
    return { id: f.id, label: f.label, state: "Planned" as const };
  }).filter((row): row is NonNullable<typeof row> => Boolean(row));
}

/** Strip untranslated / contradictory gap noise from the human surface. */
export function sanitizeImportantGaps(gaps: string[]): string[] {
  const filtered = gaps.filter((text) => {
    const t = text.trim();
    if (!t) return false;
    if (/untranslated|contradictory french|raw french/i.test(t)) return false;
    // French-dominant lines without English framing
    const frenchChars = (t.match(/[àâäéèêëïîôùûüçœæÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/g) ?? []).length;
    const frenchWords =
      /(besoin|vérifier|ramonage|annuel|obligation|chaudière|propriétaire|réglementation)\b/i.test(
        t
      );
    if ((frenchChars >= 1 || frenchWords) && !/\b(France|French|official|source|English)\b/i.test(t)) {
      return false;
    }
    return true;
  });
  return dedupeImportantGaps(filtered);
}

export function draftBodyToReadableProse(body: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type BuildSubjectPackagesInput = {
  knowledge: KnowledgeRow[];
  topics: ContentTopicRow[];
  outputsByTopicId?: Record<string, ContentOutputRow[]>;
  now?: Date;
};

export function buildSubjectPackages(input: BuildSubjectPackagesInput): SubjectPackage[] {
  const now = input.now ?? new Date();
  const monthIndex = now.getMonth();
  const heating = isHeatingSeasonMonth(monthIndex);
  const activeKnowledge = input.knowledge.filter((k) => k.status !== "archived");

  const byKey = new Map<string, KnowledgeRow[]>();
  for (const row of activeKnowledge) {
    const key = subjectKeyFromTitle(row.title);
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }
  foldLandlordGasIntoHeatingSeason(byKey, heating);

  const calendar = proposePilotCalendarWindows({
    now,
    subjectKeys: [...byKey.keys()],
    heatingSeason: heating,
  });
  const calendarByKey = new Map(calendar.map((c) => [c.subjectKey, c]));

  const usedTopicIds = new Set<string>();
  const packages: SubjectPackage[] = [];

  for (const [key, rows] of byKey) {
    const topic =
      input.topics.find(
        (t) =>
          t.status !== "archived" &&
          (rows.some((r) => r.id === t.knowledge_id) || subjectKeyFromTitle(t.title) === key)
      ) ?? null;
    if (topic) usedTopicIds.add(topic.id);

    const strategy = normalizeParentStrategy(topic?.strategy ?? {});
    const prefs = parseSchedulePrefs(topic?.publishing);
    const outputs = topic ? input.outputsByTopicId?.[topic.id] ?? [] : [];
    const pendingOutputs = outputs.filter(
      (o) => o.status === "draft" || o.status === "needs_review"
    );
    const allApproved =
      outputs.length > 0 && outputs.every((o) => o.status === "approved");
    const generatingPlan = topic?.workflow_status === "generating_plan";
    const generatingContent =
      topic?.workflow_status === "generating_content" ||
      topic?.workflow_status === "generating_outputs";

    const coverage = buildCoverage(key, rows, strategy);
    const regionalSourced = coverage.filter(
      (c) => c.id !== "international" && (c.status === "Sourced" || c.status === "Ready")
    );
    const needsKnowledgeDecision = rows.some(
      (r) => r.status === "candidate" || r.status === "stale"
    );
    const planAccepted = strategy.approval_status === "approved";
    const planReady = planReadyForAccept(strategy, topic);
    const distributionReady = Boolean(prefs.distribution_ready_at);

    const intlOk = internationalSupported(coverage);
    const missingJurisdictions = INTL_PILOT_SUBJECT_KEYS.has(key)
      ? missingPriorityJurisdictions(coverage)
      : [];
    // Valid drafts: only after plan accepted; never count off-subject / ineligible international drafts.
    const eligiblePending = pendingOutputs.filter((o) => {
      if (draftDriftedFromSubject(key, o)) return false;
      if (
        key === "before-heating-season" &&
        !intlOk &&
        (o.output_kind === "core_article" ||
          o.output_kind === "social_post" ||
          o.output_kind === "social_carousel")
      ) {
        return false;
      }
      return true;
    });
    const validPendingDrafts =
      planAccepted &&
      eligiblePending.length > 0 &&
      (key !== "chimney-flue-sweeping" ||
        intlOk ||
        eligiblePending.some(
          (o) => o.output_kind === "core_article" || /france/i.test(o.title ?? "")
        ));

    const formRec = recommendFormsForSubject(key, strategy, coverage);
    const deliverables = deliverablesFromStrategy(
      key,
      strategy,
      coverage,
      topic,
      outputs,
      planAccepted,
      formRec
    );

    const verifiedOrPublished = rows.some(
      (r) => r.status === "verified" || r.status === "published"
    );

    const cal = calendarByKey.get(key);
    let scheduleState: ScheduleState | null =
      prefs.schedule_state ??
      (planAccepted ? "confirmed" : planReady || hasPlanRecommendation(strategy) ? "proposed" : null);
    let windowLabel = prefs.window_label ?? cal?.window_label ?? null;
    let windowStart = prefs.window_start ?? cal?.window_start ?? null;

    const next = deriveNextAction({
      planAccepted,
      planReady: planReady || (hasPlanRecommendation(strategy) && !planAccepted),
      // Knowledge candidates/stale only — do not block France Review/Approve on international gaps.
      hasBlockingGap: needsKnowledgeDecision,
      validPendingDrafts,
      allOutputsApproved: allApproved && planAccepted && outputs.length > 0,
      distributionReady,
      deferred: Boolean(prefs.deferred),
    });

    let filter: ControlFilter = "monitoring";
    let machineState: MachineState = "planning_queued";
    let attentionGroup: AttentionGroup | null = null;
    let autoPlanEligible = false;
    let actionLabel = next.actionLabel;
    let primaryKind = next.primaryKind;

    if (prefs.deferred) {
      filter = "monitoring";
      machineState = "deferred";
      scheduleState = null;
    } else if (
      distributionReady &&
      !(INTL_PILOT_SUBJECT_KEYS.has(key) && missingJurisdictions.length > 0)
    ) {
      filter = "complete";
      machineState = "complete";
      scheduleState = "confirmed";
      actionLabel = "View";
      primaryKind = "view";
    } else if (next.needsAttention) {
      filter = "attention";
      machineState = "ready_for_decision";
      attentionGroup = "now";
      if (!scheduleState && (planReady || planAccepted)) {
        scheduleState = planAccepted ? "confirmed" : "proposed";
      }
    } else if (scheduleState === "proposed" || scheduleState === "confirmed") {
      filter = "scheduled";
      machineState = "scheduled";
      actionLabel = "View";
      primaryKind = "view";
    } else if (generatingPlan) {
      filter = "monitoring";
      machineState = "planning";
    } else if (generatingContent && planAccepted) {
      filter = "scheduled";
      machineState = "planning";
      scheduleState = "confirmed";
      actionLabel = "View";
      primaryKind = "view";
    } else if (!topic || !hasPlanRecommendation(strategy)) {
      if (key === "anti-drowning-safety" && heating) {
        filter = "monitoring";
        machineState = "not_timely";
      } else if (!verifiedOrPublished && !needsKnowledgeDecision) {
        filter = "monitoring";
        machineState = "awaiting_coverage";
      } else if (key === "smoke-carbon-monoxide-alarms" && regionalSourced.length < 2) {
        filter = "monitoring";
        machineState = "awaiting_coverage";
      } else {
        filter = "monitoring";
        machineState = "planning_queued";
        // Planning-only eligibility — restrained pilot subjects
        autoPlanEligible =
          verifiedOrPublished &&
          (key === "chimney-flue-sweeping" ||
            key === "before-heating-season" ||
            key === "gutters-autumn-leaf-risk" ||
            (key === "smoke-carbon-monoxide-alarms" && regionalSourced.length >= 2) ||
            ((key === "party-walls" || key === "private-sewage-systems") &&
              regionalSourced.length >= 1));
      }
    } else {
      filter = "monitoring";
      machineState = "assessing_opportunity";
    }

    // France (regional) path finished — next human decision is researching missing regions.
    const francePathSettled =
      planAccepted &&
      !validPendingDrafts &&
      pendingOutputs.length === 0 &&
      (allApproved || distributionReady);
    if (
      missingJurisdictions.length > 0 &&
      francePathSettled &&
      primaryKind !== "approve_distribution" &&
      primaryKind !== "review_drafts" &&
      primaryKind !== "accept_plan"
    ) {
      filter = "attention";
      machineState = "ready_for_decision";
      attentionGroup = "next";
      actionLabel = "Resolve gap";
      primaryKind = "resolve_gap";
    }

    // A Knowledge candidate is always a human decision — never Monitoring / View.
    const decisionKnowledgeIds = [
      ...new Set([
        ...coverage
          .filter((c) => c.status === "Needs a decision" && c.knowledgeId)
          .map((c) => c.knowledgeId as string),
        ...rows.filter((r) => r.status === "candidate" || r.status === "stale").map((r) => r.id),
      ]),
    ];
    const decisionRegions = coverageDecisionLabels(coverage);
    const staleDraftCount = outputs.filter((o) => draftDriftedFromSubject(key, o)).length;

    if (needsKnowledgeDecision) {
      filter = "attention";
      machineState = "ready_for_decision";
      attentionGroup = "now";
      primaryKind = "resolve_gap";
    }

    const decisionCopy = nextDecisionCopy({
      primaryKind,
      missingRegions: missingJurisdictions,
      decisionKnowledgeIds,
      decisionRegions,
      staleDraftCount,
    });
    if (primaryKind === "resolve_gap") {
      actionLabel = decisionCopy.title;
    }

    // Calendar rank boost for pilot order
    let rank = cal?.priority ?? 0;
    if (filter === "attention") rank += 500;
    if (scheduleState === "proposed") rank += 50;
    if (scheduleState === "confirmed") rank += 40;
    if (prefs.pinned) rank += 200;
    rank += Math.max(...rows.map((r) => new Date(r.updated_at).getTime()), 0) / 1e12;

    const why =
      prefs.reason_override ||
      cal?.why ||
      (primaryKind === "resolve_gap"
        ? decisionCopy.reason
        : actionLabel === "Review drafts"
        ? missingJurisdictions.length > 0
          ? `Review France drafts now · International waits on ${missingJurisdictions.join(", ")}`
          : "Drafts waiting for judgement"
        : actionLabel === "Accept plan"
          ? key === "chimney-flue-sweeping"
            ? "Heating-season opportunity · France ready · International needs more regions"
            : key === "smoke-carbon-monoxide-alarms"
              ? "Proposed as one international safety package"
              : "Plan ready for acceptance"
          : machineState === "planning_queued"
            ? "Planning queued"
            : machineState === "awaiting_coverage"
              ? "Regional research incomplete"
              : machineState === "not_timely"
                ? "No timely Expression opportunity; monitoring"
                : windowLabel
                  ? `Proposed for ${windowLabel}`
                  : "Monitoring");

    const nextAuto = nextAutomaticCopy({
      missingRegions: missingJurisdictions,
      comparisonReady: intlOk,
      planAccepted,
    });

    let deliverablesSummary: string;
    if (primaryKind === "resolve_gap") {
      deliverablesSummary = nextAuto ?? decisionCopy.reason;
    } else if (formRec.assessing) {
      deliverablesSummary = formatCoverageLine(coverage);
    } else {
      deliverablesSummary = formRec.summary;
    }

    const outcome =
      primaryKind === "resolve_gap"
        ? decisionCopy.title
        : scheduleState === "proposed"
        ? `Proposed · ${windowLabel ?? "calendar"}`
        : scheduleState === "confirmed"
          ? `Confirmed · ${windowLabel ?? "in production"}`
          : actionLabel === "Review drafts"
            ? key === "chimney-flue-sweeping"
              ? "France guide ready · International blocked"
              : "Drafts ready for review"
            : actionLabel === "Accept plan"
              ? "Plan ready for acceptance"
              : machineState === "planning_queued"
                ? "Planning queued"
                : machineState === "awaiting_coverage"
                  ? "Regional research incomplete"
                  : machineState === "not_timely"
                    ? "Seasonal window passed"
                    : "Monitoring";

    const coverageIncomplete =
      coverage.some((c) => c.status === "Being researched" || c.status === "Incomplete") ||
      machineState === "awaiting_coverage";

    const discoverySignals = deriveDiscoverySignals({
      subjectKey: key,
      title: subjectDisplayTitle(key, rows[0]?.title ?? key),
      sourceKinds: rows.map((r) => r.source_kind).filter(Boolean),
      knowledgeStatuses: rows.map((r) => r.status),
      whyNow: why,
      windowLabel,
      heatingSeason: heating,
      coverageIncomplete,
      provenanceHints: rows.flatMap((r) => {
        const prov =
          r.provenance && typeof r.provenance === "object" && !Array.isArray(r.provenance)
            ? (r.provenance as Record<string, unknown>)
            : {};
        const hints: Array<{
          url?: string | null;
          label?: string | null;
          detectedAt?: string | null;
          changeKind?: string | null;
        }> = [];
        const watch = prov.watch;
        if (Array.isArray(watch)) {
          for (const item of watch) {
            if (!item || typeof item !== "object") continue;
            const w = item as Record<string, unknown>;
            hints.push({
              url: typeof w.url === "string" ? w.url : null,
              label: typeof w.label === "string" ? w.label : null,
              detectedAt: typeof w.detected_at === "string" ? w.detected_at : null,
              changeKind: typeof w.change_kind === "string" ? w.change_kind : null,
            });
          }
        }
        return hints;
      }),
      now,
    });
    const reviewerSignals = discoverySignals.filter(
      (s) => s.sourceUrls.length > 0 || s.type !== "knowledge_gap"
    );

    packages.push({
      id: topic?.id ?? `subject:${key}`,
      subjectKey: key,
      title: subjectDisplayTitle(key, rows[0]?.title ?? key),
      knowledgeRows: rows,
      topic,
      prefs,
      strategy,
      filter,
      scheduleState,
      windowLabel,
      windowStart,
      attentionGroup,
      coverage,
      coverageSummary: formatCoverageLine(coverage),
      outcome,
      whyNow: why,
      deliverables,
      deliverablesSummary,
      actionLabel,
      primaryKind,
      machineState,
      autoPlanEligible,
      rank,
      primaryKnowledgeId: pickPrimaryKnowledgeId(key, rows, topic?.knowledge_id),
      discoverySignals: reviewerSignals,
      reasonChips: topReasonChips(reviewerSignals, 2),
      nextDecisionReason: decisionCopy.reason,
      resolveGapJurisdictions: missingJurisdictions,
      decisionKnowledgeIds,
    });
  }

  for (const topic of input.topics) {
    if (topic.status === "archived" || usedTopicIds.has(topic.id)) continue;
    const key = subjectKeyFromTitle(topic.title);
    if (byKey.has(key)) continue;
    const strategy = normalizeParentStrategy(topic.strategy ?? {});
    const prefs = parseSchedulePrefs(topic.publishing);
    const orphanSignals = deriveDiscoverySignals({
      subjectKey: key,
      title: subjectDisplayTitle(key, topic.title),
      sourceKinds: [],
      knowledgeStatuses: [],
      whyNow: "Monitoring",
      windowLabel: prefs.window_label,
      heatingSeason: isHeatingSeasonMonth((input.now ?? new Date()).getMonth()),
      coverageIncomplete: true,
      now: input.now,
    });
    packages.push({
      id: topic.id,
      subjectKey: key,
      title: subjectDisplayTitle(key, topic.title),
      knowledgeRows: [],
      topic,
      prefs,
      strategy,
      filter: prefs.distribution_ready_at ? "complete" : "monitoring",
      scheduleState: prefs.schedule_state ?? null,
      windowLabel: prefs.window_label ?? null,
      windowStart: prefs.window_start ?? null,
      attentionGroup: null,
      coverage: [],
      coverageSummary: "No Knowledge linked",
      outcome: "Awaiting Knowledge",
      whyNow: "Monitoring",
      deliverables: [],
      deliverablesSummary: "Assessing opportunity",
      actionLabel: prefs.distribution_ready_at ? "View" : null,
      primaryKind: prefs.distribution_ready_at ? "view" : "none",
      machineState: prefs.distribution_ready_at ? "complete" : "awaiting_coverage",
      autoPlanEligible: false,
      rank: 1,
      primaryKnowledgeId: topic.knowledge_id,
      discoverySignals: orphanSignals,
      reasonChips: topReasonChips(orphanSignals, 2),
      nextDecisionReason: prefs.distribution_ready_at
        ? "Package already marked channel-ready."
        : "No Knowledge linked to this topic yet.",
      resolveGapJurisdictions: [],
      decisionKnowledgeIds: [],
    });
  }

  packages.sort((a, b) => {
    if (a.windowStart && b.windowStart && a.windowStart !== b.windowStart) {
      return a.windowStart.localeCompare(b.windowStart);
    }
    return b.rank - a.rank;
  });
  return packages;
}

/** Packages visible under the Scheduled filter (Proposed + Confirmed calendar). */
export function packagesForFilter(
  packages: SubjectPackage[],
  filter: ControlFilter,
  sourceFilter: DiscoverySourceFilter = "all"
): SubjectPackage[] {
  const workflow =
    filter === "scheduled"
      ? packages
          .filter(
            (p) =>
              (p.scheduleState === "proposed" || p.scheduleState === "confirmed") &&
              p.filter !== "complete"
          )
          .sort((a, b) => {
            if (a.windowStart && b.windowStart) return a.windowStart.localeCompare(b.windowStart);
            return b.rank - a.rank;
          })
      : packages.filter((p) => p.filter === filter);

  if (sourceFilter === "all") return workflow;
  return workflow.filter((p) => packageMatchesSourceFilter(p.discoverySignals, sourceFilter));
}

export function filterCounts(packages: SubjectPackage[]): Record<ControlFilter, number> {
  return {
    attention: packages.filter((p) => p.filter === "attention").length,
    scheduled: packagesForFilter(packages, "scheduled").length,
    monitoring: packages.filter((p) => p.filter === "monitoring").length,
    complete: packages.filter((p) => p.filter === "complete").length,
  };
}

export function groupAttentionPackages(
  packages: SubjectPackage[]
): { now: SubjectPackage[]; next: SubjectPackage[]; flat: SubjectPackage[] } {
  const attention = packages.filter((p) => p.filter === "attention");
  if (attention.length <= 4) {
    return { now: [], next: [], flat: attention };
  }
  return {
    now: attention.filter((p) => p.attentionGroup === "now" || !p.attentionGroup),
    next: attention.filter((p) => p.attentionGroup === "next"),
    flat: [],
  };
}

export { mergeSchedulePrefsIntoPublishing, parseSchedulePrefs };
