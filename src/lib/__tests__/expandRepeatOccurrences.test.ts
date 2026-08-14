import { describe, expect, it } from "vitest";
import { addDays, format, startOfMonth, endOfMonth } from "date-fns";
import { buildTasksByDate } from "../calendarDayMeta";
import {
  expandRepeatOccurrenceDateKeys,
  advanceDateByRepeatRule,
} from "../taskWhenNormalize";

describe("expandRepeatOccurrenceDateKeys", () => {
  it("expands weekly repeats inside the range", () => {
    const start = new Date(2026, 7, 1); // Aug 1
    const end = new Date(2026, 7, 31);
    const keys = expandRepeatOccurrenceDateKeys(
      "2026-08-03",
      { type: "weekly", interval: 1 },
      start,
      end
    );
    expect(keys).toEqual(["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"]);
  });

  it("expands daily repeats with weekend push to Monday", () => {
    const start = new Date(2026, 7, 14); // Fri
    const end = new Date(2026, 7, 18); // Tue
    const keys = expandRepeatOccurrenceDateKeys(
      "2026-08-14",
      { type: "daily", interval: 1, weekend_push: true },
      start,
      end
    );
    // Fri, then Sat→Mon, Sun would also push to Mon (dedupe by day keys as separate steps)
    expect(keys).toContain("2026-08-14");
    expect(keys).toContain("2026-08-17"); // Mon
  });

  it("returns empty without an anchor due date", () => {
    expect(
      expandRepeatOccurrenceDateKeys(null, { type: "weekly", interval: 1 }, new Date(), new Date())
    ).toEqual([]);
  });
});

describe("advanceDateByRepeatRule", () => {
  it("advances monthly", () => {
    const next = advanceDateByRepeatRule(new Date(2026, 0, 10), {
      type: "monthly",
      interval: 1,
    });
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(10);
  });
});

describe("buildTasksByDate with repeats", () => {
  it("paints weekly occurrences across the month", () => {
    const rangeStart = startOfMonth(new Date(2026, 7, 1));
    const rangeEnd = endOfMonth(new Date(2026, 7, 1));
    const map = buildTasksByDate(
      [
        {
          id: "weekly-1",
          status: "open",
          priority: "normal",
          due_date: "2026-08-03",
          repeat_rule: { type: "weekly", interval: 1 },
        },
      ],
      { rangeStart, rangeEnd }
    );

    expect(map.get("2026-08-03")?.total).toBe(1);
    expect(map.get("2026-08-10")?.total).toBe(1);
    expect(map.get("2026-08-17")?.total).toBe(1);
    expect(map.get("2026-08-04")?.total).toBeUndefined();
  });

  it("still shows a single due date when there is no repeat rule", () => {
    const due = format(addDays(new Date(), 2), "yyyy-MM-dd");
    const map = buildTasksByDate([
      { id: "1", status: "open", priority: "high", due_date: due },
    ]);
    expect(map.get(due)?.maxUrgency).toBe("high");
  });
});
