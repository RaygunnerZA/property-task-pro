import { describe, expect, it } from "vitest";
import {
  buildCatalogueReviewReport,
  classifyCatalogueHit,
  classifyScottishBuildingStandardsHit,
  detectionFromHitClass,
  ENGLAND_OFFICIAL_CATALOGUE,
  ENGLAND_RECOMMENDED_CATALOGUE_IDS,
  formatMaterialChangeCopy,
  formatPotentialChangeCopy,
  hashRelevantSections,
  queueLaneForCatalogueDetection,
  SCOTLAND_BUILDING_STANDARDS_CATALOGUE,
  SCOTLAND_BUILDING_STANDARDS_PROPOSAL,
  scotlandHandbookAppliesWhen,
  shouldCreateKnowledgeFromDetection,
  shouldFetchCataloguePageBody,
  type CatalogueSearchHit,
} from "@/lib/content/officialSourceCatalogue";
import { parseGovukContentMetadata, parseGovukSearchPayload } from "@/lib/content/govukAdapters";
import { planCataloguePageUpserts } from "@/lib/content/catalogueWatchScan";

function hit(partial: Partial<CatalogueSearchHit> & Pick<CatalogueSearchHit, "title" | "link">): CatalogueSearchHit {
  return partial;
}

describe("England official catalogue seed", () => {
  it("starts with six bounded England families", () => {
    expect(ENGLAND_OFFICIAL_CATALOGUE).toHaveLength(6);
    expect(ENGLAND_RECOMMENDED_CATALOGUE_IDS).toEqual([
      "england-landlord-renting",
      "england-building-regs",
      "england-planning-pd",
      "england-epc-energy",
      "england-hse-property-safety",
      "england-bsr",
    ]);
    for (const section of ENGLAND_OFFICIAL_CATALOGUE) {
      expect(section.jurisdiction).toBe("England");
      expect(section.locator.path_prefixes.length).toBeGreaterThan(0);
      expect(section.include_types.length).toBeGreaterThan(0);
      expect(section.exclude_types.length).toBeGreaterThan(0);
    }
  });
});

describe("Scottish Building Standards catalogue", () => {
  it("is one collection-page section, not a PDF-per-row import", () => {
    expect(SCOTLAND_BUILDING_STANDARDS_CATALOGUE.jurisdiction).toBe("Scotland");
    expect(SCOTLAND_BUILDING_STANDARDS_CATALOGUE.publisher).toBe("gov.scot");
    expect(SCOTLAND_BUILDING_STANDARDS_CATALOGUE.locator.adapter).toBe("collection_page");
    expect(SCOTLAND_BUILDING_STANDARDS_CATALOGUE.locator.collection_url).toContain(
      "building-standards"
    );
    expect(SCOTLAND_BUILDING_STANDARDS_PROPOSAL.recommended_watch_areas.length).toBeGreaterThanOrEqual(
      6
    );
    expect(SCOTLAND_BUILDING_STANDARDS_PROPOSAL.potential_change_note).toMatch(/Potential change/i);
    expect(SCOTLAND_BUILDING_STANDARDS_PROPOSAL.index_note).toMatch(/indexed/i);
  });

  it("classifies handbooks and consultations; indexes superseded editions without queue noise", () => {
    expect(
      classifyScottishBuildingStandardsHit({
        title: "Building standards technical handbook 2026: domestic",
      })
    ).toBe("compliance_guidance");
    expect(
      classifyScottishBuildingStandardsHit({
        title: "Consultation on proposed changes to fire standards",
      })
    ).toBe("news_lead");
    expect(
      classifyScottishBuildingStandardsHit({
        title: "Previous edition — technical handbook 2019 domestic",
      })
    ).toBe("index_only");
    expect(detectionFromHitClass("index_only", false)).toBe("none");
    expect(detectionFromHitClass("news_lead", false)).toBe("potential_change");
  });

  it("encodes warrant-date applicability for the April 2026 edition", () => {
    expect(scotlandHandbookAppliesWhen("2026-04-06")).toEqual({
      jurisdiction: "Scotland",
      building_scope: "domestic",
      edition: "April 2026",
      applies_when: {
        warrant_submitted_on_or_after: "2026-04-06",
        or_unwarranted_work_commenced_on_or_after: "2026-04-06",
      },
    });
  });
});

