/**
 * Rule-Based Extractor — Unit Tests
 *
 * Tests the deterministic NLP chip extraction engine with synthetic inputs.
 * Covers: compliance detection, priority, person detection, space detection,
 * date extraction, and asset detection.
 *
 * Run: npx vitest src/services/ai/__tests__/ruleBasedExtractor.test.ts
 */

import { describe, it, expect } from "vitest";
import { extractChipsFromText } from "../ruleBasedExtractor";
import type { ChipSuggestionContext, SuggestedChip } from "@/types/chip-suggestions";

// ─── Test Helpers ────────────────────────────────────────────────────────────

const EMPTY_ENTITIES = {
  spaces: [] as Array<{ id: string; name: string; property_id: string }>,
  members: [] as Array<{ id: string; user_id: string; display_name: string }>,
  teams: [] as Array<{ id: string; name: string }>,
  categories: [] as Array<{ id: string; name: string }>,
};

function makeContext(description: string, propertyId?: string): ChipSuggestionContext {
  return { description, propertyId };
}

function extract(description: string, entities = EMPTY_ENTITIES) {
  return extractChipsFromText(makeContext(description), entities);
}

function chipTypes(chips: SuggestedChip[]): string[] {
  return chips.map((c) => c.type);
}

function chipValues(chips: SuggestedChip[]): string[] {
  return chips.map((c) => c.value);
}

// ─── Compliance Detection ────────────────────────────────────────────────────

describe("extractChipsFromText — compliance detection", () => {
  it("Gas Safety → triggers compliance mode", () => {
    const result = extract("We need a gas safety certificate renewal");
    expect(result.complianceMode).toBe(true);
    expect(chipTypes(result.chips)).toContain("compliance");
  });

  it("EICR sample → triggers compliance mode", () => {
    const result = extract("Book an EICR electrical inspection for unit 4");
    expect(result.complianceMode).toBe(true);
  });

  it("Fire Risk Assessment sample → triggers compliance mode", () => {
    const result = extract("Schedule fire safety assessment before April deadline");
    expect(result.complianceMode).toBe(true);
  });

  it("non-compliance text → does not trigger compliance mode", () => {
    const result = extract("Fix the broken shelf in the bedroom");
    expect(result.complianceMode).toBe(false);
  });

  it("audit keyword → triggers compliance mode", () => {
    const result = extract("Annual building audit needed urgently");
    expect(result.complianceMode).toBe(true);
  });
});

// ─── Priority Detection ─────────────────────────────────────────────────────

describe("extractChipsFromText — priority detection", () => {
  it("urgent keyword → urgent priority chip", () => {
    const result = extract("Urgent: boiler is leaking");
    const priority = result.chips.find((c) => c.type === "priority");
    expect(priority).toBeDefined();
    expect(priority!.value).toBe("urgent");
  });

  it("emergency keyword → urgent priority chip", () => {
    const result = extract("Emergency water leak in basement");
    const priority = result.chips.find((c) => c.type === "priority");
    expect(priority).toBeDefined();
    expect(priority!.value).toBe("urgent");
  });

  it("ASAP keyword → urgent priority chip", () => {
    const result = extract("Fix the front door lock asap");
    const priority = result.chips.find((c) => c.type === "priority");
    expect(priority).toBeDefined();
    expect(priority!.value).toBe("urgent");
  });

  it("routine keyword → low priority chip", () => {
    const result = extract("Routine cleaning of the hallway");
    const priority = result.chips.find((c) => c.type === "priority");
    expect(priority).toBeDefined();
    expect(priority!.value).toBe("low");
  });

  it("'important' keyword → high priority", () => {
    const result = extract("Important: review the tenancy agreement");
    const priority = result.chips.find((c) => c.type === "priority");
    expect(priority).toBeDefined();
    expect(priority!.value).toBe("high");
  });
});

// ─── Person Detection ───────────────────────────────────────────────────────

describe("extractChipsFromText — person detection", () => {
  it("sentence subject 'Frank must fix' → person ghost chip for Frank", () => {
    const result = extract("Frank must fix the boiler before Friday");
    const people = result.chips.filter((c) => c.type === "person");
    expect(people.length).toBeGreaterThanOrEqual(1);
    const frank = people.find((c) => c.label.toLowerCase().includes("frank"));
    expect(frank).toBeDefined();
  });

  it("proper noun 'Call Sarah' → person ghost chip for Sarah", () => {
    const result = extract("Call Sarah about the leak in unit 2");
    const people = result.chips.filter((c) => c.type === "person");
    const sarah = people.find((c) => c.label.toLowerCase().includes("sarah"));
    expect(sarah).toBeDefined();
  });

  it("matched org member → higher score than ghost", () => {
    const entities = {
      ...EMPTY_ENTITIES,
      members: [
        { id: "m1", user_id: "u1", display_name: "Frank Smith" },
      ],
    };
    const result = extractChipsFromText(
      makeContext("Frank must fix the boiler"),
      entities
    );
    const people = result.chips.filter((c) => c.type === "person");
    expect(people.length).toBeGreaterThanOrEqual(1);
    const matchedFrank = people.find((c) => c.resolvedEntityId === "u1");
    expect(matchedFrank).toBeDefined();
    expect(matchedFrank!.score).toBeGreaterThanOrEqual(0.8);
  });

  it("non-name verb words are excluded", () => {
    const result = extract("Fix the broken pipe and clean the drain");
    const people = result.chips.filter((c) => c.type === "person");
    const fixChip = people.find((c) => c.label.toLowerCase() === "fix");
    expect(fixChip).toBeUndefined();
  });
});

