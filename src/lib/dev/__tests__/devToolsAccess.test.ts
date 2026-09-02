import { describe, expect, it } from "vitest";
import { isDevToolsEmailAllowed } from "@/lib/dev/devToolsAccess";

describe("devToolsAccess", () => {
  it("recognises allowlisted emails case-insensitively", () => {
    expect(isDevToolsEmailAllowed("MattLegrange@me.com")).toBe(true);
    expect(isDevToolsEmailAllowed("justinplunkett@gmail.com")).toBe(true);
    expect(isDevToolsEmailAllowed("studio@justinplunkett.com")).toBe(true);
    expect(isDevToolsEmailAllowed("stranger@example.com")).toBe(false);
    expect(isDevToolsEmailAllowed(null)).toBe(false);
    expect(isDevToolsEmailAllowed("")).toBe(false);
  });
});
