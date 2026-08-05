import { describe, expect, it } from "vitest";
import { memberAccentColor, MEMBER_AVATAR_COLORS } from "@/lib/userDisplayHelpers";

describe("memberAccentColor", () => {
  it("returns a palette colour for every id", () => {
    const color = memberAccentColor("11111111-1111-1111-1111-111111111111");
    expect(MEMBER_AVATAR_COLORS).toContain(color);
  });

  it("is stable for the same user id", () => {
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(memberAccentColor(id)).toBe(memberAccentColor(id));
  });

  it("gives different colours for distinct users when hashes diverge", () => {
    const a = memberAccentColor("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    const b = memberAccentColor("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    expect(a).not.toBe(b);
  });
});