// ─── Space Detection ────────────────────────────────────────────────────────

describe("extractChipsFromText — space detection", () => {
  it("'kitchen' keyword → space ghost chip", () => {
    const result = extract("The kitchen tap is dripping");
    const spaces = result.chips.filter((c) => c.type === "space");
    expect(spaces.length).toBeGreaterThanOrEqual(1);
  });

  it("matched existing space → resolved entity ID", () => {
    const entities = {
      ...EMPTY_ENTITIES,
      spaces: [
        { id: "s1", name: "Kitchen", property_id: "p1" },
      ],
    };
    const result = extractChipsFromText(
      { description: "Fix the kitchen sink", propertyId: "p1" },
      entities
    );
    const kitchen = result.chips.find(
      (c) => c.type === "space" && c.resolvedEntityId === "s1"
    );
    expect(kitchen).toBeDefined();
    expect(kitchen!.score).toBeGreaterThanOrEqual(0.8);
  });

  it("'at the bowling alley' → multi-word space detection", () => {
    const result = extract("Fix the lighting at the bowling alley");
    const spaces = result.chips.filter((c) => c.type === "space");
    const alley = spaces.find((c) =>
      c.label.toLowerCase().includes("bowling alley")
    );
    expect(alley).toBeDefined();
  });
});

// ─── Date Detection ─────────────────────────────────────────────────────────

describe("extractChipsFromText — date detection", () => {
  it("'today' → date chip with today's ISO date", () => {
    const result = extract("Fix the door today");
    const dateChip = result.chips.find((c) => c.type === "date");
    expect(dateChip).toBeDefined();
    const today = new Date().toISOString().split("T")[0];
    expect(dateChip!.value).toBe(today);
  });

  it("'tomorrow' → date chip with tomorrow's ISO date", () => {
    const result = extract("Clean the bathroom tomorrow");
    const dateChip = result.chips.find((c) => c.type === "date");
    expect(dateChip).toBeDefined();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(dateChip!.value).toBe(tomorrow.toISOString().split("T")[0]);
  });

  it("'next week' → date chip ~7 days ahead", () => {
    const result = extract("Schedule boiler check next week");
    const dateChip = result.chips.find((c) => c.type === "date");
    expect(dateChip).toBeDefined();
  });

  it("'before Friday' → date chip for upcoming Friday", () => {
    const result = extract("Must complete before Friday");
    const dateChip = result.chips.find((c) => c.type === "date");
    expect(dateChip).toBeDefined();
  });

  it("'15 March' → date chip detected", () => {
    const result = extract("Finish works by 15 March");
    const dateChip = result.chips.find((c) => c.type === "date");
    expect(dateChip).toBeDefined();
  });
});

// ─── Asset Detection ────────────────────────────────────────────────────────

describe("extractChipsFromText — asset detection", () => {
  it("'boiler' → asset ghost chip", () => {
    const result = extract("The boiler needs servicing");
    const assets = result.chips.filter((c) => c.type === "asset");
    expect(assets.length).toBeGreaterThanOrEqual(1);
    expect(assets[0].label.toLowerCase()).toContain("boiler");
  });

  it("'washing machine' → asset ghost chip", () => {
    const result = extract("Replace the washing machine in unit 3");
    const assets = result.chips.filter((c) => c.type === "asset");
    const wm = assets.find((c) =>
      c.label.toLowerCase().includes("washing machine")
    );
    expect(wm).toBeDefined();
  });
});

// ─── Ghost Category Generation ──────────────────────────────────────────────

describe("extractChipsFromText — ghost categories", () => {
  it("compliance text → compliance ghost category", () => {
    const result = extract("Schedule the annual gas safety certificate renewal");
    expect(result.ghostCategories.length).toBeGreaterThanOrEqual(1);
    const complianceGhost = result.ghostCategories.find(
      (g) => g.reason === "compliance"
    );
    expect(complianceGhost).toBeDefined();
  });

  it("urgent text → urgency ghost category", () => {
    const result = extract("Urgent: flooding in the basement");
    const urgencyGhost = result.ghostCategories.find(
      (g) => g.reason === "urgency"
    );
    expect(urgencyGhost).toBeDefined();
  });
});

// ─── Chip Score Threshold ───────────────────────────────────────────────────

describe("extractChipsFromText — chip scores", () => {
  it("all returned chips have score >= 0.5", () => {
    const result = extract(
      "Urgent: Frank must fix the boiler in the kitchen before Friday"
    );
    for (const chip of result.chips) {
      expect(chip.score).toBeGreaterThanOrEqual(0.5);
    }
  });
});

// ─── Combined Extraction ────────────────────────────────────────────────────

describe("extractChipsFromText — combined extraction", () => {
  it("complex sentence extracts multiple chip types", () => {
    const entities = {
      ...EMPTY_ENTITIES,
      members: [
        { id: "m1", user_id: "u1", display_name: "Frank Smith" },
      ],
      spaces: [
        { id: "s1", name: "Kitchen", property_id: "p1" },
      ],
    };

    const result = extractChipsFromText(
      {
        description: "Frank must fix the boiler in the kitchen before Friday — urgent",
        propertyId: "p1",
      },
      entities
    );

    const types = chipTypes(result.chips);
    expect(types).toContain("priority");
    expect(types).toContain("person");
    expect(types).toContain("space");
    expect(types).toContain("date");
  });
});
