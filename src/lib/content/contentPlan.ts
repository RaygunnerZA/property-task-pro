/**
 * Phase 2 Content Tree — parent strategy / plan helpers.
 * Progressive UX shows choose → review plan → review content;
 * independent format-brief statuses live in the data model.
 */

export const CONTENT_SCOPES = [
  "international_overview",
  "regional_comparison",
  "country_guide",
  "local_guide",
  "property_specific",
] as const;

export type ContentScope = (typeof CONTENT_SCOPES)[number];

export const CONTENT_FORM_KINDS = [
  "informational_article",
  "faq",
  "compliance_checklist",
  "social_post",
  "social_carousel",
  "in_app_tip",
  "regulatory_guide",
  "newsletter",
] as const;

export type ContentFormKind = (typeof CONTENT_FORM_KINDS)[number];

export type ContentGapKind = "not_yet_researched" | "not_applicable" | "applicability_conflict";

export type ContentPlanExclusion = {
  form: ContentFormKind;
  reason: string;
  gap_kind: ContentGapKind;
};

export type ContentSupportingPointer = {
  label: string;
  kind?: string;
  status?: "planned" | "linked" | "suggested";
  jurisdiction?: string;
};

export type ContentParentStrategy = {
  approval_status: "none" | "pending" | "approved" | "rejected";
  content_scope: ContentScope | "";
  scope_inferred: boolean;
  channel: string;
  audience: string;
  market: string;
  objective: string;
  primary_form: ContentFormKind | "";
  derivative_forms: ContentFormKind[];
  supporting_content: ContentSupportingPointer[];
  exclusions: ContentPlanExclusion[];
  source_gaps: Array<{ text: string; gap_kind: ContentGapKind }>;
  confirmed_at?: string | null;
};

export type ContentFormatBriefRow = {
  id: string;
  topic_id: string;
  form_kind: ContentFormKind;
  status: string;
  is_primary: boolean;
  body: Record<string, unknown>;
  blocker: Record<string, unknown> | null;
  gap_kind: ContentGapKind | null;
  output_id: string | null;
};

export type VisibleContentStage = "choose" | "plan" | "content";

export function asContentScope(value: unknown): ContentScope | "" {
  const raw = typeof value === "string" ? value.trim() : "";
  return (CONTENT_SCOPES as readonly string[]).includes(raw) ? (raw as ContentScope) : "";
}

