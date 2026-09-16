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
};

export type DeliverableState =
  | "Planned"
  | "Generating"
  | "Ready to review"
  | "Approved"
  | "Held"
  | "Blocked"
  | "Waiting";

export type SubjectDeliverable = {
  id: string;
  label: string;
  state: DeliverableState;
};

export type PackageActionLabel =
  | "Accept plan"
  | "Review drafts"
  | "Resolve gap"
  | "Approve distribution"
  | "View"
  | null;

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

export function subjectKeyFromTitle(title: string): string {
  const base = stripJurisdictionFromTitle(title).toLowerCase();

  if (/chimney|flue|ramonage|sweep/.test(base)) return "chimney-flue-sweeping";
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
    /heating|boiler|chaudière|chaudiere|heat\s*pump|pipework|exposed\s*pipe|certificate|certificat|service\s*heat|winteris|frost|radiator/.test(
      base
    )
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
  const regions = coverage.filter(
    (c) => c.id !== "international" && (c.status === "Sourced" || c.status === "Ready")
  );
  return regions.length >= 2;
}

export function recommendFormsForSubject(
  key: string,
  strategy: ContentParentStrategy,
  coverage: SubjectCoverage[]
): { summary: string; forms: ContentFormKind[]; assessing: boolean } {
  if (hasPlanRecommendation(strategy)) {
    const forms: ContentFormKind[] = [];
    if (strategy.primary_form) forms.push(strategy.primary_form);
    for (const d of strategy.derivative_forms) {
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
        else labels.push(formKindLabel(f));
      }
      if (strategy.supporting_content.some((s) => /france/i.test(s.label))) {
        if (!labels.includes("France guide")) labels.push("France guide");
      }
    }
    if (!labels.includes("Image") && labels.length > 0) labels.push("Image");
    return { summary: labels.join(" · ") || "Assessing opportunity", forms, assessing: false };
  }

  if (key === "before-heating-season") {
    return {
      summary: "Assessing opportunity",
      forms: ["compliance_checklist", "social_carousel", "social_post"],
      assessing: true,
    };
  }
  if (key === "chimney-flue-sweeping") {
    return {
      summary: "Assessing opportunity",
      forms: ["informational_article", "social_carousel", "social_post"],
      assessing: true,
    };
  }
  return { summary: "Assessing opportunity", forms: [], assessing: true };
}

function buildCoverage(
  key: string,
  rows: KnowledgeRow[],
  strategy: ContentParentStrategy
): SubjectCoverage[] {
  const coverage: SubjectCoverage[] = [];
  const regional: SubjectCoverage[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const label = jurisdictionFromRow(row);
    if (!label) continue;
    const lk = label.toLowerCase();
    if (seen.has(lk)) continue;
    seen.add(lk);
    regional.push({
      id: row.id,
      label,
      status: coverageStatusForKnowledge(row.status),
      knowledgeId: row.id,
    });
  }

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
      status: intlOk ? "Ready" : rows.some(isUnscoped) ? "Incomplete" : "Incomplete",
    });
  }

  coverage.push(...regional);

  if (key === "chimney-flue-sweeping" && !seen.has("france")) {
    coverage.push({ id: "fr-gap", label: "France", status: "Being researched" });
  }

  return coverage;
}

