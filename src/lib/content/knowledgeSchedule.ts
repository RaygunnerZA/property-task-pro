/**
 * Knowledge Schedule — heuristic ranking for topic packages.
 * Plain explanations only; no artificial intelligence scores.
 */

import {
  formKindLabel,
  normalizeParentStrategy,
  scopeLabel,
  type ContentFormKind,
  type ContentParentStrategy,
} from "@/lib/content/contentPlan";
import type {
  ContentOutputRow,
  ContentTopicRow,
  ContentTopicWorkflowStatus,
} from "@/types/knowledge";

export type ScheduleGroup = "now" | "next" | "later" | "monitoring";

export type ScheduleLayerReadiness = "ready" | "research_gap" | "not_applicable" | "planned" | "missing";

export type ScheduleLayer = {
  id: string;
  label: string;
  readiness: ScheduleLayerReadiness;
};

export type ScheduleState = "proposed" | "confirmed";

export type SchedulePrefs = {
  pinned?: boolean;
  deferred?: boolean;
  reason_override?: string;
  /** Proposed = machine calendar entry; Confirmed = human accepted for production. Neither means published. */
  schedule_state?: ScheduleState | null;
  /** Human-readable window, e.g. "Week of 22 September" or "Before heating season". */
  window_label?: string | null;
  /** Sort key for editorial calendar (ISO date or week start). */
  window_start?: string | null;
  /** ISO — package approved for channel readiness (not distributed). */
  distribution_ready_at?: string | null;
};

export type ScheduleItem = {
  topic: ContentTopicRow;
  group: ScheduleGroup;
  rank: number;
  reason: string;
  priorityLabel: string;
  international: ScheduleLayer;
  regionalLayers: ScheduleLayer[];
  forms: string[];
  visualReadiness: "missing" | "concept" | "ready";
  exception: string | null;
  nextAction: {
    kind:
      | "review_package"
      | "accept_for_production"
      | "review_expressions"
      | "approve_distribution"
      | "generating"
      | "monitoring"
      | "exception";
    label: string;
  };
  prefs: SchedulePrefs;
  strategy: ContentParentStrategy;
};

export const SCHEDULE_GROUP_LABELS: Record<ScheduleGroup, string> = {
  now: "Now",
  next: "Next",
  later: "Later",
  monitoring: "Monitoring",
};

const GROUP_ORDER: ScheduleGroup[] = ["now", "next", "later", "monitoring"];

export function parseSchedulePrefs(publishing: unknown): SchedulePrefs {
  const obj =
    publishing && typeof publishing === "object" && !Array.isArray(publishing)
      ? (publishing as Record<string, unknown>)
      : {};
  const schedule =
    obj.schedule && typeof obj.schedule === "object" && !Array.isArray(obj.schedule)
      ? (obj.schedule as Record<string, unknown>)
      : {};
  const distribution =
    obj.distribution && typeof obj.distribution === "object" && !Array.isArray(obj.distribution)
      ? (obj.distribution as Record<string, unknown>)
      : {};
  return {
    pinned: schedule.pinned === true,
    deferred: schedule.deferred === true,
    reason_override:
      typeof schedule.reason_override === "string" && schedule.reason_override.trim()
        ? schedule.reason_override.trim()
        : undefined,
    schedule_state:
      schedule.schedule_state === "proposed" || schedule.schedule_state === "confirmed"
        ? schedule.schedule_state
        : null,
    window_label:
      typeof schedule.window_label === "string" && schedule.window_label.trim()
        ? schedule.window_label.trim()
        : null,
    window_start:
      typeof schedule.window_start === "string" && schedule.window_start.trim()
        ? schedule.window_start.trim()
        : null,
    distribution_ready_at:
      typeof distribution.ready_at === "string" && distribution.ready_at
        ? distribution.ready_at
        : null,
  };
}