export function asContentFormKind(value: unknown): ContentFormKind | "" {
  const raw = typeof value === "string" ? value.trim() : "";
  return (CONTENT_FORM_KINDS as readonly string[]).includes(raw) ? (raw as ContentFormKind) : "";
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asFormList(value: unknown): ContentFormKind[] {
  if (!Array.isArray(value)) return [];
  const out: ContentFormKind[] = [];
  for (const item of value) {
    const form = asContentFormKind(item);
    if (form && !out.includes(form)) out.push(form);
  }
  return out;
}

export function normalizeParentStrategy(raw: unknown): ContentParentStrategy {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const exclusionsRaw = Array.isArray(obj.exclusions) ? obj.exclusions : [];
  const exclusions: ContentPlanExclusion[] = [];
  for (const item of exclusionsRaw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const form = asContentFormKind(rec.form ?? rec.form_kind);
    if (!form) continue;
    const gap = asText(rec.gap_kind);
    exclusions.push({
      form,
      reason: asText(rec.reason) || "Excluded from this plan",
      gap_kind:
        gap === "not_yet_researched" || gap === "applicability_conflict"
          ? gap
          : "not_applicable",
    });
  }

  const gapsRaw = Array.isArray(obj.source_gaps) ? obj.source_gaps : [];
  const source_gaps: ContentParentStrategy["source_gaps"] = [];
  for (const item of gapsRaw) {
    if (typeof item === "string" && item.trim()) {
      source_gaps.push({ text: item.trim(), gap_kind: "not_yet_researched" });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const text = asText(rec.text ?? rec.label);
    if (!text) continue;
    const gap = asText(rec.gap_kind);
    source_gaps.push({
      text,
      gap_kind:
        gap === "not_applicable" || gap === "applicability_conflict"
          ? gap
          : "not_yet_researched",
    });
  }

  const supportingRaw = Array.isArray(obj.supporting_content) ? obj.supporting_content : [];
  const supporting_content: ContentSupportingPointer[] = supportingRaw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((rec) => ({
      label: asText(rec.label ?? rec.title),
      kind: asText(rec.kind) || undefined,
      status: (asText(rec.status) as ContentSupportingPointer["status"]) || "suggested",
      jurisdiction: asText(rec.jurisdiction) || undefined,
    }))
    .filter((s) => s.label.length > 0);

  const approval = asText(obj.approval_status);
  return {
    approval_status:
      approval === "approved" || approval === "pending" || approval === "rejected"
        ? approval
        : "none",
    content_scope: asContentScope(obj.content_scope),
    scope_inferred: obj.scope_inferred !== false,
    channel: asText(obj.channel) || "website_blog_social",
    audience: asText(obj.audience),
    market: asText(obj.market),
    objective: asText(obj.objective),
    primary_form: asContentFormKind(obj.primary_form),
    derivative_forms: asFormList(obj.derivative_forms),
    supporting_content,
    exclusions,
    source_gaps,
    confirmed_at: asText(obj.confirmed_at) || null,
  };
}

export function formKindLabel(form: ContentFormKind | string): string {
  switch (form) {
    case "informational_article":
      return "Informational article";
    case "faq":
      return "FAQ";
    case "compliance_checklist":
      return "Compliance checklist";
    case "social_post":
      return "Short social post";
    case "social_carousel":
      return "Social carousel";
    case "in_app_tip":
      return "In-app tip";
    case "regulatory_guide":
      return "Regulatory guide";
    case "newsletter":
      return "Newsletter";
    case "core_article":
      return "Article";
    default:
      return form;
  }
}

export function scopeLabel(scope: ContentScope | string): string {
  switch (scope) {
    case "international_overview":
      return "International overview";
    case "regional_comparison":
      return "Regional comparison";
    case "country_guide":
      return "Country guide";
    case "local_guide":
      return "Local guide";
    case "property_specific":
      return "Property-specific guidance";
    default:
      return scope || "Not set";
  }
}

export type ScopeInferenceInput = {
  channel?: string;
  jurisdictions?: string[];
  unscoped?: boolean;
  propertyJurisdictionKnown?: boolean;
};

/**
 * Infer likely content scope from channel + Knowledge applicability.
 * Marketing / blog+social defaults to international overview (country Knowledge
 * becomes a supporting country-guide pointer). Exact country/local scopes need
 * an explicit override or a country-focused channel.
 */
export function inferContentScope(input: ScopeInferenceInput): ContentScope {
  const channel = (input.channel ?? "website_blog_social").toLowerCase();
  const jurisdictions = (input.jurisdictions ?? []).map((j) => j.trim()).filter(Boolean);
  const inApp = channel.includes("in_app") || channel === "app";
  const countryChannel =
    channel.includes("country") || channel === "country_guide" || channel === "local_guide";

  if (inApp) {
    return input.propertyJurisdictionKnown ? "property_specific" : "country_guide";
  }
  if (countryChannel && jurisdictions.length === 1) return "country_guide";
  if (countryChannel && jurisdictions.length > 1) return "regional_comparison";
  // Default marketing launch pack
  if (
    channel.includes("blog") ||
    channel.includes("social") ||
    channel.includes("website") ||
    channel === "website_blog_social"
  ) {
    return "international_overview";
  }
  if (jurisdictions.length === 1) return "country_guide";
  if (jurisdictions.length > 1) return "regional_comparison";
  if (input.unscoped) return "international_overview";
  return "international_overview";
}

export type PlanRecommendationInput = {
  channel?: string;
  knowledgeTitle?: string;
  jurisdictions?: string[];
  unscoped?: boolean;
  propertyJurisdictionKnown?: boolean;
  scopeOverride?: ContentScope | "";
};

/**
 * Build a parent-strategy recommendation (SEO opportunity generated separately / together).
 * Chimney + marketing launch → international overview, article + social, France guide pointer,
 * in-app excluded.
 */
export function recommendContentPlan(input: PlanRecommendationInput): ContentParentStrategy {
  const inferred = inferContentScope({
    channel: input.channel,
    jurisdictions: input.jurisdictions,
    unscoped: input.unscoped,
    propertyJurisdictionKnown: input.propertyJurisdictionKnown,
  });
  const scope = input.scopeOverride || inferred;
  const title = (input.knowledgeTitle ?? "").toLowerCase();
  const looksChimney =
    /chimney|flue|ramonage|sweeping/.test(title) ||
    (input.jurisdictions ?? []).some((j) => /france/i.test(j));

  const exclusions: ContentPlanExclusion[] = [];
  if (scope !== "property_specific" || !input.propertyJurisdictionKnown) {
    exclusions.push({
      form: "in_app_tip",
      reason: "In-app tip excluded until exact property jurisdiction is known",
      gap_kind: "not_applicable",
    });
  }

  const supporting_content: ContentSupportingPointer[] = [];
  if (scope === "international_overview") {
    const juris = input.jurisdictions ?? [];
    if (looksChimney || juris.some((j) => /france/i.test(j))) {
      supporting_content.push({
        label: "France country guide",
        kind: "country_guide",
        status: "suggested",
        jurisdiction: "France",
      });
    } else if (juris.length === 1) {
      supporting_content.push({
        label: `${juris[0]} country guide`,
        kind: "country_guide",
        status: "suggested",
        jurisdiction: juris[0],
      });
    }
  }

  let primary_form: ContentFormKind = "informational_article";
  let derivative_forms: ContentFormKind[] = ["social_carousel", "social_post"];
  if (scope === "country_guide" || scope === "local_guide") {
    primary_form = "informational_article";
    derivative_forms = ["faq", "compliance_checklist", "social_post"];
  }
  if (scope === "property_specific") {
    primary_form = "in_app_tip";
    derivative_forms = [];
  }

  return {
    approval_status: "pending",
    content_scope: scope,
    scope_inferred: !input.scopeOverride,
    channel: input.channel ?? "website_blog_social",
    audience: scope === "international_overview"
      ? "English-speaking property owners and managers researching cross-border obligations"
      : "Property owners and managers in the linked jurisdiction",
    market:
      scope === "international_overview"
        ? "English · international"
        : (input.jurisdictions ?? []).join(", ") || "Jurisdiction from Knowledge",
    objective:
      scope === "international_overview"
        ? "Publish a concise overview that frames the topic and routes precise obligations to country guides"
        : "Explain jurisdiction-exact requirements grounded in linked Knowledge",
    primary_form,
    derivative_forms,
    supporting_content,
    exclusions,
    source_gaps: [],
    confirmed_at: null,
  };
}

export function formKindToOutputKind(form: ContentFormKind): string {
  switch (form) {
    case "informational_article":
    case "regulatory_guide":
      return "core_article";
    case "faq":
      return "faq";
    case "compliance_checklist":
      return "compliance_checklist";
    case "social_post":
      return "social_post";
    case "social_carousel":
      return "social_carousel";
    case "in_app_tip":
      return "in_app_tip";
    case "newsletter":
      return "newsletter";
    default:
      return "core_article";
  }
}

export function resolveVisibleStage(input: {
  hasTopic: boolean;
  strategy: ContentParentStrategy;
  formatBriefs: ContentFormatBriefRow[];
  outputs: Array<{ status: string }>;
  workflowStatus?: string;
}): VisibleContentStage {
  if (!input.hasTopic) return "choose";
  const planApproved = input.strategy.approval_status === "approved";
  const hasGenerated =
    input.outputs.length > 0 ||
    input.formatBriefs.some((b) => b.status === "generated" || b.status === "generating");
  if (
    planApproved &&
    (hasGenerated ||
      input.workflowStatus === "content_review" ||
      input.workflowStatus === "output_review" ||
      input.workflowStatus === "generating_content" ||
      input.workflowStatus === "generating_outputs")
  ) {
    return "content";
  }
  return "plan";
}

export function planNextAction(input: {
  stage: VisibleContentStage;
  strategy: ContentParentStrategy;
  formatBriefs: ContentFormatBriefRow[];
  outputs: Array<{ status: string; output_kind: string }>;
  generating?: boolean;
}): { label: string; kind: string; blocker?: string } {
  if (input.generating) {
    return { label: "Generating…", kind: "none" };
  }
  if (input.stage === "choose") {
    return { label: "Create topic and generate plan", kind: "create_and_generate" };
  }
  if (input.stage === "plan") {
    if (!input.strategy.primary_form || !input.strategy.content_scope) {
      return {
        label: "Complete the plan",
        kind: "edit_plan",
        blocker: "Choose a content scope and primary form",
      };
    }
    return { label: "Approve plan and generate", kind: "approve_plan" };
  }
  const pending = input.outputs.filter(
    (o) => o.status === "draft" || o.status === "needs_review"
  );
  if (pending.length > 0) {
    return { label: "Review and approve content", kind: "approve_outputs" };
  }
  const blocked = input.formatBriefs.filter((b) => b.status === "blocked");
  if (blocked.length > 0) {
    return {
      label: "Content ready",
      kind: "done",
      blocker: `${blocked.length} format${blocked.length === 1 ? "" : "s"} skipped (gaps or not applicable)`,
    };
  }
  return { label: "Content ready", kind: "done" };
}

/** Chimney launch pack expectation used in tests and generator hints. */
export function chimneyInternationalLaunchExpectation() {
  return recommendContentPlan({
    channel: "website_blog_social",
    knowledgeTitle: "Chimney / flue sweeping",
    jurisdictions: ["France"],
    // Marketing launch: treat as international overview even with a France-linked Knowledge row
    scopeOverride: "international_overview",
    propertyJurisdictionKnown: false,
  });
}
