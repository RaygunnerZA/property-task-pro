import { describe, expect, it } from "vitest";
import {
  isOfficialSourceHost,
  repairOfficialSourceUrl,
  validateOfficialSourceUrl,
} from "../../../../supabase/functions/_shared/officialSourceAllowlist.ts";

describe("officialSourceAllowlist", () => {
  it("accepts known official hosts and subdomains", () => {
    expect(isOfficialSourceHost("www.gov.uk")).toBe(true);
    expect(isOfficialSourceHost("legislation.gov.uk")).toBe(true);
    expect(isOfficialSourceHost("www.legifrance.gouv.fr")).toBe(true);
    expect(isOfficialSourceHost("fedlex.admin.ch")).toBe(true);
    expect(isOfficialSourceHost("assets.publishing.service.gov.uk")).toBe(true);
  });

  it("rejects non-official hosts", () => {
    expect(isOfficialSourceHost("example.com")).toBe(false);
    expect(isOfficialSourceHost("legislation.gouv.fr")).toBe(false);
    expect(isOfficialSourceHost("wikipedia.org")).toBe(false);
  });

  it("repairs known Legifrance typos", () => {
    expect(repairOfficialSourceUrl("https://www.legislation.gouv.fr/codes")).toBe(
      "https://www.legifrance.gouv.fr/codes"
    );
    expect(repairOfficialSourceUrl("https://legislation.gouv.fr/")).toContain("legifrance.gouv.fr");
  });

  it("validateOfficialSourceUrl repairs then allowlists", () => {
    const bad = validateOfficialSourceUrl("https://www.legislation.gouv.fr/affichCode.do");
    expect(bad.ok).toBe(true);
    if (bad.ok) {
      expect(bad.url).toContain("legifrance.gouv.fr");
      expect(bad.repaired).toBe(true);
    }

    const rejected = validateOfficialSourceUrl("https://example.com/act");
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.reason).toBe("not_allowlisted");
  });
});
