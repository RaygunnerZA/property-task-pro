import { describe, expect, it } from "vitest";
import { isSignalEligibleForIssuesFeed } from "@/lib/signals/signalFeedEligibility";
import type { SignalRow } from "@/lib/signals/signalTypes";

function row(partial: Partial<SignalRow>): SignalRow {
  return {
    id: "1",
    org_id: "org",
    property_id: "prop",
    space_id: null,
    asset_id: null,
    kind: "system",
    category: "environmental",
    subtype: "weather.storm",
    severity: "urgent",
    title: "Storm",
    body: null,
    review_state: "none",
    disposition: "urgent",
    source: "open_meteo",
    source_key: "weather",
    payload: {},
    recommendation: { action: "create_task" },
    dedupe_key: null,
    expires_at: null,
    resolved_at: null,
    converted_entity_type: null,
    converted_entity_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

describe("isSignalEligibleForIssuesFeed", () => {
  it("allows urgent environmental signals", () => {
    expect(isSignalEligibleForIssuesFeed(row({}))).toBe(true);
  });

  it("suppresses operational meta subtypes", () => {
    expect(
      isSignalEligibleForIssuesFeed(row({ subtype: "property.geocoded", severity: "info" }))
    ).toBe(false);
    expect(
      isSignalEligibleForIssuesFeed(row({ subtype: "location.gps_verified", severity: "info" }))
    ).toBe(false);
  });

  it("hides expired signals", () => {
    expect(
      isSignalEligibleForIssuesFeed(
        row({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      )
    ).toBe(false);
  });

  it("hides low-severity info without review disposition", () => {
    expect(
      isSignalEligibleForIssuesFeed(
        row({ severity: "info", disposition: "recent", subtype: "pollen.high" })
      )
    ).toBe(false);
  });
});
