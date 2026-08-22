import { describe, expect, it } from "vitest";
import {
  isCompletedPastArchiveWindow,
  isAutoArchiveIntervalId,
  intervalDays,
} from "@/lib/autoArchive";

describe("autoArchive", () => {
  it("recognises interval ids", () => {
    expect(isAutoArchiveIntervalId("1d")).toBe(true);
    expect(isAutoArchiveIntervalId("3d")).toBe(true);
    expect(isAutoArchiveIntervalId("weekly")).toBe(true);
    expect(isAutoArchiveIntervalId("monthly")).toBe(false);
    expect(isAutoArchiveIntervalId("nope")).toBe(false);
  });

  it("maps intervals to days", () => {
    expect(intervalDays("1d")).toBe(1);
    expect(intervalDays("3d")).toBe(3);
    expect(intervalDays("weekly")).toBe(7);
  });

  it("detects completed tasks past the window", () => {
    const now = Date.parse("2026-08-22T12:00:00.000Z");
    expect(
      isCompletedPastArchiveWindow("2026-08-20T12:00:00.000Z", null, "1d", now)
    ).toBe(true);
    expect(
      isCompletedPastArchiveWindow("2026-08-22T06:00:00.000Z", null, "1d", now)
    ).toBe(false);
    expect(
      isCompletedPastArchiveWindow(null, "2026-07-01T00:00:00.000Z", "weekly", now)
    ).toBe(true);
  });
});
