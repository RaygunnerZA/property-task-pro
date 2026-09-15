import { describe, expect, it } from "vitest";
import {
  chimneyInternationalLaunchExpectation,
  inferContentScope,
  normalizeParentStrategy,
  recommendContentPlan,
  resolveVisibleStage,
  scopeLabel,
} from "@/lib/content/contentPlan";

describe("contentPlan Phase 2", () => {
  it("infers international overview for marketing channel when unscoped", () => {
    expect(
      inferContentScope({ channel: "website_blog_social", unscoped: true })
    ).toBe("international_overview");
  });

  it("infers country guide for an explicit country channel", () => {
    expect(
      inferContentScope({ channel: "country_guide", jurisdictions: ["France"] })
    ).toBe("country_guide");
  });

  it("infers international overview for marketing channel even with one jurisdiction", () => {
    expect(
      inferContentScope({ channel: "website_blog_social", jurisdictions: ["France"] })
    ).toBe("international_overview");
  });

  it("chimney marketing plan without override still recommends international overview", () => {
    const plan = recommendContentPlan({
      channel: "website_blog_social",
      knowledgeTitle: "Chimney / flue sweeping",
      jurisdictions: ["France"],
      propertyJurisdictionKnown: false,
    });
    expect(plan.content_scope).toBe("international_overview");
    expect(plan.primary_form).toBe("informational_article");
    expect(plan.derivative_forms).toContain("social_carousel");
    expect(plan.supporting_content.some((s) => /france country guide/i.test(s.label))).toBe(true);
    expect(plan.exclusions.some((e) => e.form === "in_app_tip" && e.gap_kind === "not_applicable")).toBe(
      true
    );
  });

  it("chimney launch recommends international overview + article + social; France guide; in-app excluded", () => {
    const plan = chimneyInternationalLaunchExpectation();
    expect(plan.content_scope).toBe("international_overview");
    expect(scopeLabel(plan.content_scope)).toBe("International overview");
    expect(plan.primary_form).toBe("informational_article");
    expect(plan.derivative_forms).toEqual(["social_carousel", "social_post"]);
    expect(plan.supporting_content.some((s) => /france country guide/i.test(s.label))).toBe(
      true
    );
    expect(plan.exclusions.some((e) => e.form === "in_app_tip")).toBe(true);
    expect(plan.exclusions.find((e) => e.form === "in_app_tip")?.gap_kind).toBe(
      "not_applicable"
    );
  });

  it("keeps in-app excluded when property jurisdiction is unknown", () => {
    const plan = recommendContentPlan({
      channel: "website_blog_social",
      knowledgeTitle: "Chimney sweeping",
      jurisdictions: ["France"],
      propertyJurisdictionKnown: false,
    });
    // Without override, single FR jurisdiction → country_guide; tip still excluded (not property_specific)
    expect(plan.exclusions.some((e) => e.form === "in_app_tip")).toBe(true);
  });

  it("normalizes strategy envelopes and gap kinds", () => {
    const plan = normalizeParentStrategy({
      approval_status: "pending",
      content_scope: "international_overview",
      primary_form: "informational_article",
      derivative_forms: ["social_carousel", "social_post", "bogus"],
      exclusions: [{ form: "in_app_tip", reason: "No property context", gap_kind: "not_applicable" }],
      source_gaps: [{ text: "Local fine amounts", gap_kind: "not_yet_researched" }],
      supporting_content: [{ label: "France country guide", kind: "country_guide" }],
    });
    expect(plan.derivative_forms).toEqual(["social_carousel", "social_post"]);
    expect(plan.exclusions[0]?.gap_kind).toBe("not_applicable");
    expect(plan.source_gaps[0]?.gap_kind).toBe("not_yet_researched");
  });

  it("maps visible stages with progressive disclosure", () => {
    expect(
      resolveVisibleStage({
        hasTopic: false,
        strategy: normalizeParentStrategy({}),
        formatBriefs: [],
        outputs: [],
      })
    ).toBe("choose");

    expect(
      resolveVisibleStage({
        hasTopic: true,
        strategy: normalizeParentStrategy({ approval_status: "pending" }),
        formatBriefs: [],
        outputs: [],
      })
    ).toBe("plan");

    expect(
      resolveVisibleStage({
        hasTopic: true,
        strategy: normalizeParentStrategy({ approval_status: "approved" }),
        formatBriefs: [{ id: "1", topic_id: "t", form_kind: "informational_article", status: "generated", is_primary: true, body: {}, blocker: null, gap_kind: null, output_id: "o" }],
        outputs: [{ status: "needs_review" }],
        workflowStatus: "content_review",
      })
    ).toBe("content");
  });
});
