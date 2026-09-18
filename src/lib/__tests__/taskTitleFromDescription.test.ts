import { describe, expect, it } from "vitest";
import {
  buildFallbackTitleFromDescription,
  isTitleEchoOfDescription,
  isUsableGeneratedTitle,
  resolveTaskTitle,
} from "@/lib/taskTitleFromDescription";

describe("buildFallbackTitleFromDescription", () => {
  it("prefers an action phrase over the opening words", () => {
    const title = buildFallbackTitleFromDescription(
      "This morning at the house we need to fix the leaking kitchen tap before guests arrive"
    );
    expect(title.toLowerCase()).toContain("fix");
    expect(title.toLowerCase()).not.toMatch(/^this morning/);
  });

  it("shortens need-to upload notes instead of copying the whole clause", () => {
    const title = buildFallbackTitleFromDescription(
      "We need to upload the latest EICR certificate to the property records"
    );
    expect(title.toLowerCase()).toMatch(/upload/);
    expect(title.toLowerCase()).toMatch(/eicr/);
    expect(title.toLowerCase()).not.toContain("property records");
    expect(title.toLowerCase()).not.toContain("latest");
    expect(title.split(" ").length).toBeLessThanOrEqual(6);
  });

  it("summarises narrative + problem + second action", () => {
    const title = buildFallbackTitleFromDescription(
      "This afternoon Oliver said. the dishwasher isnt draining, also please clean the gutters"
    );
    expect(title.toLowerCase()).toMatch(/dishwasher|gutter/);
    expect(title.toLowerCase()).not.toMatch(/^this afternoon/);
    expect(title.toLowerCase()).not.toContain("oliver said");
  });

  it("returns empty for tiny fragments", () => {
    expect(buildFallbackTitleFromDescription("Hi")).toBe("");
  });

  it("uses a labeled topic when the note leads with work type", () => {
    const title = buildFallbackTitleFromDescription(
      "Address Change - France address to be changed to UK address for trail 324"
    );
    expect(title.toLowerCase()).toMatch(/address/);
    expect(title.toLowerCase()).toMatch(/change/);
  });

  it("falls back to a compact first clause when no verb patterns match", () => {
    const title = buildFallbackTitleFromDescription(
      "Gas certificate for the flat needs sorting before the new tenants move in next month"
    );
    expect(title.length).toBeGreaterThan(5);
    expect(title.split(" ").length).toBeLessThanOrEqual(6);
  });

  it("clips reason clauses instead of ending on 'as'", () => {
    const title = buildFallbackTitleFromDescription(
      "Oliver suggested we need to replace the boiler before spring as there are currently specials on at the moment."
    );
    expect(title.toLowerCase()).toMatch(/replace/);
    expect(title.toLowerCase()).toMatch(/boiler/);
    expect(title.toLowerCase()).not.toMatch(/\bas\b/);
    expect(title.toLowerCase()).not.toContain("specials");
    expect(title.toLowerCase()).not.toMatch(/^oliver/);
  });
});

describe("isTitleEchoOfDescription", () => {
  it("detects verbatim opening echoes", () => {
    expect(
      isTitleEchoOfDescription(
        "This afternoon Oliver said the dishwasher",
        "This afternoon Oliver said. the dishwasher isnt draining"
      )
    ).toBe(true);
  });

  it("detects truncated description prefixes", () => {
    expect(
      isTitleEchoOfDescription(
        "Upload the latest EICR certificate to the pr",
        "We need to upload the latest EICR certificate to the property records"
      )
    ).toBe(true);
  });
});

describe("isUsableGeneratedTitle", () => {
  it("rejects mid-typing fragments", () => {
    expect(isUsableGeneratedTitle("The b")).toBe(false);
    expect(isUsableGeneratedTitle("Fix the")).toBe(false);
    expect(isUsableGeneratedTitle("Replace boiler before spring as")).toBe(false);
  });

  it("rejects narrative / echo titles when description is provided", () => {
    expect(
      isUsableGeneratedTitle(
        "This afternoon Oliver said the dishwasher",
        "This afternoon Oliver said. the dishwasher isnt draining"
      )
    ).toBe(false);
  });

  it("accepts short actionable titles", () => {
    expect(isUsableGeneratedTitle("Fix kitchen tap")).toBe(true);
  });
});

describe("resolveTaskTitle", () => {
  it("prefers manual then AI then heuristic — never a raw slice", () => {
    expect(resolveTaskTitle("Manual", "AI", "desc")).toBe("Manual");
    expect(resolveTaskTitle("", "AI Title Here", "desc")).toBe("AI Title Here");
    const long = "A".repeat(60);
    const resolved = resolveTaskTitle("", "", `Please fix the boiler now. ${long}`);
    expect(resolved?.toLowerCase()).toContain("fix");
    expect(resolved).not.toBe("A".repeat(50) + "...");
  });

  it("rejects AI titles that echo the description opening", () => {
    const desc =
      "This afternoon Oliver said. the dishwasher isnt draining, also please clean the gutters";
    expect(
      resolveTaskTitle("", "This afternoon Oliver said the dishwasher", desc)?.toLowerCase()
    ).not.toMatch(/^this afternoon/);
  });

  it("repairs mid-clause AI titles via finalize + fallback", () => {
    const desc =
      "Oliver suggested we need to replace the boiler before spring as there are currently specials on at the moment.";
    const resolved = resolveTaskTitle("", "Replace boiler before spring as", desc);
    expect(resolved?.toLowerCase()).toMatch(/replace.*boiler/);
    expect(resolved?.toLowerCase()).not.toMatch(/\bas\b/);
  });

  it("returns null when nothing usable exists", () => {
    expect(resolveTaskTitle("", "", "")).toBeNull();
    expect(resolveTaskTitle("", "", "Hi")).toBeNull();
  });
});
