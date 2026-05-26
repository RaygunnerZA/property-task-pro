import { describe, expect, it } from "vitest";
import { buildTasksByDate } from "../calendarDayMeta";

describe("buildTasksByDate", () => {
  it("includes maxUrgency for due dates and milestones", () => {
    const map = buildTasksByDate([
      {
        id: "1",
        status: "open",
        priority: "urgent",
        due_date: "2026-05-27",
        milestones: [{ dateTime: "2026-05-28T09:00" }],
      },
      {
        id: "2",
        status: "open",
        priority: "low",
        due_date: "2026-05-20",
      },
    ]);

    expect(map.get("2026-05-27")?.maxUrgency).toBe("urgent");
    expect(map.get("2026-05-28")?.maxUrgency).toBe("urgent");
    expect(map.get("2026-05-20")?.maxUrgency).toBe("overdue");
  });

  it("skips completed and archived tasks", () => {
    const map = buildTasksByDate([
      { id: "1", status: "completed", due_date: "2026-05-27" },
      { id: "2", status: "archived", due_date: "2026-05-27" },
    ]);
    expect(map.size).toBe(0);
  });
});