describe("catalogue hit classifier", () => {
  it("treats transactional and resident-service pages as excluded", () => {
    expect(
      classifyCatalogueHit(
        hit({
          title: "Find an energy certificate",
          link: "/find-energy-certificate",
          document_type: "transaction",
          content_purpose_supergroup: "services",
        })
      )
    ).toBe("excluded");
    expect(
      classifyCatalogueHit(
        hit({
          title: "Apply for housing benefit",
          link: "/housing-benefit",
          document_type: "transaction",
        })
      )
    ).toBe("excluded");
    expect(
      classifyCatalogueHit(
        hit({
          title: "Report an abandoned vehicle",
          link: "/report-abandoned-vehicle",
          document_type: "transaction",
        })
      )
    ).toBe("excluded");
  });

  it("classifies landlord and building-regs guides as relevant or compliance", () => {
    expect(
      classifyCatalogueHit(
        hit({
          title: "Being a landlord",
          description: "Legal duties when you rent out a property",
          link: "/renting-out-a-property",
          document_type: "guide",
          content_purpose_supergroup: "guidance",
        })
      )
    ).toBe("compliance_guidance");
    expect(
      classifyCatalogueHit(
        hit({
          title: "Energy performance certificates",
          description: "What an EPC tells you about a property",
          link: "/buy-sell-your-home/energy-performance-certificates",
          document_type: "guide",
        })
      )
    ).toMatch(/compliance_guidance|property_relevant/);
  });

  it("labels news and consultations as news leads, not regulatory updates", () => {
    expect(
      classifyCatalogueHit(
        hit({
          title: "Proposed changes to private-renting safety standards",
          description: "MHCLG consultation on landlord duties",
          link: "/government/news/private-renting-safety",
          document_type: "news_article",
          content_purpose_supergroup: "news_and_communications",
        })
      )
    ).toBe("news_lead");
  });
});

describe("catalogue review report", () => {
  it("samples a large housing seed without treating it as a queue", () => {
    const hits: CatalogueSearchHit[] = [
      hit({
        title: "Being a landlord",
        description: "Legal duties when you rent out a property",
        link: "/renting-out-a-property",
        document_type: "guide",
      }),
      hit({
        title: "Building regulations",
        description: "Approved documents you must follow",
        link: "/building-regulations",
        document_type: "guide",
      }),
      hit({
        title: "Planning permission",
        link: "/planning-permission-england-wales",
        document_type: "guide",
      }),
      hit({
        title: "Energy performance certificates",
        link: "/buy-sell-your-home/energy-performance-certificates",
        document_type: "guide",
      }),
      hit({
        title: "Building safety as an accountable person",
        description: "Legal duties for higher-risk buildings",
        link: "/guidance/manage-a-building-as-an-accountable-person",
        document_type: "statutory_guidance",
      }),
      hit({
        title: "Find an energy certificate",
        link: "/find-energy-certificate",
        document_type: "transaction",
        content_purpose_supergroup: "services",
      }),
      hit({
        title: "Apply for council housing",
        link: "/council-housing",
        document_type: "transaction",
      }),
      hit({
        title: "MHCLG announces private-renting proposals",
        description: "Consultation on landlord safety duties",
        link: "/government/news/renting",
        document_type: "news_article",
      }),
    ];

    const report = buildCatalogueReviewReport({ hits, totalFound: 447 });
    expect(report.total_found).toBe(447);
    expect(report.relevant_count).toBeGreaterThan(0);
    expect(report.compliance_guidance_count).toBeGreaterThan(0);
    expect(report.excluded_count).toBeGreaterThan(0);
    expect(report.news_lead_count).toBe(1);
    expect(report.recommended_watch_areas.length).toBeGreaterThan(0);
    expect(report.note.toLowerCase()).toContain("not a source");
    expect(report.note.toLowerCase()).toContain("not the queue");
  });
});