export function mergeSchedulePrefsIntoPublishing(
  publishing: unknown,
  patch: Partial<SchedulePrefs> & { clearDistributionReady?: boolean }
): Record<string, unknown> {
  const base =
    publishing && typeof publishing === "object" && !Array.isArray(publishing)
      ? { ...(publishing as Record<string, unknown>) }
      : {};
  const prev = parseSchedulePrefs(base);
  const schedule: Record<string, unknown> = {
    ...(typeof base.schedule === "object" && base.schedule && !Array.isArray(base.schedule)
      ? (base.schedule as Record<string, unknown>)
      : {}),
  };
  if (patch.pinned !== undefined) schedule.pinned = patch.pinned;
  if (patch.deferred !== undefined) schedule.deferred = patch.deferred;
  if (patch.reason_override !== undefined) {
    if (patch.reason_override) schedule.reason_override = patch.reason_override;
    else delete schedule.reason_override;
  }
  if (patch.schedule_state !== undefined) {
    if (patch.schedule_state) schedule.schedule_state = patch.schedule_state;
    else delete schedule.schedule_state;
  }
  if (patch.window_label !== undefined) {
    if (patch.window_label) schedule.window_label = patch.window_label;
    else delete schedule.window_label;
  }
  if (patch.window_start !== undefined) {
    if (patch.window_start) schedule.window_start = patch.window_start;
    else delete schedule.window_start;
  }
  const distribution: Record<string, unknown> = {
    ...(typeof base.distribution === "object" &&
    base.distribution &&
    !Array.isArray(base.distribution)
      ? (base.distribution as Record<string, unknown>)
      : {}),
  };
  if (patch.distribution_ready_at !== undefined) {
    distribution.ready_at = patch.distribution_ready_at;
  }
  if (patch.clearDistributionReady) {
    delete distribution.ready_at;
  }
  return {
    ...base,
    schedule: {
      ...schedule,
      pinned: patch.pinned ?? prev.pinned ?? false,
      deferred: patch.deferred ?? prev.deferred ?? false,
      schedule_state: patch.schedule_state ?? prev.schedule_state ?? undefined,
      window_label: patch.window_label ?? prev.window_label ?? undefined,
      window_start: patch.window_start ?? prev.window_start ?? undefined,
    },
    distribution,
  };
}

function isChimneyTitle(title: string): boolean {
  return /chimney|flue|ramonage|sweeping/i.test(title);
}

/** Northern-hemisphere heating / flue season heuristic (Sep–Nov). */
export function isHeatingSeasonMonth(monthIndex: number): boolean {
  return monthIndex >= 8 && monthIndex <= 10;
}

function readinessLabel(r: ScheduleLayerReadiness): string {
  switch (r) {
    case "ready":
      return "Ready";
    case "research_gap":
      return "Research gap";
    case "not_applicable":
      return "Not applicable";
    case "planned":
      return "Planned";
    default:
      return "Missing";
  }
}

export function layerReadinessLabel(r: ScheduleLayerReadiness): string {
  return readinessLabel(r);
}

