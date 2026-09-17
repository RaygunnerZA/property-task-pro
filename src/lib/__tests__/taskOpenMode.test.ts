import { describe, expect, it } from "vitest";
import { parseTaskOpenMode } from "@/lib/taskOpenMode";

describe("parseTaskOpenMode", () => {
  it("defaults to panel", () => {
    expect(parseTaskOpenMode(null)).toBe("panel");
    expect(parseTaskOpenMode("")).toBe("panel");
    expect(parseTaskOpenMode("nope")).toBe("panel");
  });

  it("accepts fullscreen", () => {
    expect(parseTaskOpenMode("fullscreen")).toBe("fullscreen");
  });
});
