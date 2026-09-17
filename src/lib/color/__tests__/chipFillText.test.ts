import { describe, expect, it } from "vitest";
import {
  compositeOver,
  parseCssRgb,
  shouldUseLightChipText,
  yiq,
} from "@/lib/color/chipFillText";

const CREAM = { r: 245, g: 241, b: 232 };
const TEAL = { r: 142, g: 201, b: 206, a: 1 };

describe("chipFillText", () => {
  it("parses rgba including alpha", () => {
    expect(parseCssRgb("rgba(142, 201, 206, 0.42)")).toEqual({
      r: 142,
      g: 201,
      b: 206,
      a: 0.42,
    });
  });

  it("uses dark text on a teal wash over a light card", () => {
    const wash = { ...TEAL, a: 0.42 };
    expect(shouldUseLightChipText(wash, CREAM)).toBe(false);
    expect(yiq(compositeOver(wash, CREAM))).toBeGreaterThan(200);
  });

  it("uses dark text on brand teal (light fill)", () => {
    expect(shouldUseLightChipText(TEAL, CREAM)).toBe(false);
  });

  it("uses white text on a dark opaque fill", () => {
    expect(shouldUseLightChipText({ r: 91, g: 138, b: 142, a: 1 }, CREAM)).toBe(
      true
    );
  });
});
