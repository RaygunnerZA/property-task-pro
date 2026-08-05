import { describe, expect, it } from "vitest";
import { computeReportKpis, computeActiveSpaces } from "@/lib/reports/metrics";
import { resolveDateRange } from "@/lib/reports/dateRange";

describe("report metrics", () => {
  it("counts overdue and completed in range", () => {
    const range = resolveDateRange("30d", new Date("2026-08-05T12:00:00Z"));
    const kpis = computeReportKpis(
      [
        {
          id: "1",
          title: "Fix boiler",
          status: "todo",
          due_date: "2026-07-01",
          priority: "high",
        },
        {
          id: "2",
          title: "Done job",
          status: "completed",
          updated_at: "2026-08-01T10:00:00Z",
        },
      ],
      [],
      [],
      range
    );
    expect(kpis.overdue).toBe(1);
    expect(kpis.completed).toBe(1);
    expect(kpis.needsAttention).toBeGreaterThanOrEqual(1);
  });

  it("ranks active spaces from open tasks", () => {
    const rows = computeActiveSpaces([
      {
        id: "1",
        status: "todo",
        spaces: [{ name: "Boiler Room" }, { name: "Kitchen" }],
      },
      {
        id: "2",
        status: "todo",
        spaces: [{ name: "Boiler Room" }],
      },
      {
        id: "3",
        status: "completed",
        spaces: [{ name: "Boiler Room" }],
      },
    ]);
    expect(rows[0]?.name).toBe("Boiler Room");
    expect(rows[0]?.taskCount).toBe(2);
  });
});
