import { describe, expect, it } from "vitest";
import {
  clusterRequirementGroups,
  inferKnowledgeFieldsFromClaims,
  inferLegalStrength,
  looksLikeLandlordGasKnowledge,
  looksLikeSeasonalPackageTitle,
  durableGasKnowledgeTitle,
  attributesPatchFromInference,
  buildKnowledgeRepairPatch,
} from "../knowledgeFieldInference";
import type { ClaimLike } from "../knowledgeFieldInference";

const HSE_CLAIMS: ClaimLike[] = [
  {
    claim_text:
      "Landlords must keep relevant gas appliances, flues and installation pipework in a safe condition.",
    category: "obligation",
    verification_status: "verified",
  },
  {
    claim_text:
      "Servicing should follow the manufacturer’s instructions; where those instructions are unavailable, HSE recommends annual servicing.",
    category: "obligation",
    verification_status: "verified",
  },
  {
    claim_text:
      "Relevant work must be performed by a Gas Safe registered engineer.",
    category: "obligation",
    verification_status: "verified",
  },
  {
    claim_text:
      "Before re-letting, a landlord must complete safety checks and provide the relevant record to the tenant.",
    category: "obligation",
    verification_status: "extracted",
  },
  {
    claim_text:
      "Landlords should retain evidence of reasonable attempts to gain tenant access.",
    category: "evidence",
    verification_status: "extracted",
  },
  {
    claim_text:
      "Where a flue is communal or passing, the landlord remains responsible for keeping it in a safe condition.",
    category: "obligation",
    verification_status: "extracted",
  },
  {
    claim_text:
      "These duties apply where a landlord is responsible for gas appliances in rented premises.",
    category: "applicability",
    verification_status: "verified",
  },
  {
    claim_text:
      "A landlord is the responsible party for gas safety in the let premises.",
    category: "responsibility",
    verification_status: "verified",
  },
  {
    claim_text: "Keep service records demonstrating maintenance.",
    category: "evidence",
    verification_status: "extracted",
  },
  {
    claim_text:
      "The Gas Safety (Installation and Use) Regulations 1998 set out these duties.",
    category: "standard",
    verification_status: "extracted",
  },
];

describe("inferLegalStrength", () => {
  it("distinguishes must, should, exception and explanatory", () => {
    expect(
      inferLegalStrength({
        claim_text: "Landlords must keep appliances in a safe condition.",
        category: "obligation",
      })
    ).toBe("must");
    expect(
      inferLegalStrength({
        claim_text: "HSE recommends annual servicing where instructions are unavailable.",
        category: "obligation",
      })
    ).toBe("should");
    expect(
      inferLegalStrength({
        claim_text: "This does not apply unless the landlord supplies the appliance.",
        category: "exception",
      })
    ).toBe("exception");
    expect(
      inferLegalStrength({
        claim_text: "The 1998 Regulations set out these duties.",
        category: "standard",
      })
    ).toBe("explanatory");
  });
});

describe("clusterRequirementGroups", () => {
  it("splits HSE landlord-gas claims into the six expected groups", () => {
    const groups = clusterRequirementGroups(HSE_CLAIMS);
    expect(groups.map((g) => g.id)).toEqual([
      "gas_safe",
      "service",
      "relet",
      "access",
      "communal",
      "maintain",
    ]);
    expect(groups.find((g) => g.id === "maintain")?.strength).toBe("must");
    expect(groups.find((g) => g.id === "service")?.strength).toBe("should");
    expect(groups.find((g) => g.id === "gas_safe")?.strength).toBe("must");
    expect(groups.find((g) => g.id === "relet")?.strength).toBe("must");
    expect(groups.find((g) => g.id === "access")?.strength).toBe("should");
    expect(groups.find((g) => g.id === "communal")?.strength).toBe("must");
  });
});

