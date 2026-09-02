import { describe, expect, it } from "vitest";
import {
  parseCsvText,
  suggestColumnMapping,
  applyColumnMapping,
  isLikelyReadmeSheetName,
  scoreHeaderRow,
  mappingSummary,
  analyseColumnMapping,
  suggestColumnMappingDetailed,
  buildWorkbookManifest,
  interpretWorksheet,
  isWorksheetDataBearing,
  interpretationFromWorkbookResult,
} from "@/lib/knowledge/knowledgeSheetParse";
import { guessColumnMapping } from "@/lib/knowledge/knowledgeColumnMapping";

describe("knowledgeSheetParse", () => {
  it("parses comma CSV with headers", () => {
    const grid = parseCsvText("Title,Summary,Jurisdiction\nBoiler,Service,GB-ENG\n");
    expect(grid.headers).toEqual(["Title", "Summary", "Jurisdiction"]);
    expect(grid.rows).toEqual([["Boiler", "Service", "GB-ENG"]]);
  });

  it("detects semicolon-delimited European CSV", () => {
    const grid = parseCsvText("Title;Body;Jurisdiction\nLeak;Fix pipe;IE\n");
    expect(grid.headers).toEqual(["Title", "Body", "Jurisdiction"]);
    expect(grid.rows[0]).toEqual(["Leak", "Fix pipe", "IE"]);
  });

  it("maps title/jurisdiction aliases and builds drafts", () => {
    const grid = parseCsvText("Topic,Guidance,Country\nFire door,Check seals,GB-ENG\n");
    const mapping = suggestColumnMapping(grid.headers);
    expect(mapping.Topic).toEqual({ dest: "core", field: "title" });
    expect(mapping.Guidance).toEqual({ dest: "core", field: "body" });
    expect(mapping.Country).toEqual({ dest: "applicability", field: "jurisdictions" });
    const drafts = applyColumnMapping(grid, mapping);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].title).toBe("Fire door");
    expect(drafts[0].applicability.jurisdictions).toEqual(["GB-ENG"]);
  });

  it("maps Evidence to retain → evidence (not requirement_id via id substring)", () => {
    expect(guessColumnMapping("Evidence to retain")).toEqual({
      dest: "attribute",
      key: "evidence",
    });
    expect(analyseColumnMapping("Evidence to retain").ambiguous).toBe(false);
    expect(analyseColumnMapping("Evidence to retain").confidence).toBe("high");
  });

  it("defaults unknown columns to attributes, not skip", () => {
    const headers = [
      "Title",
      "Requirement ID",
      "Local variation",
      "Owner action",
      "App logic notes",
      "Official source URL",
      "Last reviewed",
      "Junk column xyz",
    ];
    const mapping = suggestColumnMapping(headers);
    expect(mapping["Title"]).toEqual({ dest: "core", field: "title" });
    expect(mapping["Requirement ID"]).toEqual({ dest: "attribute", key: "requirement_id" });
    expect(mapping["Local variation"]).toEqual({ dest: "attribute", key: "local_variation" });
    expect(mapping["Owner action"]).toEqual({ dest: "attribute", key: "action" });
    expect(mapping["App logic notes"]).toEqual({ dest: "attribute", key: "app_logic" });
    expect(mapping["Official source URL"]).toEqual({ dest: "provenance", field: "source_url" });
    expect(mapping["Last reviewed"]).toEqual({ dest: "provenance", field: "reviewed_date" });
    expect(mapping["Junk column xyz"].dest).toBe("attribute");
    expect(mapping["Junk column xyz"]).toMatchObject({ key: "junk_column_xyz" });
    expect(mappingSummary(mapping).skip).toBe(0);

    const detailed = suggestColumnMappingDetailed(headers);
    expect(detailed["Junk column xyz"].confidence).toBe("medium");
    expect(detailed["Junk column xyz"].ambiguous).toBe(false);
  });

  it("flags weak/ambiguous mappings for review", () => {
    // Bare "ID" is only a short token match → review
    const idOnly = analyseColumnMapping("ID");
    expect(idOnly.value).toEqual({ dest: "attribute", key: "requirement_id" });
    expect(idOnly.ambiguous || idOnly.confidence !== "high").toBe(true);
  });

  it("never maps App logic notes to body", () => {
    expect(guessColumnMapping("App logic notes")).toEqual({
      dest: "attribute",
      key: "app_logic",
    });
    expect(guessColumnMapping("Notes")).toMatchObject({ dest: "attribute" });
  });

  it("preserves attributes on apply", () => {
    const grid = parseCsvText(
      "Title,Owner action,App logic notes,Evidence to retain,Jurisdiction\nGas,Book engineer,Cron weekly,Certificate,GB-ENG\n"
    );
    const mapping = suggestColumnMapping(grid.headers);
    const drafts = applyColumnMapping(grid, mapping);
    expect(drafts[0].attributes).toEqual({
      action: "Book engineer",
      app_logic: "Cron weekly",
      evidence: "Certificate",
    });
    expect(drafts[0].summary).toBe("Book engineer");
    expect(drafts[0].body).toBe("");
    expect(drafts[0].provenance.guidance_draft?.source).toBe("imported_action");
  });

  it("recognises README sheet names", () => {
    expect(isLikelyReadmeSheetName("README")).toBe(true);
    expect(isLikelyReadmeSheetName("Read me")).toBe(true);
    expect(isLikelyReadmeSheetName("Instructions")).toBe(true);
    expect(isLikelyReadmeSheetName("Knowledge")).toBe(false);
  });

  it("scores tabular headers above prose README rows", () => {
    const table = scoreHeaderRow(["Title", "Summary", "Jurisdiction"]);
    const prose = scoreHeaderRow([
      "This workbook explains how to fill the Knowledge sheet. Please read carefully before editing.",
    ]);
    expect(table).toBeGreaterThan(0);
    expect(table).toBeGreaterThan(prose);
  });

  it("classifies data-bearing worksheets", () => {
    const grid = parseCsvText("Title,Summary,Jurisdiction\nBoiler,Service,GB-ENG\n");
    expect(isWorksheetDataBearing(grid, "Knowledge")).toBe(true);
    expect(isWorksheetDataBearing({ headers: [], rows: [] }, "README")).toBe(false);
    expect(isWorksheetDataBearing(grid, "README")).toBe(false);
  });

  it("interprets knowledge sheets as includable", () => {
    const grid = parseCsvText("Title,Guidance,Jurisdiction\nBoiler,Service annually,GB-ENG\n");
    const interpretation = interpretWorksheet(grid, "Knowledge");
    expect(interpretation.role).toBe("knowledge_data");
    expect(interpretation.recommendation).toBe("include");
  });

  it("interprets lookup sheets as context", () => {
    const grid = parseCsvText("Code,Label,Description\nENG,England,England and Wales\nIE,Ireland,Republic of Ireland\n");
    const interpretation = interpretWorksheet(grid, "Jurisdiction Lookup");
    expect(interpretation.role).toBe("reference_context");
    expect(interpretation.recommendation).toBe("keep_as_context");
  });

  it("keeps rollout matrices as context rather than knowledge rows", () => {
    const grid = parseCsvText(
      "Country,Rollout Status,Owner,Phase\nGB,Live,Ana,1\nIE,Planned,Ben,2\n"
    );
    const interpretation = interpretWorksheet(grid, "Country coverage");
    expect(interpretation.role).toBe("reference_context");
    expect(interpretation.recommendation).toBe("keep_as_context");
  });

  it("excludes questionnaire structures", () => {
    const grid = parseCsvText(
      "Question,Answer Type,Required,Help Text\nGas safety certificate?,select,yes,Choose yes if available\n"
    );
    const interpretation = interpretWorksheet(grid, "Customer intake");
    expect(interpretation.role).toBe("not_for_knowledge");
    expect(interpretation.recommendation).toBe("exclude");
  });

  it("excludes schema-like data models", () => {
    const grid = parseCsvText(
      "Field Name,Data Type,Required,Description\nstatus,text,yes,Current workflow status\n"
    );
    const interpretation = interpretWorksheet(grid, "Data model");
    expect(interpretation.role).toBe("reference_context");
    expect(interpretation.recommendation).toBe("keep_as_context");
  });

  it("defaults low-confidence tabular sheets to context", () => {
    const grid = parseCsvText("Market,Owner,Priority\nUK,Ana,High\nIE,Ben,Low\n");
    const interpretation = interpretWorksheet(grid, "Planning");
    expect(interpretation.recommendation).toBe("keep_as_context");
    expect(interpretation.confidence).toBe("low");
  });

  it("interprets readme sheets as excluded", () => {
    const interpretation = interpretWorksheet(
      { headers: ["Please read before editing this workbook"], rows: [], sheetName: "README" },
      "README"
    );
    expect(interpretation.role).toBe("not_for_knowledge");
    expect(interpretation.recommendation).toBe("exclude");
  });

  it("maps workbook interpretation contract into sheet recommendations", () => {
    expect(
      interpretationFromWorkbookResult({
        sheet_name: "01_LEGAL_COMPLIANCE",
        classification: "knowledge_data",
        confidence: 0.92,
        reason: "Rows describe reusable legal obligations.",
        row_semantics: "One compliance requirement per row",
        related_sheets: ["03_COUNTRY_ROLLOUT"],
        should_create_candidates: true,
      })
    ).toEqual({
      role: "knowledge_data",
      recommendation: "include",
      confidence: "high",
      reason: "Rows describe reusable legal obligations.",
      relatedSheets: ["03_COUNTRY_ROLLOUT"],
    });

    expect(
      interpretationFromWorkbookResult({
        sheet_name: "00_READ_ME",
        classification: "context",
        confidence: 0.44,
        reason: "Workbook instructions and framing.",
        row_semantics: "Instructional rows",
        related_sheets: ["01_LEGAL_COMPLIANCE"],
        should_create_candidates: false,
      }).recommendation
    ).toBe("keep_as_context");

    expect(interpretationFromWorkbookResult(undefined).recommendation).toBe("keep_as_context");
  });

  it("builds a multi-sheet workbook manifest for AI interpretation", () => {
    const manifest = buildWorkbookManifest({
      kind: "xlsx",
      sheets: [
        {
          sheetName: "00_READ_ME",
          grid: parseCsvText("Section,Notes\nPurpose,How to use this workbook\n"),
          rowCount: 1,
          isDataBearing: true,
          isReadme: true,
          interpretation: interpretWorksheet(
            parseCsvText("Section,Notes\nPurpose,How to use this workbook\n"),
            "00_READ_ME"
          ),
        },
        {
          sheetName: "01_LEGAL_COMPLIANCE",
          grid: parseCsvText(
            "Title,Guidance,Jurisdiction\nGas safety certificate,Landlords must renew annually,GB-ENG\n"
          ),
          rowCount: 1,
          isDataBearing: true,
          isReadme: false,
          interpretation: interpretWorksheet(
            parseCsvText(
              "Title,Guidance,Jurisdiction\nGas safety certificate,Landlords must renew annually,GB-ENG\n"
            ),
            "01_LEGAL_COMPLIANCE"
          ),
        },
        {
          sheetName: "05_APP_DATA_MODEL",
          grid: parseCsvText(
            "Field Name,Data Type,Description\nstatus,text,Workflow state\n"
          ),
          rowCount: 1,
          isDataBearing: true,
          isReadme: false,
          interpretation: interpretWorksheet(
            parseCsvText("Field Name,Data Type,Description\nstatus,text,Workflow state\n"),
            "05_APP_DATA_MODEL"
          ),
        },
        {
          sheetName: "07_RESEARCH_GOVERNANCE",
          grid: parseCsvText(
            "Principle,Description\nEvidence quality,How research findings should be assessed\n"
          ),
          rowCount: 1,
          isDataBearing: true,
          isReadme: false,
          interpretation: interpretWorksheet(
            parseCsvText(
              "Principle,Description\nEvidence quality,How research findings should be assessed\n"
            ),
            "07_RESEARCH_GOVERNANCE"
          ),
        },
      ],
    });

    expect(manifest.sheetCount).toBe(4);
    expect(manifest.sheets.map((sheet) => sheet.sheetName)).toEqual([
      "00_READ_ME",
      "01_LEGAL_COMPLIANCE",
      "05_APP_DATA_MODEL",
      "07_RESEARCH_GOVERNANCE",
    ]);
    expect(manifest.sheets[1]?.sampleRows[0]).toEqual([
      "Gas safety certificate",
      "Landlords must renew annually",
      "GB-ENG",
    ]);
    expect(manifest.sheets[2]?.supportSignals.heuristicRecommendation).toBe("keep_as_context");
  });
});
