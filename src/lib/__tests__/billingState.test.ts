import { describe, expect, it } from "vitest";
import {
  DEFAULT_BILLING_STATUS,
  isExpansionLocked,
  isInGrace,
  needsPaymentRecovery,
  parseBillingStatus,
} from "@/lib/billing/billingState";
import {
  recommendTierForMoment,
  upgradeCopy,
} from "@/lib/billing/planCatalog";
import {
  checkEvidenceUpload,
  evidenceQuotaWarning,
} from "@/lib/evidence/uploadLimits";
import { aiOpsCostUnits, aiQuotaWarning } from "@/lib/ai/costUnits";

describe("parseBillingStatus", () => {
  it("defaults safely", () => {
    expect(parseBillingStatus(null)).toEqual(DEFAULT_BILLING_STATUS);
  });

  it("parses grace / expansion_locked", () => {
    const grace = parseBillingStatus({
      state: "grace",
      expansion_allowed: true,
      grace_ends_at: "2026-08-20T00:00:00Z",
    });
    expect(isInGrace(grace)).toBe(true);
    expect(needsPaymentRecovery(grace)).toBe(true);
    expect(isExpansionLocked(grace)).toBe(false);

    const locked = parseBillingStatus({
      state: "expansion_locked",
      expansion_allowed: false,
    });
    expect(isExpansionLocked(locked)).toBe(true);
  });
});

describe("upgrade moments", () => {
  it("maps §20.8 moments to tiers", () => {
    expect(recommendTierForMoment("staff_collaboration")).toBe("home_plus");
    expect(recommendTierForMoment("second_property")).toBe("portfolio_2_5");
    expect(recommendTierForMoment("coordinating_seats")).toBe("seat_addon");
    expect(upgradeCopy("second_property").cta).toMatch(/Portfolio/i);
  });
});

describe("evidence upload limits", () => {
  it("rejects oversized images", () => {
    const file = new File([new Uint8Array(11 * 1024 * 1024)], "big.jpg", {
      type: "image/jpeg",
    });
    const result = checkEvidenceUpload({
      file,
      storageUsedBytes: 0,
      evidenceBytesAllowance: 1_000_000_000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("size");
  });

  it("blocks executable extensions", () => {
    const file = new File([new Uint8Array(100)], "payload.exe", {
      type: "application/x-msdownload",
    });
    const result = checkEvidenceUpload({
      file,
      storageUsedBytes: 0,
      evidenceBytesAllowance: 1_000_000_000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("malware");
  });

  it("enforces org quota when requested", () => {
    const file = new File([new Uint8Array(1024)], "ok.jpg", {
      type: "image/jpeg",
    });
    const result = checkEvidenceUpload({
      file,
      storageUsedBytes: 900,
      evidenceBytesAllowance: 1000,
      enforceQuota: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("quota");
  });

  it("warns near allowance", () => {
    expect(evidenceQuotaWarning(900, 1000)).toMatch(/nearly full/i);
    expect(evidenceQuotaWarning(1000, 1000)).toMatch(/at or over/i);
  });
});

describe("AI cost units", () => {
  it("maps product operations to units", () => {
    expect(aiOpsCostUnits("ai-extract")).toBe(1);
    expect(aiOpsCostUnits("ai-doc-analyse")).toBe(3);
    expect(aiOpsCostUnits("unknown")).toBe(1);
  });

  it("warns before AI exhaustion without implying work is blocked", () => {
    expect(aiQuotaWarning(90, 100)).toMatch(/nearly/i);
    expect(aiQuotaWarning(100, 100)).toMatch(/Manual workflows continue/i);
  });
});
