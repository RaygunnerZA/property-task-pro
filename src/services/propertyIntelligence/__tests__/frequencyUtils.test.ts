/**
 * Frequency Utils — Unit Tests
 *
 * Covers all supported frequency intervals plus edge cases:
 * month boundaries, leap years, and unknown frequency fallback.
 *
 * Run: npx vitest src/services/propertyIntelligence/__tests__/frequencyUtils.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  calculateNextDueDate,
  formatFrequency,
  FREQUENCY_OPTIONS,
} from "../frequencyUtils";

// ─── calculateNextDueDate ────────────────────────────────────────────────────

describe("calculateNextDueDate", () => {
  const base = new Date(2025, 0, 15); // 15 Jan 2025

  it("monthly → adds 1 month", () => {
    const result = calculateNextDueDate("monthly", base);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(1); // Feb
    expect(result.getDate()).toBe(15);
  });

  it("quarterly → adds 3 months", () => {
    const result = calculateNextDueDate("quarterly", base);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(3); // Apr
    expect(result.getDate()).toBe(15);
  });

  it("6_monthly → adds 6 months", () => {
    const result = calculateNextDueDate("6_monthly", base);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(6); // Jul
    expect(result.getDate()).toBe(15);
  });

  it("annual → adds 1 year", () => {
    const result = calculateNextDueDate("annual", base);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0); // Jan
    expect(result.getDate()).toBe(15);
  });

  it("2_yearly → adds 2 years", () => {
    const result = calculateNextDueDate("2_yearly", base);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0); // Jan
  });

  it("5_yearly → adds 5 years", () => {
    const result = calculateNextDueDate("5_yearly", base);
    expect(result.getFullYear()).toBe(2030);
    expect(result.getMonth()).toBe(0); // Jan
  });

  it("unknown frequency → falls back to annual", () => {
    const result = calculateNextDueDate("gibberish", base);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
  });
});

// ─── End-of-Month Edge Cases ─────────────────────────────────────────────────

describe("calculateNextDueDate — end of month edge cases", () => {
  it("monthly from Jan 31 → Feb 28 (or 29 in leap year, per date-fns)", () => {
    const jan31 = new Date(2025, 0, 31);
    const result = calculateNextDueDate("monthly", jan31);
    expect(result.getMonth()).toBe(1); // Feb
    expect(result.getDate()).toBeLessThanOrEqual(28);
  });

  it("monthly from Mar 31 → Apr 30 (date-fns clamps to last day)", () => {
    const mar31 = new Date(2025, 2, 31);
    const result = calculateNextDueDate("monthly", mar31);
    expect(result.getMonth()).toBe(3); // Apr
    expect(result.getDate()).toBeLessThanOrEqual(30);
  });

  it("quarterly from Nov 30 → Feb 28 (3 months forward from Nov)", () => {
    const nov30 = new Date(2025, 10, 30);
    const result = calculateNextDueDate("quarterly", nov30);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(1); // Feb
    expect(result.getDate()).toBeLessThanOrEqual(28);
  });
});

// ─── Leap Year ──────────────────────────────────────────────────────────────

describe("calculateNextDueDate — leap year", () => {
  it("annual from Feb 29 2024 → Feb 28 2025 (non-leap target year)", () => {
    const leapDay = new Date(2024, 1, 29);
    const result = calculateNextDueDate("annual", leapDay);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(1); // Feb
    expect(result.getDate()).toBe(28);
  });

  it("annual from Feb 28 2023 → Feb 28 2024 (leap target year)", () => {
    const feb28 = new Date(2023, 1, 28);
    const result = calculateNextDueDate("annual", feb28);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(28);
  });
});

// ─── Returns midnight (startOfDay) ──────────────────────────────────────────

describe("calculateNextDueDate — midnight normalization", () => {
  it("result is always at midnight local time", () => {
    const withTime = new Date(2025, 5, 15, 14, 30, 45);
    const result = calculateNextDueDate("monthly", withTime);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it("input time of day does not affect output date", () => {
    const morning = new Date(2025, 0, 10, 6, 0, 0);
    const evening = new Date(2025, 0, 10, 22, 0, 0);
    const r1 = calculateNextDueDate("annual", morning);
    const r2 = calculateNextDueDate("annual", evening);
    expect(r1.getTime()).toBe(r2.getTime());
  });
});

// ─── formatFrequency ────────────────────────────────────────────────────────

describe("formatFrequency", () => {
  it("maps known frequencies to labels", () => {
    expect(formatFrequency("monthly")).toBe("Monthly");
    expect(formatFrequency("quarterly")).toBe("Quarterly");
    expect(formatFrequency("6_monthly")).toBe("Every 6 months");
    expect(formatFrequency("annual")).toBe("Annual");
    expect(formatFrequency("2_yearly")).toBe("Every 2 years");
    expect(formatFrequency("5_yearly")).toBe("Every 5 years");
  });

  it("returns raw value for unknown frequencies", () => {
    expect(formatFrequency("on_change")).toBe("on_change");
    expect(formatFrequency("10_yearly")).toBe("10_yearly");
  });
});

// ─── FREQUENCY_OPTIONS ──────────────────────────────────────────────────────

describe("FREQUENCY_OPTIONS", () => {
  it("is a non-empty array of { value, label } objects", () => {
    expect(FREQUENCY_OPTIONS.length).toBeGreaterThan(0);
    for (const opt of FREQUENCY_OPTIONS) {
      expect(typeof opt.value).toBe("string");
      expect(typeof opt.label).toBe("string");
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });
});
