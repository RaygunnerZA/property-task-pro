import { describe, expect, it } from "vitest";
import {
  applyWeekendPushToDate,
  defaultWeekendPush,
  isWeekendDueDate,
  resolveWeekendPush,
} from "../repeatWeekendPush";

describe("repeatWeekendPush", () => {
  it("detects Saturday and Sunday due dates", () => {
    expect(isWeekendDueDate("2026-08-15")).toBe(true); // Sat
    expect(isWeekendDueDate("2026-08-16")).toBe(true); // Sun
    expect(isWeekendDueDate("2026-08-17")).toBe(false); // Mon
  });

  it("defaults push on for daily/monthly/yearly and off for weekly", () => {
    expect(defaultWeekendPush("daily")).toBe(true);
    expect(defaultWeekendPush("monthly")).toBe(true);
    expect(defaultWeekendPush("yearly")).toBe(true);
    expect(defaultWeekendPush("weekly")).toBe(false);
  });

  it("resolveWeekendPush prefers explicit rule value", () => {
    expect(
      resolveWeekendPush({ type: "weekly", weekend_push: true }, "2026-08-15")
    ).toBe(true);
    expect(
      resolveWeekendPush({ type: "daily", weekend_push: false }, "2026-08-15")
    ).toBe(false);
    expect(resolveWeekendPush({ type: "weekly" }, "2026-08-15")).toBe(false);
    expect(resolveWeekendPush({ type: "daily" }, "2026-08-17")).toBeUndefined();
  });

  it("pushes Sat/Sun to Monday when enabled", () => {
    const sat = new Date(2026, 7, 15); // local Sat
    const sun = new Date(2026, 7, 16);
    expect(applyWeekendPushToDate(sat, true).getDay()).toBe(1);
    expect(applyWeekendPushToDate(sun, true).getDay()).toBe(1);
    expect(applyWeekendPushToDate(sat, false).getDay()).toBe(6);
  });
});
