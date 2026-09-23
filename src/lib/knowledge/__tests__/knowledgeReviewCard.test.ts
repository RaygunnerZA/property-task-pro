import { describe, expect, it } from "vitest";
import { buildReviewCard, reviewInterrupts } from "@/lib/knowledge/knowledgeReviewCard";
import { buildTrustChecks } from "@/lib/knowledge/knowledgePresentation";
import type { KnowledgeRow } from "@/types/knowledge";

function knowledge(
  partial: Partial<KnowledgeRow> & Pick<KnowledgeRow, "id" | "title" | "status">
): KnowledgeRow {
  return {
    scope: "platform",
    org_id: null,
    summary: null,
    body: null,
    content: {},
    attributes: {},
    source_kind: "filla_curated",
    trust_score: null,
    provenance: {},
    cohort_size: null,
    version: 1,
    supersedes_id: null,
    created_by: null,
    reviewed_by: null,
    published_at: null,
    applicability: {},
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-15T00:00:00Z",
    ...partial,
  } as KnowledgeRow;
}

const OFFICIAL_SOURCE = {
  id: "s1",
  label: "Sweeping obligations — Service-Public",
  url: "https://www.service-public.fr/particuliers/vosdroits/F17959",
  source_type: "official_guidance",
  created_at: "2026-09-10T00:00:00Z",
  metadata: {},
};

