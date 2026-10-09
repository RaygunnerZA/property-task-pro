import { describe, expect, it } from "vitest";
import { formatTaskDate } from "@/utils/formatTaskDate";

const now = new Date(2026, 9, 9, 15, 0, 0);

describe("formatTaskDate compact", () => {
  it("shortens tomorrow to a 12-hour clock and drops :00", () => {
    expect(formatTaskDate("2026-10-10T01:00:00", { compact: true, now })).toBe("TMRW • 1 AM");
    expect(formatTaskDate("2026-10-10T17:20:00", { compact: true, now })).toBe("TMRW • 5:20 PM");
  });

  it("keeps today and uses a 3-letter weekday inside the month", () => {
    expect(formatTaskDate("2026-10-09T09:05:00", { compact: true, now })).toBe("TODAY • 9:05 AM");
    expect(formatTaskDate("2026-10-11T01:00:00", { compact: true, now })).toBe("SUN 11 • 1 AM");
  });

  it("leaves the desktop wording unchanged", () => {
    expect(formatTaskDate("2026-10-10T01:00:00", { now })).toBe("TOMORROW • 01:00");
    expect(formatTaskDate("2026-10-11T01:00:00", { now })).toBe("SUN 11 • 01:00");
  });
});
