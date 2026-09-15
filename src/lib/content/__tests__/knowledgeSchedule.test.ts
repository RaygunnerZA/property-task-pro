import { describe, expect, it } from "vitest";
import {
  buildScheduleItems,
  groupScheduleItems,
  isHeatingSeasonMonth,
  mergeSchedulePrefsIntoPublishing,
  parseSchedulePrefs,
} from "@/lib/content/knowledgeSchedule";
import type { ContentTopicRow } from "@/types/knowledge";

function topic(partial: Partial<ContentTopicRow> & Pick<ContentTopicRow, "id" | "title">): ContentTopicRow {
  return {
    knowledge_id: "k1",
    status: "active",
    workflow_status: "plan_review",
    content_scope: "international_overview",
    channel: "website_blog_social",
    strategy: {
      approval_status: "pending",
      content_scope: "international_overview",
      primary_form: "informational_article",
      derivative_forms: ["social_carousel", "social_post"],
      supporting_content: [
        { label: "France country guide", kind: "country_guide", jurisdiction: "France", status: "suggested" },
      ],
      exclusions: [],
      source_gaps: [],
    },
    seo: {},
    brief: {},
    creative: {},
    publishing: {},
    knowledge_version: 1,
    applicability_snapshot: {},
    upstream_hash: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-15T00:00:00Z",
    ...partial,
  };
}

describe("knowledgeSchedule", () => {
  it("treats Sep–Nov as heating season", () => {
    expect(isHeatingSeasonMonth(8)).toBe(true);
    expect(isHeatingSeasonMonth(0)).toBe(false);
  });

  it("pins chimney pilot into Now with a plain reason", () => {
    const items = buildScheduleItems(
      [
        topic({
          id: "t1",
          title: "Chimney and flue sweeping",
          publishing: { schedule: { pinned: true, reason_override: "Pinned for pilot" } },
        }),
      ],
      { now: new Date("2026-09-15T12:00:00Z") }
    );
    expect(items[0].group).toBe("now");
    expect(items[0].reason).toBe("Pinned for pilot");
    expect(items[0].nextAction.kind).toBe("accept_for_production");
    expect(items[0].regionalLayers.some((l) => /france/i.test(l.label))).toBe(true);
    expect(items[0].forms.join(" · ")).toMatch(/article/i);
  });

  it("uses seasonal plain-language reason when not pinned", () => {
    const items = buildScheduleItems(
      [topic({ id: "t1", title: "Chimney and flue sweeping" })],
      { now: new Date("2026-09-15T12:00:00Z") }
    );
    expect(items[0].reason).toMatch(/seasonally|france|pilot/i);
  });

  it("puts deferred packages in Monitoring", () => {
    const items = buildScheduleItems([
      topic({
        id: "t1",
        title: "Something deferred",
        publishing: { schedule: { deferred: true } },
      }),
    ]);
    expect(items[0].group).toBe("monitoring");
  });

  it("flags Approve distribution when drafts exist", () => {
    const items = buildScheduleItems(
      [
        topic({
          id: "t1",
          title: "Chimney and flue sweeping",
          workflow_status: "content_review",
          strategy: {
            approval_status: "approved",
            content_scope: "international_overview",
            primary_form: "informational_article",
            derivative_forms: ["social_post"],
            supporting_content: [],
            exclusions: [],
            source_gaps: [],
          },
        }),
      ],
      {
        outputsByTopicId: {
          t1: [
            {
              id: "o1",
              topic_id: "t1",
              output_kind: "core_article",
              status: "needs_review",
              title: "Article",
              body: "…",
              structured: {},
              provenance: {},
              version: 1,
              approved_by: null,
              approved_at: null,
              created_at: "2026-09-15T00:00:00Z",
              updated_at: "2026-09-15T00:00:00Z",
            },
          ],
        },
      }
    );
    expect(items[0].nextAction.kind).toBe("approve_distribution");
    expect(items[0].nextAction.label).toBe("Approve distribution");
  });

  it("groups schedule buckets in order", () => {
    const grouped = groupScheduleItems(
      buildScheduleItems([
        topic({ id: "a", title: "Chimney and flue sweeping", publishing: { schedule: { pinned: true } } }),
        topic({
          id: "b",
          title: "Deferred topic",
          publishing: { schedule: { deferred: true } },
        }),
      ])
    );
    expect(grouped.now.length).toBeGreaterThan(0);
    expect(grouped.monitoring.length).toBeGreaterThan(0);
  });

  it("merges schedule prefs into publishing without implying distribution happened", () => {
    const merged = mergeSchedulePrefsIntoPublishing(
      {},
      { pinned: true, distribution_ready_at: "2026-09-15T12:00:00Z" }
    );
    expect(parseSchedulePrefs(merged).pinned).toBe(true);
    expect(parseSchedulePrefs(merged).distribution_ready_at).toBe("2026-09-15T12:00:00Z");
    expect(JSON.stringify(merged)).not.toMatch(/distributed_at|published_at/);
  });
});
