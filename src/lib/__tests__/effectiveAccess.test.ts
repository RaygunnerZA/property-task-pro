import { describe, expect, it } from "vitest";
import {
  filterPropertiesByScope,
  resolveEffectiveAccess,
} from "@/lib/permissions/effectiveAccess";
import { HOME_ENTITLEMENTS, mergeEntitlements } from "@/lib/entitlements";

describe("resolveEffectiveAccess", () => {
  it("denies Staff task creation", () => {
    const access = resolveEffectiveAccess({
      role: "staff",
      entitlements: mergeEntitlements({ can_add_staff: true }),
    });
    expect(access.canCreateTask).toBe(false);
    expect(access.canInviteManagers).toBe(false);
  });

  it("allows Manager to create tasks but not invite managers", () => {
    const access = resolveEffectiveAccess({
      role: "manager",
      entitlements: mergeEntitlements({ can_add_staff: true }),
    });
    expect(access.canCreateTask).toBe(true);
    expect(access.canInviteStaff).toBe(true);
    expect(access.canInviteManagers).toBe(false);
  });

  it("scopes properties when assigned_properties set", () => {
    const access = resolveEffectiveAccess({
      role: "staff",
      assignedPropertyIds: ["p1", "p2"],
    });
    expect(access.propertyScopeIds).toEqual(["p1", "p2"]);
    const filtered = filterPropertiesByScope(
      [{ id: "p1" }, { id: "p3" }],
      access
    );
    expect(filtered.map((p) => p.id)).toEqual(["p1"]);
  });

  it("Primary Owner alone manages billing", () => {
    const primary = resolveEffectiveAccess({
      role: "owner",
      isPrimaryOwner: true,
      entitlements: HOME_ENTITLEMENTS,
    });
    const coOwner = resolveEffectiveAccess({
      role: "owner",
      isPrimaryOwner: false,
      entitlements: HOME_ENTITLEMENTS,
    });
    expect(primary.canManageBilling).toBe(true);
    expect(primary.canTransferOwnership).toBe(true);
    expect(coOwner.canManageBilling).toBe(false);
  });

  it("maps legacy member to staff permissions", () => {
    const access = resolveEffectiveAccess({ role: "member" });
    expect(access.role).toBe("staff");
    expect(access.canCreateTask).toBe(false);
  });

  it("blocks expansion when billing expansion is locked", () => {
    const access = resolveEffectiveAccess({
      role: "owner",
      isPrimaryOwner: true,
      entitlements: mergeEntitlements({
        can_add_staff: true,
        multi_property_enabled: true,
        active_properties_limit: 5,
      }),
      expansionAllowed: false,
    });
    expect(access.canAddProperty).toBe(false);
    expect(access.canInviteStaff).toBe(false);
    expect(access.canManageBilling).toBe(true);
    expect(access.canCreateTask).toBe(true);
  });
});
