import { describe, expect, it } from "vitest";
import {
  isAreaSpace,
  partitionPropertySpaces,
  toOnboardingAreas,
} from "@/lib/spaces/partitionPropertySpaces";

describe("partitionPropertySpaces", () => {
  it("treats known area names and parents with children as areas", () => {
    const spaces = [
      { id: "a1", name: "Ground Floor", parent_space_id: null, created_at: "2026-01-01" },
      { id: "r1", name: "Kitchen", parent_space_id: "a1", created_at: "2026-01-02" },
      { id: "r2", name: "Hall", parent_space_id: null, created_at: "2026-01-03" },
    ];
    expect(isAreaSpace(spaces[0], spaces)).toBe(true);
    expect(isAreaSpace(spaces[2], spaces)).toBe(false);

    const { areas, roomsByAreaId, unassigned } = partitionPropertySpaces(spaces);
    expect(areas.map((a) => a.id)).toEqual(["a1"]);
    expect(roomsByAreaId.a1.map((r) => r.id)).toEqual(["r1"]);
    expect(unassigned.map((r) => r.id)).toEqual(["r2"]);
  });

  it("maps areas to onboarding chip colours", () => {
    const areas = toOnboardingAreas([
      { id: "a1", name: "Ground Floor", parent_space_id: null },
    ]);
    expect(areas[0]).toMatchObject({ id: "a1", name: "Ground Floor" });
    expect(areas[0].color).toMatch(/^#/);
  });

  it("treats layers+floor_level area inserts as areas before they have children", () => {
    const spaces = [
      {
        id: "a1",
        name: "Wing A",
        parent_space_id: null,
        icon_name: "layers",
        floor_level: "Wing A",
        created_at: "2026-01-01",
      },
      { id: "r1", name: "Kitchen", parent_space_id: null, created_at: "2026-01-02" },
    ];
    const { areas, unassigned } = partitionPropertySpaces(spaces);
    expect(areas.map((a) => a.id)).toEqual(["a1"]);
    expect(unassigned.map((r) => r.id)).toEqual(["r1"]);
  });
});
