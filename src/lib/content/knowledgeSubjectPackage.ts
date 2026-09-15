/**
 * Admin Knowledge control room — subject packages.
 * Constitutional rule: no human task merely because automation is unfinished.
 * Needs attention = genuine decisions only; everything else is machine/Monitoring.
 */

import {
  formKindLabel,
  normalizeParentStrategy,
  type ContentFormKind,
  type ContentParentStrategy,
} from "@/lib/content/contentPlan";
import {
  mergeSchedulePrefsIntoPublishing,
  parseSchedulePrefs,
  type SchedulePrefs,
} from "@/lib/content/knowledgeSchedule";
import type {
  ContentOutputRow,
  ContentTopicRow,
  KnowledgeRow,
  KnowledgeStatus,
} from "@/types/knowledge";

export type ControlFilter = "attention" | "scheduled" | "monitoring" | "complete";

/** Within Needs attention only — omit Now when few items. */
export type AttentionGroup = "now" | "next";

export type CoverageStatus = "Ready" | "Sourced" | "Being researched" | "Needs a decision" | "Not relevant";

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
  | "Held";

export type SubjectDeliverable = {
  id: string;
  label: string;
  state: DeliverableState;
};

/** Human-facing action — null when no decision required. */
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
  filter: ControlFilter;
  attentionGroup: AttentionGroup | null;
  coverageSummary: string;
  coverage: SubjectCoverage[];
  outcome: string;
  whyNow: string;
  deliverablesSummary: string;
  deliverables: SubjectDeliverable[];
  /** Prominent button label; null = no human action on the row. */
  actionLabel: PackageActionLabel;
  primaryKind: PackagePrimaryKind;
  machineState: MachineState;
  /** Eligible for client/overnight auto-plan. */
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

/**
 * Map a Knowledge title into a subject package key.
 * Prefer broader seasonal collections over one package per atomic row.
 */
export function subjectKeyFromTitle(title: string): string {
  const base = stripJurisdictionFromTitle(title).toLowerCase();

  // Distinct reader intents — standalone packages
  if (/chimney|flue|ramonage|sweep/.test(base)) return "chimney-flue-sweeping";
  if (/drown|piscine|pool\s*fence|anti-?drown|pool\s*safety/.test(base)) {
    return "anti-drowning-safety";
  }
  if (
    /smoke|carbon monoxide|\bco\s*alarm|smoke\s*alarm|détecteur|detecteur/.test(base)
  ) {
    return "smoke-carbon-monoxide-alarms";
  }
  if (/sewage|septic|fosse|private\s*drain/.test(base)) return "private-sewage-systems";
  if (/party\s*wall|mitoyen/.test(base)) return "party-walls";

  // Seasonal collection — related heating prep
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
  if (app.unscoped) return null; // handled as International layer
  const j = (app.jurisdictions ?? []).map((x) => x.trim()).filter(Boolean);
  if (j.length === 1) return j[0];
  if (j.length > 1) return j.join(", ");
  const fromTitle = row.title.match(JURISDICTION_SUFFIX)?.[1];
  return fromTitle ?? null;
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
  // Plan generated / pending human accept
  return (
    strategy.approval_status === "pending" ||
    strategy.approval_status === "none" ||
    topic.workflow_status === "plan_review" ||
    topic.workflow_status === "seo_review" ||
    topic.workflow_status === "brief_review" ||
    topic.workflow_status === "ready_for_outputs"
  );
}

/** Opportunity-based forms — never invent article+image before a recommendation exists. */
export function recommendFormsForSubject(
  key: string,
  strategy: ContentParentStrategy
): { summary: string; forms: ContentFormKind[]; assessing: boolean } {
  if (hasPlanRecommendation(strategy)) {
    const forms: ContentFormKind[] = [];
    if (strategy.primary_form) forms.push(strategy.primary_form);
    for (const d of strategy.derivative_forms) {
      if (!forms.includes(d)) forms.push(d);
    }
    const labels = forms.map((f) => {
      if (f === "informational_article") return "Article";
      if (f === "social_carousel") return "Social carousel";
      if (f === "social_post") return "Social";
      if (f === "compliance_checklist") return "Checklist";
      if (f === "faq") return "FAQ";
      if (f === "in_app_tip") return "In-app";
      if (f === "newsletter") return "Newsletter";
      return formKindLabel(f);
    });
    const guide = strategy.supporting_content.some((s) => /guide|france|country/i.test(s.label));
    if (guide) labels.push("France guide");
    labels.push("Image");
    return { summary: labels.join(" · "), forms, assessing: false };
  }

  // Heuristic recommendation for auto-plan (not shown as "ready" until plan exists)
  if (key === "before-heating-season") {
    return {
      summary: "Assessing opportunity",
      forms: ["compliance_checklist", "social_carousel", "social_post"],
      assessing: true,
    };
  }
  if (key === "chimney-flue-sweeping" || key === "smoke-carbon-monoxide-alarms") {
    return {
      summary: "Assessing opportunity",
      forms: ["informational_article", "social_carousel", "social_post"],
      assessing: true,
    };
  }
  if (key === "private-sewage-systems" || key === "party-walls") {
    return {
      summary: "Assessing opportunity",
      forms: ["informational_article", "faq"],
      assessing: true,
    };
  }
  return { summary: "Assessing opportunity", forms: [], assessing: true };
}

