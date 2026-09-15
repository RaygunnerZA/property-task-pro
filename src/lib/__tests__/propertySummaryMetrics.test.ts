import { describe, expect, it } from "vitest";
import {
  computeAllPropertiesSummaryMetrics,
  computePropertySummaryMetrics,
  computeTodayActionGauge,
} from "@/lib/propertySummaryMetrics";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";

function doc(partial: Partial<PropertyDocument> & Pick<PropertyDocument, "id">): PropertyDocument {
  return {
    file_url: "",
    file_name: null,
    file_type: null,
    file_size: null,
    thumbnail_url: null,
    title: null,
    category: null,
    document_type: null,
    expiry_date: null,
    renewal_frequency: null,
    status: null,
    notes: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...partial,
  };
}

describe("computePropertySummaryMetrics", () => {
  it("does not count healthy compliance records as to-review", () => {
    const metrics = computePropertySummaryMetrics(
      { expired_compliance_count: 1, valid_compliance_count: 4, open_tasks_count: 22 },
      [
        { status: "open", priority: "urgent", title: "Fix leak" },
        { status: "completed", title: "Done A" },
      ],
      [],
      0,
      1
    );

    expect(metrics.complianceReviews).toBe(1);
    expect(metrics.openTasks).toBe(22);
    expect(metrics.urgentItems).toBe(1);
  });

  it("adds documents due within 30 days to the review queue", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 10);
    const metrics = computePropertySummaryMetrics(
      { expired_compliance_count: 1, valid_compliance_count: 4 },
      [],
      [doc({ id: "d1", expiry_date: soon.toISOString().slice(0, 10), title: "Insurance" })],
      0,
      0
    );

    expect(metrics.complianceReviews).toBe(2);
    expect(metrics.complianceDueSoon).toBe(1);
  });

  it("scopes the radial to today’s due-now set, not lifetime backlog", () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const todayKey = today.toISOString().slice(0, 10);
    const metrics = computePropertySummaryMetrics(
      { open_tasks_count: 22 },
      [
        ...Array.from({ length: 20 }, () => ({
          status: "open",
          title: "Later",
          due_date: "2099-01-01",
        })),
        { status: "open", title: "Due today", due_date: todayKey },
        { status: "open", title: "Also today", due_date: todayKey },
        ...Array.from({ length: 15 }, () => ({ status: "completed", title: "Done" })),
      ],
      [],
      0,
      0
    );

    expect(metrics.openTasks).toBe(22);
    expect(metrics.gaugeEyebrow).toBe("Today");
    expect(metrics.completedLabel).toBe("2 left today");
    expect(metrics.completionPct).toBe(0);
    expect(metrics.gaugeHint).toBe("Start here");
  });
});

describe("computeTodayActionGauge", () => {
  it("celebrates a clear day when open work is later", () => {
    const gauge = computeTodayActionGauge(
      [{ status: "open", due_date: "2099-06-01", title: "Later" }],
      5,
      new Date("2026-09-15T12:00:00")
    );
    expect(gauge.completionPct).toBe(100);
    expect(gauge.gaugeEyebrow).toBe("Today");
    expect(gauge.completedLabel).toBe("Nothing due today");
    expect(gauge.gaugeHint).toBe("5 open later");
  });

  it("counts completed-today wins against due-now remaining", () => {
    const now = new Date("2026-09-15T12:00:00");
    const gauge = computeTodayActionGauge(
      [
        {
          status: "completed",
          due_date: "2026-09-15",
          completed_at: "2026-09-15T09:00:00",
          title: "Done",
        },
        { status: "open", due_date: "2026-09-15", title: "Still due" },
        { status: "open", due_date: "2026-09-10", title: "Overdue" },
      ],
      2,
      now
    );
    expect(gauge.gaugeEyebrow).toBe("Due now");
    expect(gauge.completedLabel).toBe("2 left today");
    expect(gauge.completionPct).toBe(33);
    expect(gauge.gaugeHint).toBe("1 overdue");
  });
});

describe("computeAllPropertiesSummaryMetrics", () => {
  it("counts expired compliance only for portfolio to-review", () => {
    const metrics = computeAllPropertiesSummaryMetrics(
      [
        { id: "p1", expired_compliance_count: 1, valid_compliance_count: 8, open_tasks_count: 2 },
        { id: "p2", expired_compliance_count: 0, valid_compliance_count: 3, open_tasks_count: 1 },
      ],
      [],
      0
    );
    expect(metrics.complianceReviews).toBe(1);
  });
});
