import { describe, expect, it } from "vitest";
import {
  assetCountsBySpaceId,
  partitionAssetsBySpace,
} from "@/lib/assets/partitionPropertyAssets";

describe("partitionAssetsBySpace", () => {
  it("nests assets under space_id and keeps unassigned separate", () => {
    const assets = [
      { id: "a1", name: "Boiler", space_id: "kitchen" },
      { id: "a2", name: "Oven", space_id: "kitchen" },
      { id: "a3", name: "Mower", space_id: null },
      { id: "a4", name: "Gate", space_id: "exterior" },
    ];

    const { assetsBySpaceId, unassigned } = partitionAssetsBySpace(assets);
    expect(assetsBySpaceId.kitchen.map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(assetsBySpaceId.exterior.map((a) => a.id)).toEqual(["a4"]);
    expect(unassigned.map((a) => a.id)).toEqual(["a3"]);
  });

  it("counts assets per space", () => {
    const counts = assetCountsBySpaceId([
      { id: "a1", name: "Boiler", space_id: "kitchen" },
      { id: "a2", name: "Oven", space_id: "kitchen" },
      { id: "a3", name: "Mower", space_id: null },
    ]);
    expect(counts).toEqual({ kitchen: 2 });
  });
});
