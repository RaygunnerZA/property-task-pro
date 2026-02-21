/**
 * Dev Time Utilities — Unit Tests
 *
 * Run: npx vitest src/services/dev/__tests__/devTime.test.ts
 */

import { describe, it, expect, afterEach } from "vitest";
import { setTimeShiftDays, getTimeShiftDays, devNow } from "../devTime";

afterEach(() => {
  setTimeShiftDays(0);
});

describe("devNow", () => {
  it("returns current date when no shift is set", () => {
    const now = new Date();
    const dev = devNow();
    expect(Math.abs(dev.getTime() - now.getTime())).toBeLessThan(100);
  });

  it("returns shifted date when shift is positive", () => {
    setTimeShiftDays(30);
    const dev = devNow();
    const expected = new Date();
    expected.setDate(expected.getDate() + 30);
    expect(Math.abs(dev.getTime() - expected.getTime())).toBeLessThan(100);
  });

  it("returns past date when shift is negative", () => {
    setTimeShiftDays(-10);
    const dev = devNow();
    const expected = new Date();
    expected.setDate(expected.getDate() - 10);
    expect(Math.abs(dev.getTime() - expected.getTime())).toBeLessThan(100);
  });
});

describe("getTimeShiftDays / setTimeShiftDays", () => {
  it("default is 0", () => {
    expect(getTimeShiftDays()).toBe(0);
  });

  it("set and get round-trip", () => {
    setTimeShiftDays(90);
    expect(getTimeShiftDays()).toBe(90);
  });
});
