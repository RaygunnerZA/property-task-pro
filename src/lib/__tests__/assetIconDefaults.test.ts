import { describe, expect, it } from "vitest";
import {
  defaultColorForAssetType,
  defaultIconsForAssetType,
  iconColorFromAssetMetadata,
} from "../assetIconDefaults";

describe("defaultIconsForAssetType", () => {
  it("returns boiler-specific icons", () => {
    expect(defaultIconsForAssetType("Boiler")[0]).toBe("flame");
  });

  it("falls back when type is empty", () => {
    expect(defaultIconsForAssetType(undefined)[0]).toBe("package");
  });
});

describe("defaultColorForAssetType", () => {
  it("uses amber for boilers", () => {
    expect(defaultColorForAssetType("Boiler")).toBe("#F5A623");
  });
});

describe("iconColorFromAssetMetadata", () => {
  it("reads icon_color_hex", () => {
    expect(iconColorFromAssetMetadata({ icon_color_hex: "#74B9FF" })).toBe("#74B9FF");
  });

  it("returns null without metadata", () => {
    expect(iconColorFromAssetMetadata(null)).toBeNull();
  });
});
