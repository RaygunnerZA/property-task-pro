import { describe, expect, it, vi, afterEach } from "vitest";
import { formatMessageDayLabel } from "@/lib/formatMessageDayLabel";

describe("formatMessageDayLabel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns YESTERDAY for yesterday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T12:00:00"));
    expect(formatMessageDayLabel("2026-08-11T18:00:00")).toBe("YESTERDAY");
  });

  it("returns weekday within the last week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T12:00:00")); // Wednesday
    expect(formatMessageDayLabel("2026-08-10T10:00:00")).toBe("MONDAY");
  });

  it("returns short date when older than a week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T12:00:00"));
    expect(formatMessageDayLabel("2026-07-01T10:00:00")).toBe("1 JUL");
  });
});
