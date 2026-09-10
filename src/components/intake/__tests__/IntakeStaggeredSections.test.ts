import { describe, expect, it } from "vitest";
import {
  shouldShowMetaSection,
  shouldShowStaggerSection,
} from "@/components/intake/IntakeStaggeredSections";

describe("IntakeStaggeredSections visibility", () => {
  it("keeps empty rows on the stagger clock", () => {
    expect(shouldShowStaggerSection(0, 1, false)).toBe(true);
    expect(shouldShowStaggerSection(2, 1, false)).toBe(false);
    expect(shouldShowStaggerSection(3, 1, false)).toBe(false);
  });

  it("shows a row immediately once it has extracted facts", () => {
    expect(shouldShowStaggerSection(2, 1, true)).toBe(true);
    expect(shouldShowStaggerSection(3, 1, true)).toBe(true);
  });

  it("shows Asset/Tag/Compliance early when those rows already have facts", () => {
    expect(shouldShowMetaSection(false, false)).toBe(false);
    expect(shouldShowMetaSection(false, true)).toBe(true);
    expect(shouldShowMetaSection(true, false)).toBe(true);
  });
});