function buildCoverage(
  key: string,
  rows: KnowledgeRow[],
  strategy: ContentParentStrategy,
  outputs: ContentOutputRow[]
): SubjectCoverage[] {
  const coverage: SubjectCoverage[] = [];
  const hasIntlKnowledge = rows.some(isUnscoped);
  const wantsIntl =
    hasIntlKnowledge ||
    strategy.content_scope === "international_overview" ||
    strategy.content_scope === "regional_comparison" ||
    key === "chimney-flue-sweeping" ||
    key === "smoke-carbon-monoxide-alarms" ||
    key === "before-heating-season";

  if (wantsIntl) {
    const intlReady =
      strategy.approval_status === "approved" ||
      outputs.some((o) => o.output_kind === "core_article") ||
      (hasPlanRecommendation(strategy) && hasIntlKnowledge);
    coverage.push({
      id: "international",
      label: "International",
      status: intlReady
        ? outputs.some((o) => o.status === "draft" || o.status === "needs_review" || o.status === "approved")
          ? "Ready"
          : hasPlanRecommendation(strategy)
            ? "Ready"
            : hasIntlKnowledge
              ? "Sourced"
              : "Being researched"
        : hasIntlKnowledge
          ? "Sourced"
          : "Being researched",
    });
  }

  const seen = new Set<string>();
  for (const row of rows) {
    const label = jurisdictionFromRow(row);
    if (!label) continue;
    const keyLabel = label.toLowerCase();
    if (seen.has(keyLabel)) continue;
    seen.add(keyLabel);
    coverage.push({
      id: row.id,
      label,
      status: coverageStatusForKnowledge(row.status),
      knowledgeId: row.id,
    });
  }

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
      else if (c.status === "Sourced") parts.push("International sourced");
      else if (c.status === "Being researched") parts.push("International being researched");
      else if (c.status === "Needs a decision") parts.push("International needs a decision");
      continue;
    }
    if (c.status === "Not relevant") continue;
    if (c.status === "Sourced" || c.status === "Ready") parts.push(`${c.label} sourced`);
    else if (c.status === "Needs a decision") parts.push(`${c.label} needs a decision`);
    else if (c.status === "Being researched") parts.push(`${c.label} researching`);
  }
  if (parts.length === 0) return "Coverage not assessed yet";
  return parts.join(" · ");
}

function meaningfulWhy(input: {
  key: string;
  prefs: SchedulePrefs;
  monthIndex: number;
  coverage: SubjectCoverage[];
  machineState: MachineState;
  hasDrafts: boolean;
  planReady: boolean;
}): string | null {
  if (input.prefs.reason_override) return input.prefs.reason_override;
  if (input.prefs.pinned) return "Pinned for pilot";
  if (input.prefs.deferred) return "Deferred";
  if (input.machineState === "not_timely") return "No timely Expression opportunity; monitoring";
  if (input.machineState === "awaiting_coverage") {
    return "Regional comparison requires another source";
  }
  if (input.machineState === "planning_queued" || input.machineState === "planning") {
    return null; // not shown as priority in Now
  }
  if (input.hasDrafts) return "Drafts waiting for judgement";
  if (input.planReady && input.key === "smoke-carbon-monoxide-alarms") {
    return "Proposed as one international safety package";
  }
  if (input.key === "chimney-flue-sweeping" && isHeatingSeasonMonth(input.monthIndex)) {
    return "Heating-season opportunity";
  }
  if (input.key === "before-heating-season" && isHeatingSeasonMonth(input.monthIndex)) {
    return "Heating-season opportunity";
  }
  if (input.coverage.filter((c) => c.id !== "international" && c.status === "Sourced").length >= 1) {
    const fr = input.coverage.find((c) => /france/i.test(c.label) && c.status === "Sourced");
    if (fr) return "France source coverage complete";
  }
  if (input.planReady) return "High international relevance";
  return null;
}

