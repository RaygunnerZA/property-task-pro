import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AUTO_URGENT_HORIZON,
  isTaskEffectivelyUrgent,
} from "@/lib/autoUrgent";

describe("isTaskEffectivelyUrgent", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps stored urgent and high regardless of horizon", () => {
    expect(
      isTaskEffectivelyUrgent({ priority: "urgent", status: "open" }, "off")
    ).toBe(true);
    expect(
      isTaskEffectivelyUrgent({ priority: "high", status: "open" }, "off")
    ).toBe(true);
  });

  it("ignores completed work", () => {
    expect(
      isTaskEffectivelyUrgent(
        { priority: "normal", due_date: "2026-05-20", status: "completed" },
        "today",
        new Date("2026-05-25T12:00:00")
      )
    ).toBe(false);
  });

  it("treats overdue and due-today as urgent on the default horizon", () => {
    const now = new Date("2026-05-25T12:00:00");
    expect(DEFAULT_AUTO_URGENT_HORIZON).toBe("today");
    expect(
      isTaskEffectivelyUrgent(
        { priority: "normal", due_date: "2026-05-20", status: "open" },
        "today",
        now
      )
    ).toBe(true);
    expect(
      isTaskEffectivelyUrgent(
        { priority: "low", due_date: "2026-05-25", status: "open" },
        "today",
        now
      )
    ).toBe(true);
    expect(
      isTaskEffectivelyUrgent(
        { priority: "normal", due_date: "2026-05-26", status: "open" },
        "today",
        now
      )
    ).toBe(false);
  });

  it("honours wider horizons", () => {
    const now = new Date("2026-05-25T12:00:00");
    expect(
      isTaskEffectivelyUrgent(
        { priority: "normal", due_date: "2026-05-27", status: "open" },
        "2d",
        now
      )
    ).toBe(true);
    expect(
      isTaskEffectivelyUrgent(
        { priority: "normal", due_date: "2026-05-28", status: "open" },
        "2d",
        now
      )
    ).toBe(false);
  });
});
