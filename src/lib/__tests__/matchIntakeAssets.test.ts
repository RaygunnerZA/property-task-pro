import { describe, expect, it } from "vitest";
import { collectDetectedAssets, matchIntakeAssets, formatLinkedAssetLabel } from "@/lib/matchIntakeAssets";

const assets = [
  { id: "a1", name: "Passenger Lift LIFT-02", serial_number: "LIFT-02" },
  { id: "a2", name: "Boiler", serial_number: "B-9" },
];

describe("matchIntakeAssets", () => {
  it("matches a unique serial without trusting a model-supplied id", () => {
    const result = matchIntakeAssets(
      [{ name: "Lift", serial_number: "LIFT-02", confidence: 0.4 }],
      assets
    );
    expect(result.matches).toEqual([
      { assetId: "a1", name: "Passenger Lift LIFT-02", serial_number: "LIFT-02" },
    ]);
    expect(result.unmatched).toHaveLength(0);
  });

  it("matches a unique compact name such as LIFT-02", () => {
    const result = matchIntakeAssets([{ name: "LIFT-02" }], assets);
    expect(result.matches[0]?.assetId).toBe("a1");
  });

  it("does not match when two assets share the same normalised name", () => {
    const result = matchIntakeAssets([{ name: "Pump" }], [
      { id: "p1", name: "Pump" },
      { id: "p2", name: "Pump" },
    ]);
    expect(result.matches).toHaveLength(0);
  });

  it("surfaces a high-confidence unmatched asset for user confirmation", () => {
    const result = matchIntakeAssets(
      [{ name: "Passenger Lift LIFT-99", serial_number: "LIFT-99", confidence: 0.9 }],
      assets
    );
    expect(result.matches).toHaveLength(0);
    expect(result.unmatched[0]?.label).toMatch(/LIFT-99/);
  });

  it("drops weak unmatched guesses", () => {
    const result = matchIntakeAssets([{ name: "door", confidence: 0.2 }], assets);
    expect(result.unmatched).toHaveLength(0);
  });

  it("formats linked labels with serial when it is not already in the name", () => {
    expect(formatLinkedAssetLabel({ assetId: "x", name: "Lift", serial_number: "LIFT-02" })).toBe(
      "Lift · LIFT-02"
    );
  });
});

describe("collectDetectedAssets", () => {
  it("dedupes file and image detections", () => {
    const collected = collectDetectedAssets({
      fromFiles: [[{ name: "Lift", serial_number: "LIFT-02" }]],
      fromImages: [[{ name: "Lift", serial_number: "LIFT-02" }, { name: "Boiler" }]],
    });
    expect(collected).toHaveLength(2);
  });
});
