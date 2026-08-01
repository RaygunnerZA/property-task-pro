import { describe, expect, it } from "vitest";
import { getSuggestedCopyName, toSentenceCaseSpaceName } from "../spaceNameUtils";

describe("toSentenceCaseSpaceName", () => {
  it("lowercases then capitalises the first letter", () => {
    expect(toSentenceCaseSpaceName("LIVING ROOM")).toBe("Living room");
    expect(toSentenceCaseSpaceName("kitchen")).toBe("Kitchen");
  });

  it("trims and falls back for empty names", () => {
    expect(toSentenceCaseSpaceName("  ")).toBe("Unnamed");
    expect(toSentenceCaseSpaceName(null)).toBe("Unnamed");
  });
});

describe("getSuggestedCopyName", () => {
  it("appends 2 when the base name exists once", () => {
    expect(getSuggestedCopyName("Kitchen", ["Kitchen"])).toBe("Kitchen 2");
  });

  it("increments past the highest numbered copy", () => {
    expect(getSuggestedCopyName("Kitchen", ["Kitchen", "Kitchen 2", "Kitchen 4"])).toBe(
      "Kitchen 5"
    );
  });

  it("is case-insensitive for existing names", () => {
    expect(getSuggestedCopyName("kitchen", ["Kitchen", "kitchen 2"])).toBe("kitchen 3");
  });
});
