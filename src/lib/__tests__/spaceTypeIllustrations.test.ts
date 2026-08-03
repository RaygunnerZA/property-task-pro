import { describe, it, expect } from "vitest";
import {
  getSpaceDisplayIllustration,
  resolveSpaceMiniCardIllustration,
} from "@/lib/spaceTypeIllustrations";

describe("resolveSpaceMiniCardIllustration", () => {
  it("maps common non-office labels away from office art", () => {
    expect(resolveSpaceMiniCardIllustration("Stairwell")).toBe(
      "/spaces/mini-cards/staircase.png"
    );
    expect(resolveSpaceMiniCardIllustration("Male WC")).toBe(
      "/spaces/mini-cards/wc.png"
    );
    expect(resolveSpaceMiniCardIllustration("Kitchenette")).toBe(
      "/spaces/mini-cards/staff-kitchen.png"
    );
    expect(resolveSpaceMiniCardIllustration("Corridor 1")).toBe(
      "/spaces/mini-cards/entrance-hall.png"
    );
    expect(resolveSpaceMiniCardIllustration("Store")).toBe(
      "/spaces/mini-cards/storage-room.png"
    );
  });

  it("keeps office art only for office-like labels", () => {
    expect(resolveSpaceMiniCardIllustration("Office")).toBe(
      "/spaces/mini-cards/office.png"
    );
    expect(resolveSpaceMiniCardIllustration("Home Office")).toBe(
      "/spaces/mini-cards/office-2.png"
    );
  });

  it("uses lobby instead of office for unknown labels", () => {
    expect(resolveSpaceMiniCardIllustration("Zone 1")).toBe(
      "/spaces/mini-cards/lobby.png"
    );
  });
});

describe("getSpaceDisplayIllustration", () => {
  it("re-resolves sticky office thumbnails when the label is not an office", () => {
    expect(
      getSpaceDisplayIllustration({
        name: "Fire Exit",
        thumbnail_url: "/spaces/mini-cards/office.png",
      })
    ).toBe("/spaces/mini-cards/exit.png");
  });
});