describe("detection and queue lanes", () => {
  it("keeps news and new pages in Monitoring", () => {
    expect(
      queueLaneForCatalogueDetection({
        kind: "potential_change",
        affectedKnowledgeIds: [],
      })
    ).toBe("monitoring");
    expect(
      queueLaneForCatalogueDetection({
        kind: "new_guidance",
        affectedKnowledgeIds: [],
      })
    ).toBe("monitoring");
  });

  it("sends material source changes to Needs attention", () => {
    expect(
      queueLaneForCatalogueDetection({
        kind: "guidance_changed",
        affectedKnowledgeIds: ["k1", "k2"],
      })
    ).toBe("attention");
    expect(formatMaterialChangeCopy({ affectedClaimCount: 2 })).toBe(
      "Official guidance changed in a way that may alter 2 accepted claims."
    );
  });

  it("never creates Knowledge from catalogue detections", () => {
    expect(shouldCreateKnowledgeFromDetection("potential_change")).toBe(false);
    expect(shouldCreateKnowledgeFromDetection("new_guidance")).toBe(false);
    expect(shouldCreateKnowledgeFromDetection("guidance_changed")).toBe(false);
    expect(detectionFromHitClass("news_lead", false)).toBe("potential_change");
    expect(detectionFromHitClass("compliance_guidance", false)).toBe("new_guidance");
  });

  it("writes Potential change copy that does not treat news as proof", () => {
    const copy = formatPotentialChangeCopy({
      title: "private-renting safety standards",
      announcedOn: "22 September",
      relatedKnowledge: ["smoke alarms", "electrical inspections"],
    });
    expect(copy.headline).toContain("Potential change");
    expect(copy.body).toContain("No enacted legislation");
    expect(copy.body).toContain("Current guidance remains valid");
    expect(copy.action).toContain("monitor");
  });
});

describe("freshness — skip unchanged bodies", () => {
  it("does not fetch a brand-new page body during metadata discovery", () => {
    expect(
      shouldFetchCataloguePageBody({
        previous: null,
        next: { content_id: "abc", public_updated_at: "2026-09-22T00:00:00Z" },
      })
    ).toBe(false);
  });

  it("fetches only when content id or public_updated_at changes", () => {
    const previous = {
      content_id: "abc",
      public_updated_at: "2026-01-01T00:00:00Z",
      section_hash: "deadbeef",
    };
    expect(
      shouldFetchCataloguePageBody({
        previous,
        next: { content_id: "abc", public_updated_at: "2026-01-01T00:00:00Z" },
      })
    ).toBe(false);
    expect(
      shouldFetchCataloguePageBody({
        previous,
        next: { content_id: "abc", public_updated_at: "2026-09-22T00:00:00Z" },
      })
    ).toBe(true);
    expect(hashRelevantSections("same")).toBe(hashRelevantSections("same"));
    expect(hashRelevantSections("same")).not.toBe(hashRelevantSections("changed"));
  });
});

describe("GOV.UK adapters", () => {
  it("parses Search API payloads and ignores empty rows", () => {
    const parsed = parseGovukSearchPayload({
      total: 447,
      start: 0,
      results: [
        {
          title: "Being a landlord",
          link: "/renting-out-a-property",
          content_id: "cid-1",
          document_type: "guide",
          organisations: [{ slug: "mhclg" }],
        },
        { title: "", link: "" },
      ],
    });
    expect(parsed.total).toBe(447);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0]?.content_id).toBe("cid-1");
  });

  it("plans new official guidance as assessing/Monitoring and news as potential_change", () => {
    const section = ENGLAND_OFFICIAL_CATALOGUE[0]!;
    const planned = planCataloguePageUpserts({
      section,
      existing: [],
      hits: [
        hit({
          title: "Being a landlord",
          description: "Legal duties when you rent out a property",
          link: "/renting-out-a-property",
          document_type: "guide",
          content_id: "cid-1",
        }),
        hit({
          title: "Proposed landlord safety changes",
          description: "Consultation on private-renting duties",
          link: "/government/news/landlord-safety",
          document_type: "news_article",
        }),
        hit({
          title: "Find an energy certificate",
          link: "/find-energy-certificate",
          document_type: "transaction",
        }),
      ],
    });
    const guidance = planned.upserts.find((u) => u.canonical_path === "/renting-out-a-property");
    const news = planned.upserts.find((u) => u.canonical_path === "/government/news/landlord-safety");
    expect(guidance?.detection).toBe("none"); // seed path already tracked
    expect(news?.detection).toBe("potential_change");
    expect(news?.queue_lane).toBe("monitoring");
    expect(planned.upserts.every((u) => u.canonical_path !== "/find-energy-certificate")).toBe(true);
  });

  it("reads Content API metadata including withdrawn notices", () => {
    const meta = parseGovukContentMetadata("/renting-out-a-property", {
      content_id: "cid-1",
      public_updated_at: "2026-09-01T00:00:00Z",
      document_type: "guide",
      title: "Being a landlord",
      base_path: "/renting-out-a-property",
      withdrawn_notice: { withdrawn_at: "2026-09-20T00:00:00Z" },
    });
    expect(meta.withdrawn).toBe(true);
    expect(meta.content_id).toBe("cid-1");
  });
});