function buildLayers(strategy: ContentParentStrategy, topic: ContentTopicRow): {
  international: ScheduleLayer;
  regionalLayers: ScheduleLayer[];
} {
  const scope = strategy.content_scope || topic.content_scope || "";
  const international: ScheduleLayer = {
    id: "international",
    label: scope === "international_overview" || scope === "regional_comparison"
      ? scopeLabel(scope)
      : scope === "country_guide" || scope === "local_guide"
        ? "No international layer (regional-only)"
        : "International overview",
    readiness:
      scope === "country_guide" || scope === "local_guide" || scope === "property_specific"
        ? "not_applicable"
        : strategy.primary_form
          ? "ready"
          : "missing",
  };

  const regionalLayers: ScheduleLayer[] = strategy.supporting_content
    .filter((s) => s.kind === "country_guide" || Boolean(s.jurisdiction))
    .map((s) => ({
      id: s.jurisdiction || s.label,
      label: s.jurisdiction || s.label,
      readiness:
        s.status === "linked" || s.status === "planned" || s.status === "suggested"
          ? ("planned" as const)
          : ("planned" as const),
    }));

  for (const gap of strategy.source_gaps) {
    if (/germany|deutschland/i.test(gap.text)) {
      regionalLayers.push({
        id: "Germany",
        label: "Germany",
        readiness: gap.gap_kind === "not_applicable" ? "not_applicable" : "research_gap",
      });
    }
    if (/united kingdom|\buk\b/i.test(gap.text)) {
      regionalLayers.push({
        id: "UK",
        label: "UK",
        readiness: gap.gap_kind === "not_applicable" ? "not_applicable" : "research_gap",
      });
    }
  }

  // Chimney pilot default: France layer from supporting content; UK N/A unless present
  if (isChimneyTitle(topic.title) && !regionalLayers.some((l) => /france/i.test(l.label))) {
    regionalLayers.push({
      id: "France",
      label: "France",
      readiness: "planned",
    });
  }
  if (
    isChimneyTitle(topic.title) &&
    !regionalLayers.some((l) => /^uk$/i.test(l.label) || /united kingdom/i.test(l.label))
  ) {
    regionalLayers.push({
      id: "UK",
      label: "UK",
      readiness: "not_applicable",
    });
  }

  // Deduplicate by label
  const seen = new Set<string>();
  const uniqueRegional = regionalLayers.filter((l) => {
    const key = l.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { international, regionalLayers: uniqueRegional };
}

function visualReadiness(creative: unknown): ScheduleItem["visualReadiness"] {
  const obj =
    creative && typeof creative === "object" && !Array.isArray(creative)
      ? (creative as Record<string, unknown>)
      : {};
  if (obj.master_approved === true || obj.family_status === "approved") return "ready";
  if (obj.concept_selected || obj.concept_grid || obj.status === "concept_review") return "concept";
  return "missing";
}

function formsFromStrategy(strategy: ContentParentStrategy): string[] {
  const forms: ContentFormKind[] = [];
  if (strategy.primary_form) forms.push(strategy.primary_form);
  for (const d of strategy.derivative_forms) {
    if (!forms.includes(d)) forms.push(d);
  }
  return forms.map(formKindLabel);
}

function nextActionFor(
  workflow: ContentTopicWorkflowStatus,
  strategy: ContentParentStrategy,
  prefs: SchedulePrefs,
  hasPendingOutputs: boolean,
  hasOutputs: boolean,
  generating: boolean
): ScheduleItem["nextAction"] {
  if (generating) {
    return { kind: "generating", label: "Generating…" };
  }
  if (workflow === "generation_failed") {
    return { kind: "exception", label: "Resolve exception" };
  }
  if (prefs.distribution_ready_at && !hasPendingOutputs) {
    return { kind: "monitoring", label: "Approved for distribution" };
  }
  if (hasOutputs && hasPendingOutputs) {
    return { kind: "approve_distribution", label: "Approve distribution" };
  }
  if (
    hasOutputs &&
    (workflow === "content_review" ||
      workflow === "output_review" ||
      workflow === "ready_for_publishing")
  ) {
    return { kind: "approve_distribution", label: "Approve distribution" };
  }
  if (
    strategy.approval_status === "approved" &&
    (workflow === "ready_for_outputs" ||
      workflow === "plan_review" ||
      workflow === "content_review")
  ) {
    if (!hasOutputs) {
      return { kind: "review_expressions", label: "Generate expressions" };
    }
  }
  if (strategy.primary_form && strategy.content_scope && strategy.approval_status !== "approved") {
    return { kind: "accept_for_production", label: "Accept for production" };
  }
  return { kind: "review_package", label: "Review package" };
}

function heuristicReason(input: {
  topic: ContentTopicRow;
  strategy: ContentParentStrategy;
  prefs: SchedulePrefs;
  monthIndex: number;
  nextKind: ScheduleItem["nextAction"]["kind"];
}): string {
  if (input.prefs.reason_override) return input.prefs.reason_override;
  if (input.prefs.pinned) return "Pinned for pilot";
  if (input.prefs.deferred) return "Deferred by administrator";
  if (input.nextKind === "exception") return "Generation failed — needs attention";
  if (input.prefs.distribution_ready_at) {
    return "Package approved for distribution; channel execution not started";
  }

  const chimney = isChimneyTitle(input.topic.title);
  const heating = isHeatingSeasonMonth(input.monthIndex);
  const france = input.strategy.supporting_content.some((s) =>
    /france/i.test(s.label + (s.jurisdiction ?? ""))
  );
  const intl = input.strategy.content_scope === "international_overview";

  if (chimney && heating && france && intl) {
    return "Seasonally relevant; France guidance planned; broad international overview";
  }
  if (chimney && heating) {
    return "Seasonally relevant; heating season approaching";
  }
  if (chimney && france) {
    return "Pilot package — international overview with France regional layer";
  }
  if (input.strategy.source_gaps.some((g) => g.gap_kind === "not_yet_researched")) {
    return "Source coverage incomplete — research gaps remain";
  }
  if (input.strategy.approval_status === "approved") {
    return "Plan accepted; expressions need review or distribution approval";
  }
  if (input.strategy.primary_form) {
    return "Plan ready for package review";
  }
  return "Awaiting package plan";
}

function assignGroup(input: {
  prefs: SchedulePrefs;
  nextKind: ScheduleItem["nextAction"]["kind"];
  workflow: ContentTopicWorkflowStatus;
  topicStatus: string;
}): ScheduleGroup {
  if (input.prefs.deferred || input.topicStatus === "archived") return "monitoring";
  if (input.nextKind === "monitoring") return "monitoring";
  if (input.nextKind === "exception") return "now";
  if (
    input.nextKind === "review_package" ||
    input.nextKind === "accept_for_production" ||
    input.nextKind === "approve_distribution" ||
    input.nextKind === "review_expressions"
  ) {
    return "now";
  }
  if (input.nextKind === "generating") return "next";
  if (
    input.workflow.startsWith("generating_") ||
    input.workflow === "seo_review" ||
    input.workflow === "brief_review"
  ) {
    return "next";
  }
  return "later";
}

function rankScore(item: Omit<ScheduleItem, "rank">): number {
  let score = 0;
  if (item.prefs.pinned) score += 1000;
  if (item.group === "now") score += 400;
  if (item.group === "next") score += 200;
  if (item.group === "later") score += 50;
  if (isChimneyTitle(item.topic.title)) score += 80;
  if (item.nextAction.kind === "approve_distribution") score += 40;
  if (item.nextAction.kind === "accept_for_production") score += 30;
  if (item.nextAction.kind === "exception") score += 90;
  score += new Date(item.topic.updated_at).getTime() / 1e12;
  return score;
}

export type BuildScheduleOptions = {
  now?: Date;
  /** Optional outputs keyed by topic id — improves Approve distribution detection. */
  outputsByTopicId?: Record<string, ContentOutputRow[]>;
};

export function buildScheduleItems(
  topics: ContentTopicRow[],
  options: BuildScheduleOptions = {}
): ScheduleItem[] {
  const now = options.now ?? new Date();
  const monthIndex = now.getMonth();

  const items: ScheduleItem[] = topics
    .filter((t) => t.status !== "archived")
    .map((topic) => {
      const strategy = normalizeParentStrategy(topic.strategy ?? {});
      const prefs = parseSchedulePrefs(topic.publishing);
      const outputs = options.outputsByTopicId?.[topic.id] ?? [];
      const hasOutputs = outputs.length > 0;
      const hasPendingOutputs = outputs.some(
        (o) => o.status === "draft" || o.status === "needs_review"
      );
      const generating =
        topic.workflow_status === "generating_plan" ||
        topic.workflow_status === "generating_content" ||
        topic.workflow_status === "generating_outputs" ||
        topic.workflow_status === "generating_seo" ||
        topic.workflow_status === "generating_brief" ||
        topic.workflow_status === "generating_final_assets";

      const nextAction = nextActionFor(
        topic.workflow_status,
        strategy,
        prefs,
        hasPendingOutputs,
        hasOutputs,
        generating
      );
      const { international, regionalLayers } = buildLayers(strategy, topic);
      const reason = heuristicReason({
        topic,
        strategy,
        prefs,
        monthIndex,
        nextKind: nextAction.kind,
      });
      const group = assignGroup({
        prefs,
        nextKind: nextAction.kind,
        workflow: topic.workflow_status,
        topicStatus: topic.status,
      });

      const base: Omit<ScheduleItem, "rank"> = {
        topic,
        group,
        reason,
        priorityLabel: prefs.pinned
          ? "Pinned"
          : group === "now"
            ? "High priority"
            : group === "next"
              ? "Upcoming"
              : group === "monitoring"
                ? "Monitoring"
                : "Later",
        international,
        regionalLayers,
        forms: formsFromStrategy(strategy),
        visualReadiness: visualReadiness(topic.creative),
        exception:
          topic.workflow_status === "generation_failed" ? "Generation failed" : null,
        nextAction,
        prefs,
        strategy,
      };
      return { ...base, rank: rankScore(base) };
    });

  items.sort((a, b) => b.rank - a.rank);
  return items;
}

export function groupScheduleItems(items: ScheduleItem[]): Record<ScheduleGroup, ScheduleItem[]> {
  const out: Record<ScheduleGroup, ScheduleItem[]> = {
    now: [],
    next: [],
    later: [],
    monitoring: [],
  };
  for (const item of items) {
    out[item.group].push(item);
  }
  return out;
}

export function scheduleGroupOrder(): ScheduleGroup[] {
  return [...GROUP_ORDER];
}
