import { describe, expect, it } from "vitest";
import { resolveIdentityMode } from "@/utils/identityMode";

describe("resolveIdentityMode membership fallback", () => {
  it("maps legacy member to staff experience", () => {
    const result = resolveIdentityMode(null, "business", "member");
    expect(result.mode).toBe("staff");
    expect(result.source).toBe("org_membership");
  });

  it("maps owner/manager to manager experience", () => {
    expect(resolveIdentityMode(null, "business", "owner").mode).toBe("manager");
    expect(resolveIdentityMode(null, "business", "manager").mode).toBe("manager");
  });

  it("keeps personal org as personal", () => {
    expect(resolveIdentityMode(null, "personal", "owner").mode).toBe("personal");
  });
});
