import { describe, expect, it } from "vitest";
import {
  inferSpaceGroupIdFromName,
  normalizeSpaceMatchKey,
} from "@/components/onboarding/onboardingSpaceGroups";

describe("inferSpaceGroupIdFromName", () => {
  it("maps Rm aliases onto suggestion names", () => {
    expect(normalizeSpaceMatchKey("Electrical Rm")).toBe("electrical room");
    expect(inferSpaceGroupIdFromName("Electrical Rm")).toBe("technical");
  });

  it("places added rooms onto type groups, not areas", () => {
    expect(inferSpaceGroupIdFromName("Exterior")).toBe("external");
    expect(inferSpaceGroupIdFromName("Master Suite")).toBe("habitable");
    expect(inferSpaceGroupIdFromName("Attic")).toBe("storage");
    expect(inferSpaceGroupIdFromName("Archive Rm")).toBe("storage");
    expect(inferSpaceGroupIdFromName("Hallway")).toBe("circulation");
    expect(inferSpaceGroupIdFromName("Mezzanine")).toBe("circulation");
  });
});