function deliverablesFromOutputs(
  strategy: ContentParentStrategy,
  topic: ContentTopicRow | null,
  outputs: ContentOutputRow[],
  formRec: ReturnType<typeof recommendFormsForSubject>
): SubjectDeliverable[] {
  if (formRec.assessing && !hasPlanRecommendation(strategy)) {
    return [];
  }
  const generating =
    topic?.workflow_status === "generating_content" ||
    topic?.workflow_status === "generating_outputs" ||
    topic?.workflow_status === "generating_plan";

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
  for (const s of strategy.supporting_content) {
    if (/france/i.test(s.label)) {
      forms.push({ id: "france-guide", label: "France guide", kind: "guide" });
    }
  }
  if (forms.length > 0) {
    forms.push({ id: "images", label: "Images", kind: "images" });
  }

  return forms.map((f) => {
    if (f.kind === "images" || f.kind === "guide") {
      return { id: f.id, label: f.label, state: "Planned" as const };
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
    const match = outputKind ? outputs.find((o) => o.output_kind === outputKind) : undefined;
    if (match?.status === "approved") return { id: f.id, label: f.label, state: "Approved" as const };
    if (match?.status === "rejected") return { id: f.id, label: f.label, state: "Held" as const };
    if (match && (match.status === "draft" || match.status === "needs_review")) {
      return { id: f.id, label: f.label, state: "Ready to review" as const };
    }
    if (generating) return { id: f.id, label: f.label, state: "Generating" as const };
    return { id: f.id, label: f.label, state: "Planned" as const };
  });
}

function outcomeLine(input: {
  machineState: MachineState;
  actionLabel: PackageActionLabel;
  formRec: ReturnType<typeof recommendFormsForSubject>;
  hasDrafts: boolean;
  coverage: SubjectCoverage[];
}): string {
  if (input.actionLabel === "Review drafts") {
    const fr = input.coverage.find((c) => /france/i.test(c.label));
    if (fr && (fr.status === "Sourced" || fr.status === "Ready")) {
      return "International article and France guide ready";
    }
    return "Drafts ready for review";
  }
  if (input.actionLabel === "Accept plan") {
    return input.formRec.summary === "Assessing opportunity"
      ? "Plan ready for acceptance"
      : `${input.formRec.summary.replace(/ · Image$/, "")} proposed`;
  }
  if (input.actionLabel === "Approve distribution") {
    return "Package ready to approve for distribution";
  }
  if (input.actionLabel === "Resolve gap") {
    return "Source or applicability exception";
  }
  switch (input.machineState) {
    case "planning_queued":
      return "Planning queued";
    case "planning":
      return "Planning in progress";
    case "assessing_opportunity":
      return "Assessing opportunity";
    case "awaiting_coverage":
      return "Regional research incomplete";
    case "not_timely":
      return "Seasonal window passed";
    case "deferred":
      return "Deferred";
    case "scheduled":
      return input.formRec.assessing
        ? "Scheduled — assessing forms"
        : `${input.formRec.summary} · Planned`;
    case "complete":
      return "Approved for distribution";
    default:
      return "Monitoring";
  }
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
    const generating =
      topic?.workflow_status === "generating_content" ||
      topic?.workflow_status === "generating_plan" ||
      topic?.workflow_status === "generating_outputs" ||
      topic?.workflow_status === "generating_seo";

    const coverage = buildCoverage(key, rows, strategy, outputs);
    const regionalSourced = coverage.filter(
      (c) => c.id !== "international" && (c.status === "Sourced" || c.status === "Ready")
    );
    const needsKnowledgeDecision = rows.some(
      (r) => r.status === "candidate" || r.status === "stale"
    );
    const planAccepted = strategy.approval_status === "approved";
    const planReady = planReadyForAccept(strategy, topic);
    const hasDrafts = pendingOutputs.length > 0;
    const distributionReady = Boolean(prefs.distribution_ready_at) || (allApproved && outputs.length > 0);
    const formRec = recommendFormsForSubject(key, strategy);
    const deliverables = deliverablesFromOutputs(strategy, topic, outputs, formRec);

    const verifiedOrPublished = rows.some(
      (r) => r.status === "verified" || r.status === "published"
    );

    // --- Triage: human decision vs machine ---
    let filter: ControlFilter = "monitoring";
    let machineState: MachineState = "planning_queued";
    let actionLabel: PackageActionLabel = null;
    let primaryKind: PackagePrimaryKind = "none";
    let attentionGroup: AttentionGroup | null = null;
    let autoPlanEligible = false;

    if (prefs.deferred) {
      filter = "monitoring";
      machineState = "deferred";
    } else if (distributionReady && !hasDrafts) {
      filter = "complete";
      machineState = "complete";
      actionLabel = "View";
      primaryKind = "view";
    } else if (hasDrafts) {
      // Genuine decision: review / approve drafts
      filter = "attention";
      machineState = "ready_for_decision";
      if (planAccepted) {
        actionLabel = pendingOutputs.length > 0 ? "Review drafts" : "Approve distribution";
        primaryKind =
          pendingOutputs.length > 0 ? "review_drafts" : "approve_distribution";
        // If drafts exist, Review drafts first; Approve distribution when user opens
        actionLabel = "Review drafts";
        primaryKind = "review_drafts";
      } else {
        actionLabel = "Review drafts";
        primaryKind = "review_drafts";
      }
      attentionGroup = "now";
    } else if (
      planAccepted &&
      outputs.length > 0 &&
      pendingOutputs.length === 0 &&
      !distributionReady
    ) {
      filter = "attention";
      machineState = "ready_for_decision";
      actionLabel = "Approve distribution";
      primaryKind = "approve_distribution";
      attentionGroup = "now";
    } else if (planReady) {
      // Plan exists → Accept plan is a real decision
      // Smoke: only if multi-region or international plan
      const smokeOk =
        key !== "smoke-carbon-monoxide-alarms" ||
        regionalSourced.length >= 2 ||
        coverage.some((c) => c.id === "international" && (c.status === "Ready" || c.status === "Sourced"));
      if (smokeOk || key === "chimney-flue-sweeping" || key === "before-heating-season") {
        filter = "attention";
        machineState = "ready_for_decision";
        actionLabel = "Accept plan";
        primaryKind = "accept_plan";
        attentionGroup = "now";
      } else {
        filter = "monitoring";
        machineState = "awaiting_coverage";
      }
    } else if (
      needsKnowledgeDecision &&
      (key === "chimney-flue-sweeping" ||
        (key === "smoke-carbon-monoxide-alarms" && regionalSourced.length >= 1))
    ) {
      // Exception path: Knowledge decision inside an active expression subject
      filter = "attention";
      machineState = "ready_for_decision";
      actionLabel = "Resolve gap";
      primaryKind = "resolve_gap";
      attentionGroup = "now";
    } else if (generating) {
      filter = "scheduled";
      machineState = "planning";
      actionLabel = "View";
      primaryKind = "view";
    } else if (planAccepted && outputs.length === 0) {
      // Machine should generate — not a human "ready to plan" stop
      filter = "scheduled";
      machineState = "planning";
      actionLabel = "View";
      primaryKind = "view";
      autoPlanEligible = true; // kick content generation
    } else if (!topic || !hasPlanRecommendation(strategy)) {
      // Machine work — never Needs attention
      if (!verifiedOrPublished && !needsKnowledgeDecision) {
        filter = "monitoring";
        machineState = "awaiting_coverage";
      } else if (
        key === "anti-drowning-safety" &&
        !heating &&
        monthIndex >= 3 &&
        monthIndex <= 8
      ) {
        // Pool season roughly late spring–summer; outside → not timely in heating months
        filter = "monitoring";
        machineState = heating ? "not_timely" : "planning_queued";
        autoPlanEligible = !heating && verifiedOrPublished;
      } else if (key === "anti-drowning-safety" && heating) {
        filter = "monitoring";
        machineState = "not_timely";
      } else if (
        (key === "before-heating-season" || key === "chimney-flue-sweeping") &&
        heating &&
        verifiedOrPublished
      ) {
        filter = "monitoring";
        machineState = "planning_queued";
        autoPlanEligible = true;
      } else if (key === "smoke-carbon-monoxide-alarms" && regionalSourced.length >= 2) {
        filter = "monitoring";
        machineState = "planning_queued";
        autoPlanEligible = true;
      } else if (key === "smoke-carbon-monoxide-alarms") {
        filter = "monitoring";
        machineState = "awaiting_coverage";
      } else if (topic && generating) {
        filter = "scheduled";
        machineState = "planning";
      } else if (
        key === "before-heating-season" &&
        heating &&
        hasPlanRecommendation(strategy)
      ) {
        filter = "scheduled";
        machineState = "scheduled";
        actionLabel = "View";
        primaryKind = "view";
      } else {
        filter = "monitoring";
        machineState =
          verifiedOrPublished || needsKnowledgeDecision
            ? "planning_queued"
            : "awaiting_coverage";
        autoPlanEligible =
          verifiedOrPublished &&
          (key === "chimney-flue-sweeping" ||
            key === "before-heating-season" ||
            (key === "smoke-carbon-monoxide-alarms" && regionalSourced.length >= 2));
      }
    } else if (topic && hasPlanRecommendation(strategy) && !planAccepted) {
      // Should have been caught by planReady — fallback accept
      filter = "attention";
      machineState = "ready_for_decision";
      actionLabel = "Accept plan";
      primaryKind = "accept_plan";
      attentionGroup = "now";
    } else {
      filter = "monitoring";
      machineState = "assessing_opportunity";
    }

    // Pilot boost: chimney with verified FR + heating → if still monitoring queued, keep auto-plan
    if (
      key === "chimney-flue-sweeping" &&
      heating &&
      verifiedOrPublished &&
      filter === "monitoring" &&
      machineState === "planning_queued"
    ) {
      autoPlanEligible = true;
    }

    const why =
      meaningfulWhy({
        key,
        prefs,
        monthIndex,
        coverage,
        machineState,
        hasDrafts,
        planReady: planReady || planAccepted,
      }) ??
      (filter === "attention"
        ? "Decision required"
        : machineState === "planning_queued"
          ? "Planning queued"
          : machineState === "awaiting_coverage"
            ? "Regional research incomplete"
            : machineState === "not_timely"
              ? "No timely Expression opportunity; monitoring"
              : machineState === "scheduled"
                ? "Planned for September"
                : "Monitoring");

    // Deliverables line: never guess article+image before recommendation
    let deliverablesSummary: string;
    if (filter === "attention" && hasDrafts) {
      deliverablesSummary = formRec.assessing
        ? "Drafts ready"
        : formRec.summary;
    } else if (hasPlanRecommendation(strategy)) {
      deliverablesSummary = formRec.summary;
    } else if (machineState === "planning_queued" || machineState === "planning") {
      deliverablesSummary = "Assessing opportunity";
    } else if (machineState === "scheduled") {
      deliverablesSummary = formRec.assessing
        ? "International package · assessing forms"
        : formRec.summary;
    } else {
      deliverablesSummary = outcomeLine({
        machineState,
        actionLabel,
        formRec,
        hasDrafts,
        coverage,
      });
    }

    const outcome = outcomeLine({
      machineState,
      actionLabel,
      formRec,
      hasDrafts,
      coverage,
    });

    let rank = 0;
    if (filter === "attention") rank += 500;
    if (attentionGroup === "now") rank += 100;
    if (key === "chimney-flue-sweeping") rank += 80;
    if (key === "smoke-carbon-monoxide-alarms") rank += 70;
    if (key === "before-heating-season") rank += 60;
    if (prefs.pinned) rank += 200;
    if (actionLabel === "Review drafts") rank += 40;
    if (actionLabel === "Accept plan") rank += 30;
    rank += Math.max(...rows.map((r) => new Date(r.updated_at).getTime()), 0) / 1e12;

    packages.push({
      id: topic?.id ?? `subject:${key}`,
      subjectKey: key,
      title: subjectDisplayTitle(key, rows[0]?.title ?? key),
      knowledgeRows: rows,
      topic,
      prefs,
      strategy,
      filter,
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
      primaryKnowledgeId: topic?.knowledge_id ?? rows.find((r) => r.status === "verified" || r.status === "published")?.id ?? rows[0]?.id ?? null,
    });
  }

  for (const topic of input.topics) {
    if (topic.status === "archived" || usedTopicIds.has(topic.id)) continue;
    const key = subjectKeyFromTitle(topic.title);
    if (byKey.has(key)) continue;
    const strategy = normalizeParentStrategy(topic.strategy ?? {});
    const prefs = parseSchedulePrefs(topic.publishing);
    const formRec = recommendFormsForSubject(key, strategy);
    packages.push({
      id: topic.id,
      subjectKey: key,
      title: subjectDisplayTitle(key, topic.title),
      knowledgeRows: [],
      topic,
      prefs,
      strategy,
      filter: prefs.distribution_ready_at ? "complete" : "monitoring",
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

  packages.sort((a, b) => b.rank - a.rank);
  return packages;
}

export function filterCounts(packages: SubjectPackage[]): Record<ControlFilter, number> {
  return {
    attention: packages.filter((p) => p.filter === "attention").length,
    scheduled: packages.filter((p) => p.filter === "scheduled").length,
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
