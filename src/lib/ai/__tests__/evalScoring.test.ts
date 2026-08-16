import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  claimsFromPlanExtraction,
  claimsFromTaskExtraction,
  isPromotable,
  median,
  normaliseClaim,
  scoreCapability,
  type Fixture,
  type FixtureSet,
} from "../evals/scoring";

const fixtures: Fixture[] = [
  { id: "a", input: { text: "leak" }, expected: ["priority:urgent", "space:bathroom"] },
  { id: "b", input: { text: "clean" }, expected: ["space:kitchen"] },
  { id: "c", input: { text: "paper" }, expected: [] },
];

describe("normaliseClaim", () => {
  it("ignores case and collapses whitespace", () => {
    expect(normaliseClaim("  Space:Plant   Room ")).toBe("space:plant room");
  });
});

describe("median", () => {
  it("handles odd, even and empty inputs", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe("scoreCapability", () => {
  it("gives a perfect score when every claim is matched", () => {
    const score = scoreCapability(fixtures, [
      { id: "a", actual: ["priority:urgent", "space:bathroom"], latencyMs: 100 },
      { id: "b", actual: ["space:kitchen"], latencyMs: 200 },
      { id: "c", actual: [], latencyMs: 300 },
    ]);

    expect(score.recall).toBe(1);
    expect(score.falsePositiveRate).toBe(0);
    expect(score.schemaValidRate).toBe(1);
    expect(score.latencyMsP50).toBe(200);
  });

  it("counts missing claims against recall", () => {
    const score = scoreCapability(fixtures, [
      { id: "a", actual: ["priority:urgent"], latencyMs: 10 },
      { id: "b", actual: [], latencyMs: 10 },
      { id: "c", actual: [], latencyMs: 10 },
    ]);

    // 1 of 3 expected claims matched.
    expect(score.recall).toBeCloseTo(0.3333, 4);
    expect(score.detail.find((d) => d.id === "a")?.missing).toEqual(["space:bathroom"]);
  });

  it("counts invented claims in scored namespaces as false positives", () => {
    const score = scoreCapability(fixtures, [
      { id: "a", actual: ["priority:urgent", "space:bathroom"], latencyMs: 10 },
      { id: "b", actual: ["space:kitchen", "space:garage"], latencyMs: 10 },
      { id: "c", actual: [], latencyMs: 10 },
    ]);

    expect(score.recall).toBe(1);
    // 1 invented claim out of 4 scored claims.
    expect(score.falsePositiveRate).toBe(0.25);
    expect(score.detail.find((d) => d.id === "b")?.unexpected).toEqual(["space:garage"]);
  });

  it("does not penalise claims outside the scored namespaces", () => {
    const score = scoreCapability(fixtures, [
      { id: "a", actual: ["priority:urgent", "space:bathroom", "person:someone"], latencyMs: 10 },
      { id: "b", actual: ["space:kitchen"], latencyMs: 10 },
      { id: "c", actual: [], latencyMs: 10 },
    ]);

    expect(score.falsePositiveRate).toBe(0);
  });

  it("treats an unparseable response as schema-invalid with no claims", () => {
    const score = scoreCapability(fixtures, [
      { id: "a", actual: null, latencyMs: 10 },
      { id: "b", actual: ["space:kitchen"], latencyMs: 10 },
      { id: "c", actual: [], latencyMs: 10 },
    ]);

    expect(score.schemaValidRate).toBeCloseTo(0.6667, 4);
    expect(score.detail.find((d) => d.id === "a")?.schemaValid).toBe(false);
  });

  it("treats a missing outcome as a failure rather than skipping it", () => {
    const score = scoreCapability(fixtures, [
      { id: "b", actual: ["space:kitchen"], latencyMs: 10 },
    ]);

    expect(score.schemaValidRate).toBeCloseTo(0.3333, 4);
    expect(score.recall).toBeCloseTo(0.3333, 4);
  });

  it("sums cost only when the harness reported it", () => {
    expect(
      scoreCapability(fixtures, [
        { id: "a", actual: [], latencyMs: 1, costUsd: 0.001 },
        { id: "b", actual: [], latencyMs: 1, costUsd: 0.002 },
      ]).costUsd
    ).toBeCloseTo(0.003, 6);

    expect(
      scoreCapability(fixtures, [{ id: "a", actual: [], latencyMs: 1 }]).costUsd
    ).toBeNull();
  });
});

describe("isPromotable", () => {
  const incumbent = scoreCapability(fixtures, [
    { id: "a", actual: ["priority:urgent", "space:bathroom"], latencyMs: 100 },
    { id: "b", actual: ["space:kitchen"], latencyMs: 100 },
    { id: "c", actual: [], latencyMs: 100 },
  ]);

  it("promotes an equal candidate", () => {
    expect(isPromotable(incumbent, incumbent)).toBe(true);
  });

  it("refuses a candidate with worse recall", () => {
    const candidate = scoreCapability(fixtures, [
      { id: "a", actual: ["priority:urgent"], latencyMs: 10 },
      { id: "b", actual: ["space:kitchen"], latencyMs: 10 },
      { id: "c", actual: [], latencyMs: 10 },
    ]);

    expect(isPromotable(candidate, incumbent)).toBe(false);
  });

  it("refuses a candidate that invents more", () => {
    const candidate = scoreCapability(fixtures, [
      { id: "a", actual: ["priority:urgent", "space:bathroom"], latencyMs: 10 },
      { id: "b", actual: ["space:kitchen", "space:garage"], latencyMs: 10 },
      { id: "c", actual: [], latencyMs: 10 },
    ]);

    expect(isPromotable(candidate, incumbent)).toBe(false);
  });

  it("refuses a candidate with no fixtures, so an empty run cannot promote", () => {
    const empty = scoreCapability([], []);
    expect(isPromotable(empty, incumbent)).toBe(false);
  });
});

describe("claim extraction from model responses", () => {
  it("reads task extraction chips, accepting strings or objects", () => {
    expect(
      claimsFromTaskExtraction({
        priority: "urgent",
        spaces: ["Bathroom", { name: "Kitchen" }],
        assets: [{ name: "Boiler" }],
        themes: [],
        people: ["ignored"],
      })
    ).toEqual(["priority:urgent", "space:Bathroom", "space:Kitchen", "asset:Boiler"]);
  });

  it("returns nothing for an empty extraction", () => {
    expect(claimsFromTaskExtraction({})).toEqual([]);
  });

  it("reads plan extraction space names", () => {
    expect(
      claimsFromPlanExtraction({ spaces: [{ name: "Plant Room" }, { name: "" }] })
    ).toEqual(["space:Plant Room"]);
    expect(claimsFromPlanExtraction({})).toEqual([]);
  });
});

describe("committed fixture manifests", () => {
  const load = (file: string): FixtureSet =>
    JSON.parse(
      readFileSync(path.join(process.cwd(), "evals", "fixtures", file), "utf8")
    ) as FixtureSet;

  it("declares a fixture set and capability", () => {
    for (const file of ["task_extraction.json", "plan_label_extraction.json"]) {
      const set = load(file);
      expect(set.fixture_set).toBeTruthy();
      expect(set.capability).toBeTruthy();
      expect(Array.isArray(set.fixtures)).toBe(true);
    }
  });

  it("uses unique ids and well-formed claims", () => {
    const set = load("task_extraction.json");
    const ids = set.fixtures.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const fixture of set.fixtures) {
      expect(fixture.input.text || fixture.input.image).toBeTruthy();
      for (const claim of fixture.expected) {
        expect(claim, `${fixture.id}: "${claim}" must be field:value`).toMatch(/^[a-z]+:.+/);
      }
    }
  });
});
