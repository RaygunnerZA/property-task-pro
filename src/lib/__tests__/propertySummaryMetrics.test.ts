import { describe, expect, it } from "vitest";
import {
  computeAllPropertiesSummaryMetrics,
  computePropertySummaryMetrics,
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

  it("keeps completion math as done / (open + done)", () => {
    const metrics = computePropertySummaryMetrics(
      { open_tasks_count: 22 },
      [
        ...Array.from({ length: 22 }, () => ({ status: "open", title: "Open" })),
        ...Array.from({ length: 15 }, () => ({ status: "completed", title: "Done" })),
      ],
      [],
      0,
      0
    );

    expect(metrics.openTasks).toBe(22);
    expect(metrics.completedLabel).toBe("15 of 37 complete");
    expect(metrics.completionPct).toBe(41);
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
