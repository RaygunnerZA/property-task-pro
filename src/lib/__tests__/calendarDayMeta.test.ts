import { describe, expect, it } from "vitest";
import { addDays, format, subDays } from "date-fns";
import {
  applyCalendarDisplayFilters,
  buildTasksByDate,
} from "../calendarDayMeta";

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

describe("applyCalendarDisplayFilters", () => {
  const me = "user-me";
  const other = "user-other";
  const milestoneSoon = format(addDays(new Date(), 2), "yyyy-MM-dd");

  const tasks = [
    {
      id: "mine-due",
      assigned_user_id: me,
      due_date: format(addDays(new Date(), 1), "yyyy-MM-dd"),
      priority: "normal",
      status: "open",
    },
    {
      id: "mine-milestone-only",
      assigned_user_id: me,
      due_date: null,
      milestones: [{ dateTime: `${milestoneSoon}T09:00` }],
      priority: "normal",
      status: "open",
    },
    {
      id: "theirs",
      assigned_user_id: other,
      due_date: format(addDays(new Date(), 1), "yyyy-MM-dd"),
      milestones: [{ dateTime: `${milestoneSoon}T10:00` }],
      priority: "normal",
      status: "open",
    },
  ];

  it("All tasks keeps everyone's due dates and milestone-only rows", () => {
    const result = applyCalendarDisplayFilters(tasks, {
      userId: me,
      taskScope: "all",
    });
    expect(result.map((t) => t.id).sort()).toEqual([
      "mine-due",
      "mine-milestone-only",
      "theirs",
    ]);
  });

  it("My tasks keeps only assigned-to-me rows including milestone-only", () => {
    const result = applyCalendarDisplayFilters(tasks, {
      userId: me,
      taskScope: "mine",
    });
    expect(result.map((t) => t.id).sort()).toEqual(["mine-due", "mine-milestone-only"]);
  });

  it("Due this week includes milestone-only tasks in range", () => {
    const result = applyCalendarDisplayFilters(
      [
        {
          id: "milestone-week",
          assigned_user_id: other,
          due_date: null,
          milestones: [{ dateTime: `${milestoneSoon}T09:00` }],
          status: "open",
        },
        {
          id: "milestone-later",
          assigned_user_id: other,
          due_date: null,
          milestones: [{ dateTime: `${format(addDays(new Date(), 20), "yyyy-MM-dd")}T09:00` }],
          status: "open",
        },
      ],
      { taskScope: "due" }
    );
    expect(result.map((t) => t.id)).toEqual(["milestone-week"]);
  });
});