describe("knowledgeReviewCard", () => {
  const frRow = knowledge({
    id: "k-fr",
    title: "Chimney sweeping — France",
    status: "candidate",
    summary:
      "If a working fireplace, stove or flued appliance is in use, arrange mechanical sweeping by a qualified professional and keep the certificate.",
    applicability: { jurisdictions: ["France"] },
    attributes: {
      responsible_party: "Occupant (tenant) unless the lease says otherwise",
      applies_when: "A working fireplace, stove or flued appliance is in use",
      action: "Arrange mechanical sweeping by a qualified professional",
      frequency: "At least once a year; local rules can require more",
      evidence: "Sweeping certificate (certificat de ramonage)",
      risk_or_consequence: "Fines and possible insurance consequences after a chimney fire",
    },
  });

  const claims = [
    {
      claim_text: "Mechanical sweeping is required at least annually",
      category: "obligation",
      verification_status: "verified",
    },
    {
      claim_text: "A certificate must be retained",
      category: "evidence",
      verification_status: "extracted",
    },
    {
      claim_text: "Frequency can be increased by municipal or departmental rules",
      category: "exception",
      verification_status: "extracted",
    },
  ];

  it("composes answer, facts, and found-summary from existing data", () => {
    const checks = buildTrustChecks(frRow, {
      sources: [OFFICIAL_SOURCE],
      verificationEvents: [],
    });
    const card = buildReviewCard({
      row: frRow,
      claims,
      sources: [OFFICIAL_SOURCE],
      checks,
    });

    expect(card.answer).toMatch(/mechanical sweeping/i);
    expect(card.jurisdictionLine).toMatch(/France/);
    expect(card.facts.map((f) => f.label)).toEqual([
      "Applies when",
      "Timing",
      "Evidence",
    ]);
    expect(card.found.supportedActions).toBe(3);
    expect(card.found.localVariations).toBeGreaterThanOrEqual(1);
    expect(card.found.authoritativeSources).toBe(1);
    expect(card.foundLine).toMatch(/authoritative source/);
    expect(card.foundLine).not.toMatch(/supported action/);
  });

  it("offers Approve/Correct/Hold with Approve mirroring the verify gate", () => {
    const checks = buildTrustChecks(frRow, {
      sources: [OFFICIAL_SOURCE],
      verificationEvents: [],
    });
    const card = buildReviewCard({
      row: frRow,
      claims,
      sources: [OFFICIAL_SOURCE],
      checks,
    });
    const kinds = card.decisions.map((d) => d.kind);
    expect(kinds).toEqual(["approve", "correct", "hold"]);
    const approve = card.decisions[0];
    // Whatever the gate says, a disabled Approve must explain itself.
    if (!approve.enabled) {
      expect(approve.disabledReason).toBeTruthy();
    } else {
      expect(approve.targetStatus).toBe("verified");
    }
  });

  it("never enables Approve for stale or published rows", () => {
    for (const status of ["stale", "published"] as const) {
      const card = buildReviewCard({
        row: knowledge({ id: `k-${status}`, title: "X", status }),
        claims: [],
        sources: [],
        checks: [],
      });
      expect(card.decisions[0].enabled).toBe(false);
      expect(card.decisions[0].disabledReason).toBeTruthy();
    }
  });

  it("interrupts only for the defined conditions", () => {
    // Clean candidate with source + supported claims and clear jurisdiction:
    // the only acceptable interrupts are check-driven, never invented.
    const clean = reviewInterrupts({
      row: frRow,
      claims,
      checks: [],
      authoritativeSourceCount: 1,
    });
    expect(clean).toEqual([]);

    const unclear = reviewInterrupts({
      row: knowledge({
        id: "k-x",
        title: "No jurisdiction",
        status: "candidate",
        applicability: {},
      }),
      claims: [{ verification_status: "unknown" }],
      checks: [
        { id: "guidance", label: "Guidance quality", status: "failed" },
      ],
      authoritativeSourceCount: 0,
    });
    expect(unclear.some((i) => /jurisdiction/i.test(i))).toBe(true);
    expect(unclear.some((i) => /partially supported/i.test(i))).toBe(true);
    expect(unclear.some((i) => /no authoritative source/i.test(i))).toBe(true);
    expect(unclear.some((i) => /check failed/i.test(i))).toBe(true);
  });

  it("flags publish recommendation as the interrupt for verified rows", () => {
    const interrupts = reviewInterrupts({
      row: knowledge({
        id: "k-v",
        title: "Verified row",
        status: "verified",
        applicability: { jurisdictions: ["France"] },
      }),
      claims: [{ verification_status: "verified" }],
      checks: [],
      authoritativeSourceCount: 1,
    });
    expect(interrupts).toEqual([
      "Machine recommends publishing — human confirmation required.",
    ]);
  });

  it("presents landlord-gas claims as a Knowledge set, not 24 blended actions", () => {
    const row = knowledge({
      id: "k-gas",
      title: "Before the heating season — England",
      status: "candidate",
      summary:
        "Landlords must keep appliances safe and should service them annually and must use Gas Safe and must check before re-letting and should keep access records and must maintain communal flues in every listed circumstance without distinguishing legal strength.",
      applicability: { jurisdictions: ["England"] },
      attributes: {},
    });
    const hseClaims = [
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
    ];
    const source = {
      id: "s-hse",
      label: "Landlords' duties — HSE",
      url: "https://www.hse.gov.uk/gas/landlords/landlords-duties.htm",
      source_type: "official_guidance",
      created_at: "2026-09-10T00:00:00Z",
      metadata: {},
    };
    const checks = buildTrustChecks(row, { sources: [source], claims: hseClaims });
    expect(checks.find((c) => c.id === "classification")?.status).toBe("passed");
    expect(checks.find((c) => c.id === "trigger")?.status).toBe("passed");

    const card = buildReviewCard({ row, claims: hseClaims, sources: [source], checks });
    expect(card.displayTitle).toBe("Landlord gas-appliance and flue maintenance — England");
    expect(card.answer).toMatch(/must keep/i);
    expect(card.answer).toMatch(/Gas Safe/i);
    expect(card.answer).not.toMatch(/re-lett/i);
    expect(card.facts.map((f) => f.label)).toEqual(["Applies when", "Timing", "Evidence"]);
    expect(card.found.relatedItems).toBe(6);
    expect(card.foundLine).toBe(
      "Filla found six related requirements and recommendations from one authoritative source."
    );
    expect(card.groups.map((g) => g.id)).toEqual([
      "gas_safe",
      "service",
      "relet",
      "access",
      "communal",
      "maintain",
    ]);
    expect(card.decisions[0].label).toBe("Approve Knowledge set");
  });
});
