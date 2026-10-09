import { describe, expect, it } from "vitest";
import { buildKnowledgeConnectionNodes } from "@/lib/intake/knowledgeConnection";

const boiler = { assetId: "a1", name: "Boiler", serial_number: "GC-47-311", matchedBy: "serial" as const };

describe("buildKnowledgeConnectionNodes", () => {
  it("orders document → recognised → existing asset → kept knowledge", () => {
    const nodes = buildKnowledgeConnectionNodes({
      documentLabel: "Boiler service report",
      asset: boiler,
      spaceName: "Utility room",
      renewal: { label: "Next service", date: "14 Mar 2027" },
    });
    expect(nodes.map((node) => node.kind)).toEqual(["source", "recognised", "existing", "knowledge"]);
    expect(nodes[1].title).toBe("Serial GC-47-311");
    expect(nodes[2].detail).toBe("In Utility room");
    expect(nodes[3].title).toBe("Next service 14 Mar 2027");
  });

  it("never presents the link as made before save", () => {
    const nodes = buildKnowledgeConnectionNodes({ asset: boiler });
    expect(nodes.filter((node) => node.pending).map((node) => node.kind)).toEqual(["knowledge"]);
    expect(nodes[3].title).toBe("Record linked to Boiler");
  });

  it("says a name match when the serial was not what matched", () => {
    const nodes = buildKnowledgeConnectionNodes({
      asset: { assetId: "a1", name: "Boiler", serial_number: "B-9", matchedBy: "name" },
    });
    expect(nodes[1]).toMatchObject({ title: "Boiler", detail: "Matches an asset name on file" });
  });

  it("falls back to a neutral document label", () => {
    const nodes = buildKnowledgeConnectionNodes({ documentLabel: "  ", asset: boiler });
    expect(nodes[0].title).toBe("This document");
  });
});
