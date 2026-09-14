import { describe, expect, it } from "vitest";
import {
  packageIsInDisplayWindow,
  pickTopSeasonalPackage,
  softRankSeasonalPackages,
  type SeasonalPackage,
} from "@/types/seasonalPackage";

function pkg(
  partial: Partial<SeasonalPackage> & Pick<SeasonalPackage, "id" | "slug" | "title">
): SeasonalPackage {
  return {
    introduction: "Intro",
    season: "autumn",
    hemisphere: "northern",
    display_from: "2026-08-15",
    display_until: "2026-10-31",
    urgency_band: "timely",
    prep_window_label: "Aug–Oct",
    applicability: {},
    status: "approved",
    version: 1,
    org_id: null,
    items: [],
    ...partial,
  };
}

describe("seasonalPackage helpers", () => {
  it("detects display window inclusively", () => {
    const autumn = pkg({
      id: "1",
      slug: "a",
      title: "Autumn",
      display_from: "2026-08-15",
      display_until: "2026-10-31",
    });
    expect(packageIsInDisplayWindow(autumn, new Date("2026-09-14T12:00:00Z"))).toBe(true);
    expect(packageIsInDisplayWindow(autumn, new Date("2026-08-15T12:00:00Z"))).toBe(true);
    expect(packageIsInDisplayWindow(autumn, new Date("2026-10-31T12:00:00Z"))).toBe(true);
    expect(packageIsInDisplayWindow(autumn, new Date("2026-08-14T12:00:00Z"))).toBe(false);
    expect(packageIsInDisplayWindow(autumn, new Date("2026-11-01T12:00:00Z"))).toBe(false);
  });

  it("ranks add_asset higher only as soft preference when no heating asset is recorded", () => {
    const withAssetCta = pkg({
      id: "asset",
      slug: "asset",
      title: "Add asset",
      items: [
        {
          id: "i1",
          knowledge_id: "k1",
          tip_output_id: null,
          tip_text: "Add your heating system so Filla can place tips in context.",
          why_now: null,
          cta_type: "add_asset",
          cta_label: "Add heating asset",
          display_order: 1,
          knowledge_title: "Heating",
          knowledge_summary: null,
        },
      ],
    });
    const withTaskCta = pkg({
      id: "task",
      slug: "task",
      title: "Tasks",
      display_from: "2026-09-01",
      items: [
        {
          id: "i2",
          knowledge_id: "k2",
          tip_output_id: null,
          tip_text: "Create a gutter check.",
          why_now: null,
          cta_type: "create_task",
          cta_label: "Create task",
          display_order: 1,
          knowledge_title: "Gutters",
          knowledge_summary: null,
        },
      ],
    });

    const ranked = softRankSeasonalPackages([withTaskCta, withAssetCta], {
      noHeatingAssetRecorded: true,
    });
    expect(ranked[0]?.id).toBe("asset");

    // Soft ranking must not invent a “boiler not serviced” claim — tip text stays additive.
    expect(ranked[0]?.items[0]?.tip_text.toLowerCase()).not.toMatch(/has not been serviced/);
  });

  it("ignores empty packages when picking top", () => {
    const empty = pkg({ id: "empty", slug: "empty", title: "Empty" });
    const filled = pkg({
      id: "filled",
      slug: "filled",
      title: "Filled",
      items: [
        {
          id: "i1",
          knowledge_id: "k1",
          tip_output_id: null,
          tip_text: "Test alarms.",
          why_now: null,
          cta_type: "create_task",
          cta_label: "Log test",
          display_order: 1,
          knowledge_title: "Alarms",
          knowledge_summary: null,
        },
      ],
    });
    expect(pickTopSeasonalPackage([empty, filled])?.id).toBe("filled");
    expect(pickTopSeasonalPackage([empty])).toBeNull();
  });
});
