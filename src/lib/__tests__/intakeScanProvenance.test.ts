import { describe, expect, it } from "vitest";
import { buildIntakeScanProvenance, intakeScanProvenanceMetadata } from "@/lib/intakeScanProvenance";
import type { AggregatedIntakeScanReview } from "@/lib/aggregateIntakeScanReview";

const review: AggregatedIntakeScanReview = {
  outcome: "Action required",
  outcomeSeverity: "critical",
  primaryIssue: "Emergency communication system does not reliably connect.",
  dates: [
    {
      id: "d1",
      label: "Action deadline",
      date: "2026-07-31",
      kind: "action_deadline",
      remindByDefault: true,
    },
  ],
  actionDeadline: "2026-07-31",
  actions: [],
  failFindings: [
    {
      id: "f1",
      text: "Emergency communication system does not reliably connect.",
      status: "fail",
    },
  ],
  otherFindings: [{ id: "f2", text: "Emergency lighting: Conforme", status: "pass" }],
  signals: [],
  fileCountWithScan: 1,
};

describe("buildIntakeScanProvenance", () => {
  it("copies reviewed facts without inventing extra interpretation", () => {
    const provenance = buildIntakeScanProvenance({
      review,
      source: "document_scan",
      confirmedActionIds: ["agg:action-0:1"],
      linkedAssetIds: ["a1"],
      now: new Date("2026-09-03T08:00:00.000Z"),
    });
    expect(provenance.outcome).toBe("Action required");
    expect(provenance.dates[0]?.kind).toBe("action_deadline");
    expect(provenance.findings).toHaveLength(2);
    expect(provenance.confirmed_action_ids).toEqual(["agg:action-0:1"]);
    expect(provenance.linked_asset_ids).toEqual(["a1"]);
  });

  it("nests under intake_scan without dropping existing metadata", () => {
    const provenance = buildIntakeScanProvenance({
      review,
      source: "mixed",
      confirmedActionIds: [],
      linkedAssetIds: [],
      now: new Date("2026-09-03T08:00:00.000Z"),
    });
    const meta = intakeScanProvenanceMetadata(provenance, { already: true });
    expect(meta.already).toBe(true);
    expect((meta.intake_scan as { source: string }).source).toBe("mixed");
  });
});
