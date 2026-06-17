import { describe, expect, it } from "vitest";
import { pickBestNameMatch } from "@/lib/inlineChipInput";

describe("inlineChipInput", () => {
  it("prefers exact name matches over partial matches", () => {
    const items = [{ name: "Barbara" }, { name: "Barbara Ann" }];
    expect(pickBestNameMatch(items, "barbara")?.name).toBe("Barbara");
  });
});
