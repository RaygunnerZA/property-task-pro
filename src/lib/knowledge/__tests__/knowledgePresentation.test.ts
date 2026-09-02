import { describe, expect, it } from "vitest";
import {
  applyColumnMapping,
  isRowNumberOrCellRef,
  isValidHttpUrlValue,
  suggestColumnMapping,
} from "@/lib/knowledge/knowledgeColumnMapping";
import {
  blockingChecksForPublish,
  blockingChecksForVerify,
  buildTrustChecks,
  canPublish,
  canVerify,
  computeSourceHealth,
  deriveOpportunities,
  displayKnowledgeGuidance,
  displayKnowledgeTitle,
  isMeaningfulGuidanceText,
  isPublicationReady,
  looksLikeRowNumberOrCellRef,
  queueCardPreview,
} from "@/lib/knowledge/knowledgePresentation";
import type { KnowledgeRow } from "@/types/knowledge";

function baseRow(overrides: Partial<KnowledgeRow> = {}): KnowledgeRow {
  return {
    id: "k1",
    scope: "platform",
    status: "candidate",
    org_id: null,
    title: "PM-UK-TREE-001",
    summary: null,
    body: null,
    content: {},
    attributes: {
      action:
        "Check protection status and obtain consent before pruning, felling or damaging roots",
      applies_when: "Before pruning or felling a protected tree",
      category: "Trees",
      legal_status: "Mandatory when triggered",
      evidence: "Consent or notice",
      local_variation: "Local planning authority lookup required",
      frequency: null as unknown as string,
    },
    source_kind: "filla_curated",
    trust_score: 0.4,
    provenance: {},
    cohort_size: null,
    version: 1,
    supersedes_id: null,
    created_by: null,
    reviewed_by: null,
    published_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    applicability: {
      jurisdictions: ["United Kingdom"],
      regions: [],
      languages: ["en"],
      audiences: ["manager"],
    },
    ...overrides,
  };
}

const govSource = {
  id: "s1",
  label: "Untitled spreadsheet.xlsx",
  url: "https://www.gov.uk/guidance/tree-preservation-orders-and-trees-in-conservation-areas",
  source_type: "attachment",
  created_at: new Date().toISOString(),
  metadata: { reviewed_date: "2026-07-27" },
};

