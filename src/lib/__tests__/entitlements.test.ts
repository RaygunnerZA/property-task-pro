import { describe, expect, it } from "vitest";
import {
  HOME_ENTITLEMENTS,
  getAllowance,
  hasEntitlement,
  mergeEntitlements,
  resolvePlanLabel,
} from "@/lib/entitlements";
import { normalizeOrgRole } from "@/lib/permissions/normalizeOrgRole";

describe("mergeEntitlements", () => {
  it("returns Home defaults for null/missing", () => {
    expect(mergeEntitlements(null)).toEqual(HOME_ENTITLEMENTS);
    expect(mergeEntitlements(undefined)).toEqual(HOME_ENTITLEMENTS);
  });

  it("merges tier JSON over Home defaults", () => {
    const merged = mergeEntitlements({
      can_add_staff: true,
      active_properties_limit: 1,
      coordinating_seats_limit: 5,
    });
    expect(merged.can_add_staff).toBe(true);
    expect(merged.active_properties_limit).toBe(1);
    expect(merged.coordinating_seats_limit).toBe(5);
    expect(merged.multi_property_enabled).toBe(false);
  });

  it("accepts legacy max_properties alias", () => {
    expect(mergeEntitlements({ max_properties: 15 }).active_properties_limit).toBe(15);
  });
});

describe("hasEntitlement / getAllowance", () => {
  it("reads boolean and numeric keys", () => {
    const ents = mergeEntitlements({
      can_add_staff: true,
      active_properties_limit: 5,
    });
    expect(hasEntitlement(ents, "can_add_staff")).toBe(true);
    expect(getAllowance(ents, "active_properties_limit")).toBe(5);
  });
});

describe("resolvePlanLabel", () => {
  it("uses Home when no subscription", () => {
    expect(resolvePlanLabel(null, false)).toBe("Home");
  });

  it("uses tier name when present", () => {
    expect(resolvePlanLabel("Home Plus", true)).toBe("Home Plus");
  });
});

describe("normalizeOrgRole", () => {
  it("maps member to staff", () => {
    expect(normalizeOrgRole("member")).toBe("staff");
    expect(normalizeOrgRole("MEMBER")).toBe("staff");
    expect(normalizeOrgRole("staff")).toBe("staff");
    expect(normalizeOrgRole("owner")).toBe("owner");
    expect(normalizeOrgRole("viewer")).toBeNull();
    expect(normalizeOrgRole("admin")).toBe("manager");
  });
});
