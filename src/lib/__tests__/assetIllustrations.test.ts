import { describe, expect, it } from "vitest";
import {
  getAssetMiniCardIllustration,
  resolveAssetMiniCardIllustration,
} from "../assetIllustrations";

describe("resolveAssetMiniCardIllustration", () => {
  it("matches common appliance names to workbench asset icons", () => {
    expect(resolveAssetMiniCardIllustration("Dishwasher")).toBe(
      "/icons/workbench/assets/dishwasher.png"
    );
    expect(resolveAssetMiniCardIllustration("Air Conditioning")).toBe(
      "/icons/workbench/assets/air-conditioner.png"
    );
    expect(resolveAssetMiniCardIllustration("Boiler")).toBe(
      "/icons/workbench/assets/radiator.png"
    );
  });

  it("falls back to toolbox when nothing matches", () => {
    expect(resolveAssetMiniCardIllustration("")).toBe(
      "/icons/workbench/assets/toolbox.png"
    );
  });

  it("uses asset type when name is sparse", () => {
    expect(getAssetMiniCardIllustration("Unit 1", "hvac")).toBe(
      "/icons/workbench/assets/air-conditioner.png"
    );
  });
});
