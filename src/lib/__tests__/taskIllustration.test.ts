import { describe, it, expect } from "vitest";
import { getTaskSpaceIllustration } from "@/lib/taskIllustration";

describe("getTaskSpaceIllustration", () => {
  it("resolves the boiler room space name to boiler-room mini-card art", () => {
    expect(
      getTaskSpaceIllustration([{ name: "the boiler room" }], "Check the Temperature")
    ).toBe("/spaces/mini-cards/boiler-room.png");
  });

  it("resolves canonical Boiler Room space type labels", () => {
    expect(getTaskSpaceIllustration([{ spaceTypeName: "Boiler Room" }])).toBe(
      "/spaces/mini-cards/boiler-room.png"
    );
  });

  it("uses title hints when no space illustration resolves", () => {
    expect(getTaskSpaceIllustration([], "Check the Temperature")).toBe(
      "/spaces/mini-cards/boiler-room.png"
    );
  });

  it("prefers linked space over title hints", () => {
    expect(
      getTaskSpaceIllustration([{ name: "Kitchen" }], "Check boiler temperature")
    ).toBe("/spaces/mini-cards/kitchen.png");
  });
});
