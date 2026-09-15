import { describe, expect, it } from "vitest";
import {
  canApproveSeasonalPackage,
  creativeMeetsSurfaceRequirements,
  deriveSeasonalReleaseState,
  evaluateSeasonalReleaseGates,
  normalizeCreative,
  packageStoragePrefix,
  primarySeasonalAction,
  type SeasonalPackageAdminItem,
  type SeasonalPackageAdminRow,
} from "@/lib/seasonal/seasonalPackageRelease";

function item(
  partial: Partial<SeasonalPackageAdminItem> & Pick<SeasonalPackageAdminItem, "id" | "knowledge_id" | "tip_text">
): SeasonalPackageAdminItem {
  return {
    tip_output_id: null,
    why_now: null,
    cta_type: "create_task",
    cta_label: "Create task",
    display_order: 1,
    knowledge_title: "Title",
    knowledge_summary: null,
    knowledge_status: "published",
    ...partial,
  };
}

function row(
  partial: Partial<SeasonalPackageAdminRow> & Pick<SeasonalPackageAdminRow, "id" | "slug" | "title">
): SeasonalPackageAdminRow {
  return {
    introduction: "Heating season is approaching with clear guidance for owners.",
    season: "autumn",
    hemisphere: "northern",
    display_from: "2026-08-15",
    display_until: "2026-10-31",
    urgency_band: "timely",
    prep_window_label: "Aug–Oct",
    applicability: { audiences: ["owner"] },
    status: "draft",
    version: 1,
    org_id: null,
    surfaces: ["home_inflow", "property_rail"],
    creative: normalizeCreative({ status: "missing" }),
    items: [
      item({
        id: "i1",
        knowledge_id: "k1",
        tip_text: "Book a heating-system service before cold weather.",
      }),
    ],
    ...partial,
  };
}

describe("seasonalPackageRelease", () => {
  it("treats draft autumn seed as draft (not live)", () => {
    const autumn = row({
      id: "b1000000-0000-4000-8000-000000000001",
      slug: "before-autumn-heating-2026",
      title: "5 things to get done before Autumn",
      status: "draft",
    });
    expect(deriveSeasonalReleaseState(autumn, new Date("2026-09-14T12:00:00Z"))).toBe(
      "ready_for_review"
    );
  });

  it("derives scheduled for approved future packages", () => {
    const pkg = row({
      id: "future",
      slug: "future",
      title: "Winter",
      status: "approved",
      display_from: "2026-11-01",
      display_until: "2027-02-28",
    });
    expect(deriveSeasonalReleaseState(pkg, new Date("2026-09-14T12:00:00Z"))).toBe("scheduled");
  });

  it("derives live for approved in-window packages", () => {
    const pkg = row({
      id: "live",
      slug: "live",
      title: "Autumn",
      status: "approved",
    });
    expect(deriveSeasonalReleaseState(pkg, new Date("2026-09-14T12:00:00Z"))).toBe("live");
  });

  it("derives archived", () => {
    const pkg = row({
      id: "arch",
      slug: "arch",
      title: "Old",
      status: "archived",
    });
    expect(deriveSeasonalReleaseState(pkg, new Date("2026-09-14T12:00:00Z"))).toBe("archived");
  });

  it("blocks approval when Knowledge is unpublished", () => {
    const gates = evaluateSeasonalReleaseGates({
      title: "Package",
      introduction: "A meaningful introduction for the package.",
      display_from: "2026-08-15",
      display_until: "2026-10-31",
      surfaces: ["home_inflow"],
      creative: normalizeCreative({ status: "missing" }),
      items: [
        item({
          id: "i1",
          knowledge_id: "k1",
          tip_text: "Useful tip text ready to show.",
          knowledge_status: "verified",
        }),
      ],
    });
    expect(gates.find((g) => g.id === "published_knowledge")?.pass).toBe(false);
    expect(canApproveSeasonalPackage(gates)).toBe(false);
  });

  it("blocks approval when tip content is missing", () => {
    const gates = evaluateSeasonalReleaseGates({
      title: "Package",
      introduction: "A meaningful introduction for the package.",
      display_from: "2026-08-15",
      display_until: "2026-10-31",
      surfaces: ["home_inflow"],
      creative: normalizeCreative({ status: "missing" }),
      items: [
        item({
          id: "i1",
          knowledge_id: "k1",
          tip_text: "short",
        }),
      ],
    });
    expect(gates.find((g) => g.id === "tip_ready")?.pass).toBe(false);
    expect(canApproveSeasonalPackage(gates)).toBe(false);
  });

  it("enforces creative only for surfaces that need it", () => {
    const homeOnly = creativeMeetsSurfaceRequirements(
      normalizeCreative({ status: "missing" }),
      ["home_inflow", "property_rail"]
    );
    expect(homeOnly).toBe(true);

    const libraryMissing = creativeMeetsSurfaceRequirements(
      normalizeCreative({ status: "missing" }),
      ["knowledge_library"]
    );
    expect(libraryMissing).toBe(false);

    const libraryReady = creativeMeetsSurfaceRequirements(
      normalizeCreative({
        status: "approved",
        square_path: "packages/x/square.webp",
        alt_text: "Autumn prep illustration",
      }),
      ["knowledge_library"]
    );
    expect(libraryReady).toBe(true);
  });

  it("chooses approve and schedule vs publish from window", () => {
    expect(
      primarySeasonalAction("ready_for_review", "2026-11-01", new Date("2026-09-14T12:00:00Z")).kind
    ).toBe("approve_schedule");
    expect(
      primarySeasonalAction("ready_for_review", "2026-08-15", new Date("2026-09-14T12:00:00Z")).kind
    ).toBe("approve_publish");
  });

  it("builds stable package storage prefixes", () => {
    expect(packageStoragePrefix("Before Autumn Heating 2026")).toBe(
      "packages/before-autumn-heating-2026"
    );
  });
});
