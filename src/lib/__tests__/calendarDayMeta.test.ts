import { describe, expect, it } from "vitest";
import { addDays, format, subDays } from "date-fns";
import { buildTasksByDate } from "../calendarDayMeta";

describe("buildTasksByDate", () => {
  it("includes maxUrgency for due dates and milestones", () => {
    const due = addDays(new Date(), 2);
    const milestone = addDays(new Date(), 3);
    const overdue = subDays(new Date(), 5);
    const dueKey = format(due, "yyyy-MM-dd");
    const milestoneKey = format(milestone, "yyyy-MM-dd");
    const overdueKey = format(overdue, "yyyy-MM-dd");

    const map = buildTasksByDate([
      {
        id: "1",
        status: "open",
        priority: "urgent",
        due_date: dueKey,
        milestones: [{ dateTime: `${milestoneKey}T09:00` }],
      },
      {
        id: "2",
        status: "open",
        priority: "low",
        due_date: overdueKey,
      },
    ]);

    expect(map.get(dueKey)?.maxUrgency).toBe("urgent");
    expect(map.get(milestoneKey)?.maxUrgency).toBe("urgent");
    expect(map.get(overdueKey)?.maxUrgency).toBe("overdue");
  });

  it("skips completed and archived tasks", () => {
    const map = buildTasksByDate([
      { id: "1", status: "completed", due_date: "2026-05-27" },
      { id: "2", status: "archived", due_date: "2026-05-27" },
    ]);
    expect(map.size).toBe(0);
  });

  it("parses milestones stored as JSON strings", () => {
    const milestone = addDays(new Date(), 4);
    const milestoneKey = format(milestone, "yyyy-MM-dd");
    const map = buildTasksByDate([
      {
        id: "1",
        status: "open",
        priority: "high",
        milestones: JSON.stringify([{ dateTime: `${milestoneKey}T09:00` }]),
      },
    ]);
    expect(map.get(milestoneKey)?.maxUrgency).toBe("high");
  });
});