describe("knowledgePresentation gates", () => {
  it("rejects row numbers as guidance", () => {
    expect(looksLikeRowNumberOrCellRef("1087")).toBe(true);
    expect(isMeaningfulGuidanceText("1087")).toBe(false);
    expect(
      displayKnowledgeGuidance(
        baseRow({ summary: "1087", body: "1058", attributes: {} })
      )
    ).toBe("No guidance written yet.");
  });

  it("blocks verification when guidance is missing", () => {
    const row = baseRow({ attributes: {}, summary: null, body: null });
    const checks = buildTrustChecks(row, { sources: [govSource] });
    expect(checks.find((c) => c.id === "guidance")?.status).toBe("incomplete");
    expect(canVerify(row, checks)).toBe(false);
  });

  it("blocks verification when source is missing", () => {
    const row = baseRow({
      summary: "Protected trees need consent before works.",
      provenance: { critic_at: new Date().toISOString(), critic_passed: true },
      applicability: {
        jurisdictions: ["GB-ENG"],
        regions: [],
        languages: ["en"],
        audiences: ["manager"],
      },
    });
    const checks = buildTrustChecks(row, { sources: [] });
    expect(checks.find((c) => c.id === "source_authority")?.status).toBe("incomplete");
    expect(blockingChecksForVerify(checks).some((c) => c.id === "source_authority")).toBe(
      true
    );
  });

  it("marks contradiction as not_run when critic unavailable", () => {
    const row = baseRow({
      summary: "Protected trees need consent before works.",
      provenance: {
        critic_at: new Date().toISOString(),
        critic_notes: "Critic unavailable; default trust retained.",
        critic_status: "unavailable",
      },
      applicability: {
        jurisdictions: ["GB-ENG"],
        regions: [],
        languages: ["en"],
        audiences: ["manager"],
      },
    });
    const checks = buildTrustChecks(row, { sources: [govSource] });
    const contradiction = checks.find((c) => c.id === "contradiction");
    expect(contradiction?.status).toBe("not_run");
    expect(contradiction?.detail).toMatch(/Run the critic/i);
  });

  it("does not treat legacy praise-only critic notes as passed", () => {
    const row = baseRow({
      summary: "Owners must maintain private sanitation and allow SPANC inspection.",
      trust_score: 0.9,
      provenance: {
        critic_at: new Date().toISOString(),
        critic_notes:
          "The draft knowledge provides specific and factual information. The provenance indicates that the information is derived from a reliable source, enhancing its credibility. Overall, the claims are supportable and well-structured.",
      },
      applicability: {
        jurisdictions: ["FR"],
        regions: [],
        languages: ["fr"],
        audiences: ["owner"],
      },
      attributes: {
        action: "Maintain installation",
        local_variation: "Local SPANC authority lookup required",
      },
    });
    const checks = buildTrustChecks(row, {
      sources: [
        {
          id: "s2",
          label: "Assainissement",
          url: "https://www.service-public.fr/particuliers/vosdroits/F447",
          source_type: "url",
          created_at: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    expect(checks.find((c) => c.id === "contradiction")?.status).toBe("not_run");
    expect(canVerify(row, checks)).toBe(false);
  });

  it("blocks verification when UK nation subdivision is missing", () => {
    const row = baseRow({
      summary: "Protected trees need consent before works.",
      provenance: { critic_at: new Date().toISOString(), critic_passed: true },
    });
    const checks = buildTrustChecks(row, { sources: [govSource] });
    expect(checks.find((c) => c.id === "applicability")?.status).toBe("incomplete");
    expect(checks.find((c) => c.id === "applicability")?.detail).toMatch(/UK nation/i);
  });

  it("blocks publication unless verified and publication-ready", () => {
    const candidate = baseRow({ status: "candidate" });
    const checks = buildTrustChecks(candidate, { sources: [govSource] });
    expect(canPublish(candidate, checks)).toBe(false);

    const verifiedIncomplete = baseRow({
      status: "verified",
      reviewed_by: "user-1",
      summary: "Protected trees need consent before works.",
      provenance: { critic_at: new Date().toISOString(), critic_passed: true },
      applicability: {
        jurisdictions: ["GB-ENG"],
        regions: [],
        languages: ["en"],
        audiences: ["manager"],
      },
    });
    // Missing source → cannot publish
    expect(canPublish(verifiedIncomplete, buildTrustChecks(verifiedIncomplete, { sources: [] }))).toBe(
      false
    );

    const noHuman = baseRow({
      status: "verified",
      reviewed_by: null,
      summary: "Protected trees need consent before works.",
      provenance: { critic_at: new Date().toISOString(), critic_passed: true },
      applicability: {
        jurisdictions: ["GB-ENG"],
        regions: [],
        languages: ["en"],
        audiences: ["manager"],
      },
      attributes: {
        action: "Obtain consent before works",
        applies_when: "Before pruning",
        legal_status: "Mandatory",
        local_variation: "Check local authority",
      },
    });
    expect(
      blockingChecksForPublish(buildTrustChecks(noHuman, { sources: [govSource] })).some(
        (c) => c.id === "human"
      )
    ).toBe(true);
  });

  it("allows FR SPANC when local lookup is documented", () => {
    const row = baseRow({
      title: "Private sanitation compliance / SPANC",
      summary:
        "In France, owners of private sanitation systems must keep the installation maintained and allow SPANC inspections, then complete any remediation required by the local authority within the stated deadlines.",
      applicability: {
        jurisdictions: ["FR"],
        regions: [],
        languages: ["fr"],
        audiences: ["owner"],
      },
      attributes: {
        action: "Maintain installation and respond to SPANC reports",
        applies_when: "Private sanitation systems in France",
        legal_status: "Mandatory",
        trigger_type: "continuous",
        frequency: "Ongoing maintenance",
        local_variation: "Local SPANC authority sets inspection and remediation deadlines",
        evidence: "SPANC report",
      },
      provenance: { critic_at: new Date().toISOString(), critic_passed: true },
    });
    const checks = buildTrustChecks(row, {
      sources: [
        {
          id: "s2",
          label: "Assainissement non collectif",
          url: "https://www.service-public.fr/particuliers/vosdroits/F447",
          source_type: "url",
          created_at: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    expect(checks.find((c) => c.id === "applicability")?.status).toBe("passed");
    expect(canVerify(row, checks)).toBe(true);
  });

  it("moves a fully ready verified item into Ready to publish", () => {
    const row = baseRow({
      status: "verified",
      reviewed_by: "user-1",
      title: "Private sanitation compliance / SPANC",
      summary:
        "In France, owners of private sanitation systems must keep the installation maintained and allow SPANC inspections, then complete any remediation required by the local authority within the stated deadlines.",
      applicability: {
        jurisdictions: ["FR"],
        regions: [],
        languages: ["fr"],
        audiences: ["owner"],
      },
      attributes: {
        action: "Maintain installation",
        applies_when: "Private sanitation",
        legal_status: "Mandatory",
        trigger_type: "continuous",
        frequency: "Ongoing maintenance",
        local_variation: "Local SPANC authority lookup required",
        evidence: "SPANC report",
      },
      provenance: { critic_at: new Date().toISOString(), critic_passed: true },
    });
    const checks = buildTrustChecks(row, {
      sources: [
        {
          id: "s2",
          label: "Assainissement non collectif",
          url: "https://www.service-public.fr/particuliers/vosdroits/F447",
          source_type: "url",
          created_at: new Date().toISOString(),
          metadata: { reviewed_date: "2026-07-01" },
        },
      ],
    });
    expect(isPublicationReady(row, checks)).toBe(true);
  });

  it("source counts agree across list and detail health", () => {
    const row = baseRow({ title: "Consent or notice before work to protected trees" });
    const health = computeSourceHealth([govSource], row);
    const preview = queueCardPreview(row, [govSource]);
    expect(health.authoritative.length).toBe(1);
    expect(preview.authoritativeSources.length).toBe(1);
    expect(preview.sourcesLine).not.toMatch(/Untitled spreadsheet/i);
    expect(health.authoritative[0]?.publisher).toMatch(/GOV\.UK/i);
  });

  it("event-driven Knowledge does not suggest an annual task", () => {
    const ops = deriveOpportunities(
      baseRow({
        title: "Consent or notice before work to protected trees",
        attributes: {
          action: "Obtain consent",
          applies_when: "Before pruning or felling",
          legal_status: "Mandatory",
          evidence: "Consent notice",
          local_variation: "Local planning authority lookup",
        },
      })
    );
    expect(ops.some((o) => /annual/i.test(o.label))).toBe(false);
    expect(ops.some((o) => /pre-work|consent|lookup|homeowner/i.test(o.label))).toBe(true);
  });

  it("uses attribute action as guidance for TREE / OIL codes", () => {
    // Code-like titles fall back to category / action for display
    expect(displayKnowledgeTitle(baseRow())).toBe("Trees");
    expect(displayKnowledgeGuidance(baseRow())).toMatch(/consent/i);

    const oil = baseRow({
      title: "PM-UK-OIL-001",
      attributes: {
        action: "Ensure oil storage complies with applicable regulations",
      },
    });
    expect(displayKnowledgeGuidance(oil)).toMatch(/oil storage/i);
  });
});

describe("spreadsheet import mapping", () => {
  it("does not map row numbers into guidance or source URL", () => {
    expect(isRowNumberOrCellRef("1087")).toBe(true);
    expect(isValidHttpUrlValue("1058")).toBe(false);
    expect(
      isValidHttpUrlValue(
        "https://www.gov.uk/guidance/tree-preservation-orders-and-trees-in-conservation-areas"
      )
    ).toBe(true);

    const headers = [
      "Requirement ID",
      "Title",
      "Guidance",
      "Official Source URL",
      "Country",
    ];
    const mapping = suggestColumnMapping(headers);
    const drafts = applyColumnMapping(
      {
        headers,
        rows: [
          ["PM-UK-TREE-001", "Protected tree work", "1087", "1058", "GB-ENG"],
          [
            "FR-SEPTIC-001",
            "Private sanitation compliance / SPANC",
            "Maintain and allow SPANC inspection",
            "https://www.service-public.fr/particuliers/vosdroits/F447",
            "FR",
          ],
          [
            "FR-WATER-001",
            "Rainwater network separation and controls",
            "Keep complete separation from potable network",
            "https://www.service-public.fr/particuliers/vosdroits/F31481",
            "FR",
          ],
          [
            "PM-UK-OIL-001",
            "Oil storage compliance",
            "1058",
            "https://www.gov.uk/guidance/storing-oil-at-home",
            "GB-ENG",
          ],
        ],
      },
      mapping
    );

    const tree = drafts.find((d) => d.title.includes("TREE") || d.title.includes("Protected"));
    const septic = drafts.find((d) => d.title.includes("SPANC") || d.title.includes("sanitation"));
    const water = drafts.find((d) => d.title.includes("Rainwater"));
    const oil = drafts.find((d) => d.title.includes("OIL") || d.title.includes("Oil"));

    expect(tree?.body).toBe("");
    expect(tree?.provenance.source_url).toBeUndefined();
    expect(septic?.summary || septic?.body).toMatch(/SPANC/i);
    expect(septic?.provenance.source_url).toMatch(/service-public\.fr/);
    expect(water?.provenance.source_url).toMatch(/F31481/);
    expect(oil?.body).toBe("");
    expect(oil?.provenance.source_url).toMatch(/gov\.uk/);
  });
});
