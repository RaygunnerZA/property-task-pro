import { describe, expect, it } from "vitest";
import { getPropertySelectorHighlight, truncatePropertySelectorHighlight } from "@/lib/propertySelectorHighlight";

describe("getPropertySelectorHighlight", () => {
  it("prefers urgent open task title", () => {
    const line = getPropertySelectorHighlight("p1", [
      {
        property_id: "p1",
        title: "Water Leak",
        priority: "urgent",
        status: "open",
        created_at: new Date().toISOString(),
      },
    ]);
    expect(line).toBe("Water Leak reported today.");
  });

  it("falls back to compliance copy", () => {
    const line = getPropertySelectorHighlight("p1", [], { expired_compliance_count: 1 });
    expect(line).toBe("Gas certificate expiring soon.");
  });

  it("truncates long highlight to one line budget", () => {
    const long = "A".repeat(80);
    expect(truncatePropertySelectorHighlight(long)).toHaveLength(52);
    expect(truncatePropertySelectorHighlight(long).endsWith("…")).toBe(true);
  });
});
