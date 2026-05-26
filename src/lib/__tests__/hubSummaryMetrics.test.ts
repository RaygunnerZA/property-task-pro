import { describe, expect, it } from "vitest";
import { computeHubSummaryMetrics, isTaskMissingInfo } from "@/lib/hubSummaryMetrics";

describe("hubSummaryMetrics", () => {
  it("flags open tasks missing due date or context as missing info", () => {
    expect(
      isTaskMissingInfo({
        status: "open",
        due_date: null,
        assigned_user_id: "u1",
        spaces: [{ id: "s1" }],
      })
    ).toBe(true);
    expect(
      isTaskMissingInfo({
        status: "open",
        due_date: "2026-06-01",
        assigned_user_id: null,
        spaces: [],
      })
    ).toBe(true);
    expect(
      isTaskMissingInfo({
        status: "completed",
        due_date: null,
      })
    ).toBe(false);
  });

  it("aggregates counts for selected properties", () => {
    const properties = [
      { id: "p1", open_tasks_count: 2, spaces_count: 10, assets_count: 4 },
      { id: "p2", open_tasks_count: 1, spaces_count: 5, assets_count: 2 },
    ];
    const tasks = [
      {
        property_id: "p1",
        status: "open",
        priority: "urgent",
        due_date: "2020-01-01",
      },
      {
        property_id: "p1",
        status: "completed",
        priority: "normal",
        due_date: "2026-06-01",
      },
      {
        property_id: "p2",
        status: "open",
        priority: "low",
        due_date: null,
      },
    ];

    const metrics = computeHubSummaryMetrics(tasks, properties, new Set(["p1"]));

    expect(metrics.openTasksCount).toBe(2);
    expect(metrics.spacesCount).toBe(10);
    expect(metrics.assetsCount).toBe(4);
    expect(metrics.urgentCount).toBe(1);
    expect(metrics.overdueCount).toBe(1);
    expect(metrics.missingInfoCount).toBe(1);
  });
});