describe("inferKnowledgeFieldsFromClaims", () => {
  it("infers mixed classification, compound trigger, and a composed answer from HSE claims", () => {
    const inferred = inferKnowledgeFieldsFromClaims({
      claims: HSE_CLAIMS,
      jurisdiction: "England",
      sourceUrl: "https://www.hse.gov.uk/gas/landlords/landlords-duties.htm",
      title: "Before the heating season — England",
    });

    expect(inferred.classificationMissing).toBe(false);
    expect(inferred.triggerMissing).toBe(false);
    expect(inferred.legal_status).toBe("mandatory_with_recommendations");
    expect(inferred.classificationLabel).toBe(
      "Mandatory requirement, with some recommended practices"
    );
    expect(inferred.trigger_type).toBe("continuous");
    expect(inferred.timing).toMatch(/ongoing/i);
    expect(inferred.timing).toMatch(/manufacturer/i);
    expect(inferred.timing).toMatch(/re-lett/i);
    expect(inferred.applies_when).toMatch(/landlord/i);
    expect(inferred.evidence).toMatch(/record/i);
    expect(inferred.composedTitle).toBe(
      "Landlord gas-appliance and flue maintenance — England"
    );
    expect(inferred.composedAnswer).toMatch(/must keep/i);
    expect(inferred.composedAnswer).toMatch(/Gas Safe/i);
    expect(inferred.composedAnswer).toMatch(/should follow|recommends annual/i);
    expect(inferred.composedAnswer).not.toMatch(/re-lett/i);
    expect(inferred.groups.filter((g) => g.conditional).map((g) => g.id)).toEqual([
      "relet",
      "access",
      "communal",
    ]);
    expect(inferred.foundCount).toBe(6);
    expect(inferred.foundLine(1)).toBe(
      "Filla found six related requirements and recommendations from one authoritative source."
    );
  });

  it("does not treat mixed must/should as a missing classification", () => {
    const inferred = inferKnowledgeFieldsFromClaims({
      claims: [
        { claim_text: "Landlords must keep flues in a safe condition.", category: "obligation" },
        { claim_text: "HSE recommends annual servicing.", category: "obligation" },
      ],
    });
    expect(inferred.classificationMissing).toBe(false);
    expect(inferred.legal_status).toBe("mandatory_with_recommendations");
  });

  it("only stays unresolved when claims give no classification signal", () => {
    const inferred = inferKnowledgeFieldsFromClaims({
      claims: [{ claim_text: "Gas is a fuel used in some homes.", category: "other" }],
    });
    expect(inferred.classificationMissing).toBe(true);
    expect(inferred.foundCount).toBe(0);
  });
});

describe("durable vs seasonal title", () => {
  it("recognises seasonal package titles and durable gas sources", () => {
    expect(looksLikeSeasonalPackageTitle("Before the heating season — England")).toBe(true);
    expect(
      looksLikeLandlordGasKnowledge({
        sourceUrl: "https://www.hse.gov.uk/gas/landlords/landlords-duties.htm",
        title: "Before the heating season — England",
      })
    ).toBe(true);
    expect(durableGasKnowledgeTitle("England")).toBe(
      "Landlord gas-appliance and flue maintenance — England"
    );
  });
});

describe("attributesPatchFromInference", () => {
  it("fills empty attributes without overwriting human values", () => {
    const inferred = inferKnowledgeFieldsFromClaims({ claims: HSE_CLAIMS });
    const patched = attributesPatchFromInference({}, inferred);
    expect(patched.legal_status).toBe("mandatory_with_recommendations");
    expect(patched.trigger_type).toBe("continuous");

    const kept = attributesPatchFromInference(
      { legal_status: "recommended", trigger_type: "event_driven" },
      inferred
    );
    expect(kept.legal_status).toBe("recommended");
    expect(kept.trigger_type).toBe("event_driven");
  });
});

describe("buildKnowledgeRepairPatch", () => {
  it("retitles seasonal package inheritance and writes a composed summary", () => {
    const patch = buildKnowledgeRepairPatch({
      title: "Before the heating season — England",
      summary:
        "Landlords must keep appliances safe and should service them and must use Gas Safe and must check before re-letting and should keep access records and must maintain communal flues and more blended duties across every circumstance.",
      attributes: { applies_when: "Before the heating season" },
      applicability: { jurisdictions: ["England"] },
      sourceUrl: "https://www.hse.gov.uk/gas/landlords/landlords-duties.htm",
      claims: HSE_CLAIMS,
    });
    expect(patch.changed).toBe(true);
    expect(patch.title).toBe("Landlord gas-appliance and flue maintenance — England");
    expect(patch.summary).toMatch(/must keep/i);
    expect(patch.summary).not.toMatch(/re-lett/i);
    expect(patch.attributes.applies_when).toMatch(/landlord/i);
    expect(patch.attributes.applies_when).not.toMatch(/heating season/i);
  });
});