export function formatCoverageLine(coverage: SubjectCoverage[]): string {
  const parts: string[] = [];
  for (const c of coverage) {
    if (c.id === "international") {
      if (c.status === "Ready") parts.push("International ready");
      else if (c.status === "Incomplete") parts.push("International incomplete");
      else if (c.status === "Sourced") parts.push("International sourced");
      else if (c.status === "Being researched") parts.push("International being researched");
      continue;
    }
    if (c.status === "Not relevant") continue;
    if (c.status === "Sourced" || c.status === "Ready") parts.push(`${c.label} sourced`);
    else if (c.status === "Needs a decision") parts.push(`${c.label} needs a decision`);
    else if (c.status === "Being researched") parts.push(`${c.label} researching`);
  }
  return parts.length ? parts.join(" · ") : "Coverage not assessed yet";
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
  planAccepted: boolean
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
      state: "Waiting",
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
    return chimneyDeliverables(coverage, outputs, planAccepted);
  }
  if (formRec.assessing && !hasPlanRecommendation(strategy)) return [];

  const generating =
    topic?.workflow_status === "generating_content" ||
    topic?.workflow_status === "generating_outputs";

  const forms: Array<{ id: string; label: string; kind: string }> = [];
  if (strategy.primary_form) {
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
  }
  for (const d of strategy.derivative_forms) {
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
  if (forms.length) forms.push({ id: "images", label: "Images", kind: "images" });

  return forms.map((f) => {
    if (f.kind === "images") return { id: f.id, label: f.label, state: "Waiting" as const };
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
    const match = outputKind ? outputs.find((o) => o.output_kind === outputKind) : undefined;
    if (match?.status === "approved") return { id: f.id, label: f.label, state: "Approved" as const };
    if (match?.status === "rejected") return { id: f.id, label: f.label, state: "Held" as const };
    if (match && (match.status === "draft" || match.status === "needs_review")) {
      return {
        id: f.id,
        label: f.label,
        state: (planAccepted ? "Ready to review" : "Held") as DeliverableState,
      };
    }
    if (generating) return { id: f.id, label: f.label, state: "Generating" as const };
    return { id: f.id, label: f.label, state: "Planned" as const };
  });
}

/** Strip untranslated / contradictory gap noise from the human surface. */
export function sanitizeImportantGaps(gaps: string[]): string[] {
  return gaps.filter((text) => {
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
    const distributionReady =
      Boolean(prefs.distribution_ready_at) || (allApproved && outputs.length > 0 && planAccepted);

    const intlOk = internationalSupported(coverage);
    // Valid drafts: only after plan accepted; chimney France guide OK without full international
    const validPendingDrafts =
      planAccepted &&
      pendingOutputs.length > 0 &&
      (key !== "chimney-flue-sweeping" ||
        intlOk ||
        pendingOutputs.some(
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
      hasBlockingGap:
        needsKnowledgeDecision &&
        (planAccepted || planReady || key === "chimney-flue-sweeping"),
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
    } else if (distributionReady) {
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
      (actionLabel === "Review drafts"
        ? "Drafts waiting for judgement"
        : actionLabel === "Accept plan"
          ? key === "chimney-flue-sweeping"
            ? "Heating-season opportunity"
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

    let deliverablesSummary: string;
    if (scheduleState && !formRec.assessing) {
      deliverablesSummary = formRec.summary;
    } else if (formRec.assessing) {
      deliverablesSummary = "Assessing opportunity";
    } else {
      deliverablesSummary = formRec.summary;
    }

    const outcome =
      scheduleState === "proposed"
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
      primaryKnowledgeId:
        topic?.knowledge_id ??
        rows.find((r) => r.status === "verified" || r.status === "published")?.id ??
        rows[0]?.id ??
        null,
    });
  }

  for (const topic of input.topics) {
    if (topic.status === "archived" || usedTopicIds.has(topic.id)) continue;
    const key = subjectKeyFromTitle(topic.title);
    if (byKey.has(key)) continue;
    const strategy = normalizeParentStrategy(topic.strategy ?? {});
    const prefs = parseSchedulePrefs(topic.publishing);
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
  filter: ControlFilter
): SubjectPackage[] {
  if (filter === "scheduled") {
    return packages
      .filter(
        (p) =>
          (p.scheduleState === "proposed" || p.scheduleState === "confirmed") &&
          p.filter !== "complete"
      )
      .sort((a, b) => {
        if (a.windowStart && b.windowStart) return a.windowStart.localeCompare(b.windowStart);
        return b.rank - a.rank;
      });
  }
  return packages.filter((p) => p.filter === filter);
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
