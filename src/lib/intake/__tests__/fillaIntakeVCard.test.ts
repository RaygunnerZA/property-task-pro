import { describe, expect, it } from "vitest";
import {
  buildFillaIntakeVCard,
  fillaIntakeContactDisplayName,
  fillaIntakeVCardFilename,
  openVCardForImport,
  prefersContactsHandoff,
  sanitizeVCardFilenamePart,
} from "@/lib/intake/fillaIntakeVCard";

const TOKEN_EMAIL = "jane+secretMembershipToken99@inbox.filla.app";

describe("fillaIntakeVCard", () => {
  it("keeps the token only in EMAIL", () => {
    const vcf = buildFillaIntakeVCard({
      email: TOKEN_EMAIL,
      orgName: "Acme Properties",
      multiOrg: true,
      photoPngBase64: "AAAA",
    });
    expect(vcf).toContain(`EMAIL;TYPE=INTERNET:${TOKEN_EMAIL}`);
    expect(vcf).toContain("FN:Fwd → Filla – Acme Properties");
    expect(vcf).toContain("ORG:Filla");
    expect(vcf).toContain("PHOTO;ENCODING=b;TYPE=PNG:AAAA");
    expect(vcf).not.toMatch(/NOTE:.*secretMembershipToken/i);
    expect(vcf).not.toMatch(/FN:.*secretMembershipToken/i);
    expect(vcf).not.toMatch(/ORG:.*secretMembershipToken/i);
  });

  it("uses a simple display name for a single organisation", () => {
    expect(fillaIntakeContactDisplayName("Acme", false)).toBe("Fwd → Filla");
    expect(fillaIntakeVCardFilename("Acme", false)).toBe("Fwd-Filla.vcf");
  });

  it("includes organisation in multi-org name and filename without the token", () => {
    expect(fillaIntakeContactDisplayName("Acme Properties", true)).toBe(
      "Fwd → Filla – Acme Properties"
    );
    const file = fillaIntakeVCardFilename("Acme Properties", true);
    expect(file).toBe("Fwd-Filla-Acme-Properties.vcf");
    expect(file).not.toContain("secret");
    expect(sanitizeVCardFilenamePart("Foo / Bar!")).toBe("Foo-Bar");
  });

  it("detects Apple Safari handoff without throwing in jsdom", () => {
    expect(typeof prefersContactsHandoff()).toBe("boolean");
    expect(typeof openVCardForImport).toBe("function");
  });
});
