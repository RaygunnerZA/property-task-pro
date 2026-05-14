/**
 * Fuzzy Match — Unit Tests
 *
 * Covers the tightened `isFuzzyMatch` contract:
 *   - Substring containment requires the shorter side ≥ 4 chars AND either
 *     a whole-word match or a prefix of the longer side.
 *   - Levenshtein-based typo tolerance still works for short words.
 *
 * Run: npx vitest src/services/ai/__tests__/fuzzyMatch.test.ts
 */

import { describe, it, expect } from "vitest";
import { isFuzzyMatch, isFuzzyMatchSimilarity } from "../fuzzyMatch";

describe("isFuzzyMatch — short-word false positives are rejected", () => {
  it("'set' does NOT match 'closet' (prior bug: closet contains set)", () => {
    expect(isFuzzyMatch("set", "closet")).toBe(false);
  });

  it("'do' does NOT match 'door' (Levenshtein 2 short-word edge)", () => {
    // 2-char vs 4-char with edit distance 2 — too short to be confident.
    // extractWords already filters ≤2-char words, but we still want the matcher
    // itself to be defensive when called with short strings.
    expect(isFuzzyMatch("do", "door")).toBe(false);
  });

  it("'in' does NOT match 'kitchen'", () => {
    expect(isFuzzyMatch("in", "kitchen")).toBe(false);
  });
});

describe("isFuzzyMatch — legitimate matches still work", () => {
  it("exact match returns true", () => {
    expect(isFuzzyMatch("kitchen", "kitchen")).toBe(true);
  });

  it("prefix match on 4+ char shorter side returns true (hall → hallway)", () => {
    expect(isFuzzyMatch("hall", "hallway")).toBe(true);
  });

  it("whole-word containment in multi-word name returns true (room → boiler room)", () => {
    expect(isFuzzyMatch("room", "boiler room")).toBe(true);
  });

  it("multi-word containment works in either direction", () => {
    expect(isFuzzyMatch("boiler room", "boiler")).toBe(true);
    expect(isFuzzyMatch("boiler", "boiler room")).toBe(true);
  });

  it("single-character typo within Levenshtein budget still matches", () => {
    // Typical typo case: "kitchn" should match "kitchen" (edit distance 1).
    expect(isFuzzyMatch("kitchn", "kitchen")).toBe(true);
  });

  it("two-character typo within Levenshtein budget still matches", () => {
    expect(isFuzzyMatch("bathrom", "bathroom")).toBe(true);
  });
});

describe("isFuzzyMatch — defensive against empty or whitespace inputs", () => {
  it("empty string never matches", () => {
    expect(isFuzzyMatch("", "kitchen")).toBe(false);
    expect(isFuzzyMatch("kitchen", "")).toBe(false);
    expect(isFuzzyMatch("", "")).toBe(false);
  });

  it("whitespace-only string never matches a real word", () => {
    expect(isFuzzyMatch("   ", "kitchen")).toBe(false);
  });
});

describe("isFuzzyMatchSimilarity — unchanged contract", () => {
  it("plural/singular variants still match", () => {
    expect(isFuzzyMatchSimilarity("rooms", "room")).toBe(true);
  });

  it("high-similarity strings still match", () => {
    expect(isFuzzyMatchSimilarity("bedroom", "bdroom")).toBe(true);
  });
});
