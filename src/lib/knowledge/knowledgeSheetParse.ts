/**
 * Parse CSV / XLSX into a grid for Knowledge Intake column mapping.
 */

import { readZipEntry } from "@/lib/officeDocumentText";
import {
  headerAliasHit,
  suggestColumnMapping,
} from "@/lib/knowledge/knowledgeColumnMapping";

export type SheetGrid = {
  headers: string[];
  rows: string[][];
  sheetName?: string;
};

/** One tab from an XLSX workbook (or single logical sheet for CSV). */
export type ParsedWorksheet = {
  sheetName: string;
  grid: SheetGrid;
  rowCount: number;
  isDataBearing: boolean;
  isReadme: boolean;
  skippedReason?: string;
  interpretation: SheetInterpretation;
};

export type SpreadsheetWorkbook = {
  kind: "csv" | "xlsx";
  sheets: ParsedWorksheet[];
};

export type SheetRole = "knowledge_data" | "reference_context" | "not_for_knowledge";
export type SheetRecommendation = "include" | "keep_as_context" | "exclude";

export type SheetInterpretation = {
  role: SheetRole;
  recommendation: SheetRecommendation;
  confidence: "high" | "medium" | "low";
  reason: string;
  relatedSheets: string[];
};

export type SheetContextSummary = {
  sheetName: string;
  headers: string[];
  sampleRows: string[][];
  rowCount: number;
  role?: SheetRole;
  recommendation?: SheetRecommendation;
  reason?: string;
};

export type WorkbookSheetManifest = {
  sheetName: string;
  headers: string[];
  sampleRows: string[][];
  rowCount: number;
  columnCount: number;
  relatedSheets: string[];
  supportSignals: {
    isDataBearing: boolean;
    isReadme: boolean;
    heuristicRole: SheetRole;
    heuristicRecommendation: SheetRecommendation;
    heuristicReason: string;
  };
};

export type WorkbookManifest = {
  kind: "csv" | "xlsx";
  sheetCount: number;
  sheets: WorkbookSheetManifest[];
};

export type WorkbookSheetInterpretationResult = {
  sheet_name: string;
  classification: "knowledge_data" | "context" | "exclude";
  confidence: number;
  reason: string;
  row_semantics: string;
  related_sheets: string[];
  should_create_candidates: boolean;
};

export {
  applyColumnMapping,
  suggestColumnMapping,
  suggestColumnMappingDetailed,
  guessColumnMapping,
  analyseColumnMapping,
  mappingSummary,
  suggestionsSummary,
  describeMapping,
  slugifyAttributeKey,
  STANDARD_ATTRIBUTE_KEYS,
  type ColumnMapping,
  type ColumnMappingValue,
  type ColumnMappingSuggestion,
  type ColumnMappingSuggestions,
  type MappingConfidence,
  type MappedKnowledgeDraft,
  type CoreField,
  type ApplicabilityField,
  type ProvenanceField,
} from "@/lib/knowledge/knowledgeColumnMapping";

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function detectCsvDelimiter(headerLine: string): string {
  const candidates = [",", ";", "\t", "|"] as const;
  let best: string = ",";
  let bestCount = -1;
  for (const d of candidates) {
    const count = splitDelimitedLine(headerLine, d).filter((c) => c.length > 0).length;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

export function parseCsvText(text: string): SheetGrid {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const delimiter = detectCsvDelimiter(lines[0]);
  const headers = splitDelimitedLine(lines[0], delimiter).map((h, i) => h || `Column ${i + 1}`);
  const rows = lines.slice(1).map((line) => {
    const cells = splitDelimitedLine(line, delimiter);
    while (cells.length < headers.length) cells.push("");
    return cells.slice(0, headers.length);
  });
  return { headers, rows };
}

/** True when a sheet has a plausible header row and at least one data row. */
export function isWorksheetDataBearing(grid: SheetGrid, sheetName: string): boolean {
  if (isLikelyReadmeSheetName(sheetName)) return false;
  if (grid.headers.length < 2) return false;
  if (scoreHeaderRow(grid.headers) <= 0) return false;
  return grid.rows.some((row) => row.some((cell) => cell.trim().length > 0));
}

function norm(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase();
}

function uniqueFilledCount(values: string[]): number {
  return new Set(values.map((v) => v.trim()).filter(Boolean)).size;
}

function sharedHeaderCount(a: string[], b: string[]): number {
  const aSet = new Set(a.map(norm).filter(Boolean));
  let count = 0;
  for (const header of b) {
    if (aSet.has(norm(header))) count += 1;
  }
  return count;
}

function inferRelatedSheets(current: SheetGrid, allSheets: SheetGrid[]): string[] {
  return allSheets
    .filter((sheet) => sheet.sheetName && sheet.sheetName !== current.sheetName)
    .map((sheet) => ({
      name: sheet.sheetName!,
      overlap: sharedHeaderCount(current.headers, sheet.headers),
    }))
    .filter((sheet) => sheet.overlap >= 1)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3)
    .map((sheet) => sheet.name);
}

function sampleRows(grid: SheetGrid, limit = 3): string[][] {
  return grid.rows
    .filter((row) => row.some((cell) => cell.trim()))
    .slice(0, limit)
    .map((row) => row.map((cell) => cell.trim()).slice(0, Math.min(grid.headers.length, 8)));
}

export function summarizeSheetForContext(
  grid: SheetGrid,
  interpretation?: SheetInterpretation
): SheetContextSummary {
  return {
    sheetName: grid.sheetName ?? "Sheet",
    headers: grid.headers.slice(0, 12),
    sampleRows: sampleRows(grid, 3),
    rowCount: grid.rows.filter((row) => row.some((cell) => cell.trim())).length,
    role: interpretation?.role,
    recommendation: interpretation?.recommendation,
    reason: interpretation?.reason,
  };
}

export function buildWorkbookManifest(workbook: SpreadsheetWorkbook): WorkbookManifest {
  const allGrids = workbook.sheets.map((sheet) => sheet.grid);
  return {
    kind: workbook.kind,
    sheetCount: workbook.sheets.length,
    sheets: workbook.sheets.map((sheet) => {
      const heuristic = interpretWorksheet(sheet.grid, sheet.sheetName, allGrids);
      return {
        sheetName: sheet.sheetName,
        headers: sheet.grid.headers.slice(0, 20),
        sampleRows: sampleRows(sheet.grid, 4),
        rowCount: sheet.rowCount,
        columnCount: sheet.grid.headers.length,
        relatedSheets: inferRelatedSheets(sheet.grid, allGrids),
        supportSignals: {
          isDataBearing: sheet.isDataBearing,
          isReadme: sheet.isReadme,
          heuristicRole: heuristic.role,
          heuristicRecommendation: heuristic.recommendation,
          heuristicReason: heuristic.reason,
        },
      };
    }),
  };
}

export function interpretationFromWorkbookResult(
  ai?: WorkbookSheetInterpretationResult
): SheetInterpretation {
  if (!ai) {
    return {
      role: "reference_context",
      recommendation: "keep_as_context",
      confidence: "low",
      reason: "Workbook interpretation unavailable; defaulted to context for manual review.",
      relatedSheets: [],
    };
  }
  return {
    role:
      ai.classification === "knowledge_data"
        ? "knowledge_data"
        : ai.classification === "context"
          ? "reference_context"
          : "not_for_knowledge",
    recommendation:
      ai.classification === "knowledge_data"
        ? "include"
        : ai.classification === "context"
          ? "keep_as_context"
          : "exclude",
    confidence: ai.confidence >= 0.8 ? "high" : ai.confidence >= 0.55 ? "medium" : "low",
    reason: ai.reason,
    relatedSheets: ai.related_sheets,
  };
}

function flattenSampleText(grid: SheetGrid): string {
  return sampleRows(grid, 4)
    .flat()
    .join(" ")
    .toLowerCase();
}

function countMatches(text: string, re: RegExp): number {
  return [...text.matchAll(re)].length;
}

export function interpretWorksheet(
  grid: SheetGrid,
  sheetName: string,
  allSheets: SheetGrid[] = []
): SheetInterpretation {
  const headers = grid.headers.map(norm).filter(Boolean);
  const rowCount = grid.rows.filter((row) => row.some((cell) => cell.trim().length > 0)).length;
  const headerScore = scoreHeaderRow(grid.headers);
  const relatedSheets = inferRelatedSheets(grid, allSheets);
  const mapping = suggestColumnMapping(grid.headers);
  const usefulMapped = Object.values(mapping).filter((value) => value.dest !== "skip").length;
  const coreMapped = Object.values(mapping).filter((value) => value.dest === "core").length;
  const applicabilityMapped = Object.values(mapping).filter(
    (value) => value.dest === "applicability"
  ).length;
  const lowerName = norm(sheetName);
  const headerText = headers.join(" ");
  const sampleText = flattenSampleText(grid);
  const combinedText = `${lowerName} ${headerText} ${sampleText}`;
  const hasLongNarrativeCell = grid.rows.some((row) =>
    row.some((cell) => cell.trim().split(/\s+/).length >= 8)
  );
  const sampleHasImperativeLanguage = /\b(must|should|ensure|check|inspect|keep|record|install|provide|review|verify|maintain|test|replace|do not)\b/i.test(
    sampleText
  );
  const headerHasKnowledgeIntent = /\b(guidance|requirement|procedure|instruction|evidence|frequency|timing|risk|action|summary|body)\b/i.test(
    headerText
  );
  const sampleHasKnowledgeLikeContent = /\b(requirement|guidance|procedure|evidence|frequency|risk|consequence|responsible|deadline|compliance|document|safety)\b/i.test(
    combinedText
  );

  const readmeLike =
    isLikelyReadmeSheetName(sheetName) ||
    /\b(example|template|legend|glossary|guide|help)\b/i.test(sheetName);
  if (readmeLike || headerScore <= 0 || headers.length === 0 || rowCount === 0) {
    return {
      role: "not_for_knowledge",
      recommendation: "exclude",
      confidence: readmeLike || headers.length === 0 ? "high" : "medium",
      reason: readmeLike
        ? "Looks like instructions or reference text rather than reusable Knowledge rows."
        : "No usable tabular knowledge rows were detected.",
      relatedSheets,
    };
  }

  const referenceByName =
    /\b(reference|lookup|dictionary|taxonomy|mapping|legend|glossary|schema|method|methodology|governance|framework|definition|rollout|matrix|coverage|catalog|catalogue)\b/i.test(
      combinedText
    );
  const headerHintsReference = headers.some((header) =>
    /\b(code|lookup|label|option|value|description|meaning|alias|type|status|phase|owner|notes?)\b/i.test(
      header
    )
  );
  const narrowLookupShape =
    headers.length <= 4 &&
    rowCount <= 50 &&
    coreMapped === 0 &&
    grid.rows.every((row) => {
      const filled = row.map((cell) => cell.trim()).filter(Boolean);
      return filled.length > 0 && filled.length <= Math.min(headers.length, 3);
    });
  const mostlyUniqueColumns = headers.length > 0
    ? grid.headers.every((_, index) => {
        const colValues = grid.rows.map((row) => row[index] ?? "");
        const filled = colValues.map((v) => v.trim()).filter(Boolean);
        return filled.length === 0 || uniqueFilledCount(filled) >= Math.max(1, filled.length - 1);
      })
    : false;
  const questionnaireLike =
    /\b(question|prompt|response type|answer type|input type|placeholder|validation|display order|field type)\b/i.test(
      combinedText
    ) ||
    (/\b(question|prompt)\b/i.test(combinedText) &&
      /\b(required|help text|hint|options?)\b/i.test(combinedText));
  const schemaLike =
    /\b(field|column|property|entity|object|table|datatype|data type|enum|nullable|required|default|relationship|foreign key|json|model)\b/i.test(
      combinedText
    );
  const rolloutMatrixLike =
    applicabilityMapped >= 1 &&
    /\b(status|phase|rollout|launch|owner|priority|tier|market|coverage|readiness)\b/i.test(
      combinedText
    ) &&
    !sampleHasImperativeLanguage &&
    !hasLongNarrativeCell;
  const governanceLike =
    /\b(approval|policy|principle|governance|methodology|scoring|rubric|criteria|workflow|review process|decision)\b/i.test(
      combinedText
    );
  const configLike =
    /\b(config|configuration|setting|toggle|feature flag|api|endpoint|internal id|template id|uuid|slug|key|seed)\b/i.test(
      combinedText
    );
  const lookupReferenceLike =
    referenceByName ||
    (headerHintsReference && narrowLookupShape) ||
    (narrowLookupShape && mostlyUniqueColumns);

  if (questionnaireLike || schemaLike || governanceLike || rolloutMatrixLike || lookupReferenceLike) {
    return {
      role: configLike || questionnaireLike ? "not_for_knowledge" : "reference_context",
      recommendation: configLike || questionnaireLike ? "exclude" : "keep_as_context",
      confidence:
        questionnaireLike || schemaLike || governanceLike || referenceByName ? "high" : "medium",
      reason:
        questionnaireLike
          ? "Looks like intake/questionnaire structure rather than reusable Knowledge rows."
          : schemaLike
            ? "Looks like a schema, model, or field-definition sheet that supports interpretation but should not create row-level Knowledge."
            : governanceLike
              ? "Looks like governance or methodology context that explains how to interpret Knowledge rather than rows of Knowledge itself."
              : rolloutMatrixLike
                ? "Looks like rollout or coverage context across jurisdictions rather than reusable Knowledge objects per row."
                : "Looks like lookup/context data that may help interpret Knowledge sheets but should not create candidates itself.",
      relatedSheets,
    };
  }

  const looksKnowledgeData =
    rowCount >= 1 &&
    usefulMapped >= Math.min(2, headers.length) &&
    coreMapped >= 1 &&
    (
      sampleHasImperativeLanguage ||
      hasLongNarrativeCell ||
      sampleHasKnowledgeLikeContent ||
      (headerHasKnowledgeIntent && coreMapped >= 2)
    ) &&
    !configLike;

  if (looksKnowledgeData) {
    return {
      role: "knowledge_data",
      recommendation: "include",
      confidence:
        sampleHasImperativeLanguage && (applicabilityMapped >= 1 || usefulMapped >= 3)
          ? "high"
          : "medium",
      reason:
        "Rows appear to contain reusable guidance, requirements, or procedures rather than just supporting structure.",
      relatedSheets,
    };
  }

  return {
    role: "reference_context",
    recommendation: "keep_as_context",
    confidence: "low",
    reason:
      "This sheet is structured, but it does not clearly read as reusable Knowledge rows. Defaulting to context is safer than generating candidates.",
    relatedSheets,
  };
}

export async function parseSpreadsheetWorkbook(file: File): Promise<SpreadsheetWorkbook> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv" || file.type === "text/plain") {
    const grid = parseCsvText(await file.text());
    const sheetName = file.name.replace(/\.[^.]+$/i, "") || "CSV";
    const tagged = { ...grid, sheetName };
    return {
      kind: "csv",
      sheets: [
        {
          sheetName,
          grid: tagged,
          rowCount: grid.rows.length,
          isDataBearing: isWorksheetDataBearing(tagged, sheetName),
          isReadme: false,
          interpretation: interpretWorksheet(tagged, sheetName, [tagged]),
        },
      ],
    };
  }

  if (name.endsWith(".xls") && !name.endsWith(".xlsx")) {
    throw new Error("Legacy .xls isn’t supported. Save as .xlsx or CSV and try again.");
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const sheets = await parseXlsxWorkbook(buffer);
    if (sheets.length === 0) {
      throw new Error(
        "Could not read any sheets. Put column headers on a data tab (not README-only), or export CSV."
      );
    }
    return { kind: "xlsx", sheets };
  }

  throw new Error("Unsupported file type. Upload CSV or XLSX.");
}

export async function parseSpreadsheetFile(file: File): Promise<SheetGrid> {
  const workbook = await parseSpreadsheetWorkbook(file);
  const dataSheets = workbook.sheets.filter((s) => s.isDataBearing);
  const pick =
    dataSheets.sort((a, b) => b.rowCount - a.rowCount)[0] ??
    workbook.sheets.find((s) => s.grid.headers.length > 0);
  if (!pick?.grid.headers.length) {
    throw new Error(
      "Could not find a sheet with column titles. Put headers on row 1 of a data sheet (not a README), or export CSV."
    );
  }
  return pick.grid;
}

/** True when a sheet name looks like instructions rather than a data table. */
export function isLikelyReadmeSheetName(name: string | undefined | null): boolean {
  if (!name) return false;
  return /\b(readme|read\s*me|notes|about|intro|instructions?|cover|index|toc|contents)\b/i.test(
    name.trim()
  );
}

/**
 * Score how much a candidate header row looks like column titles.
 * Higher is better; ≤0 means “don’t use this as a table header”.
 */
export function scoreHeaderRow(cells: string[]): number {
  const nonEmpty = cells.map((c) => c.trim()).filter(Boolean);
  if (nonEmpty.length < 2) return -10;

  let score = nonEmpty.length;
  let longCells = 0;
  let aliasHits = 0;
  const seen = new Set<string>();

  for (const cell of nonEmpty) {
    if (cell.length > 80) longCells += 1;
    const key = cell.toLowerCase();
    if (seen.has(key)) score -= 1;
    seen.add(key);
    if (headerAliasHit(cell)) aliasHits += 1;
  }

  // README / prose rows are often one long sentence or a few long blobs.
  if (longCells >= Math.max(1, Math.ceil(nonEmpty.length / 2))) score -= 20;
  if (nonEmpty.length === 1) score -= 15;

  score += aliasHits * 4;
  return score;
}

function gridFromMatrix(
  matrix: string[][],
  sheetName: string
): SheetGrid | null {
  if (matrix.length === 0) return null;

  let bestIdx = 0;
  let bestScore = scoreHeaderRow(matrix[0] ?? []);
  const scanTo = Math.min(matrix.length, 20);
  for (let i = 1; i < scanTo; i += 1) {
    const s = scoreHeaderRow(matrix[i]);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }

  if (bestScore <= 0) return null;

  const headers = (matrix[bestIdx] ?? []).map((h, i) => h.trim() || `Column ${i + 1}`);
  // Drop trailing empty header columns.
  while (headers.length > 1 && /^Column \d+$/.test(headers[headers.length - 1]!)) {
    const last = headers[headers.length - 1]!;
    if (last.startsWith("Column ") && !(matrix[bestIdx]?.[headers.length - 1] ?? "").trim()) {
      headers.pop();
    } else break;
  }

  const rows = matrix.slice(bestIdx + 1).map((row) => {
    const copy = [...row];
    while (copy.length < headers.length) copy.push("");
    return copy.slice(0, headers.length);
  });

  return { headers, rows, sheetName };
}

function matrixFromCells(cells: Map<string, string>): string[][] {
  if (cells.size === 0) return [];
  let maxRow = 0;
  let maxCol = 0;
  for (const key of cells.keys()) {
    const { r, c } = keyToRC(key);
    maxRow = Math.max(maxRow, r);
    maxCol = Math.max(maxCol, c);
  }
  const matrix: string[][] = [];
  for (let r = 1; r <= maxRow; r += 1) {
    const row: string[] = [];
    for (let c = 1; c <= maxCol; c += 1) {
      row.push(cells.get(rcToKey(r, c)) ?? "");
    }
    if (row.some((v) => v.trim())) matrix.push(row);
  }
  return matrix;
}

function scoreSheetCandidate(grid: SheetGrid, sheetName: string): number {
  let score = scoreHeaderRow(grid.headers);
  if (isLikelyReadmeSheetName(sheetName)) score -= 25;
  // Prefer sheets that actually have data rows under the header.
  score += Math.min(grid.rows.length, 50) * 0.1;
  const mapped = suggestColumnMapping(grid.headers);
  const useful = Object.values(mapped).filter((t) => t.dest !== "skip").length;
  score += useful * 3;
  return score;
}

async function parseXlsxWorkbook(buffer: ArrayBuffer): Promise<ParsedWorksheet[]> {
  const bytes = new Uint8Array(buffer);
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    return [];
  }

  const sharedXml = await readZipText(bytes, "xl/sharedStrings.xml");
  const shared = sharedXml ? parseSharedStrings(sharedXml) : [];
  const entries = await listWorksheetEntries(bytes);
  if (entries.length === 0) return [];

  const results: ParsedWorksheet[] = [];

  for (const sheet of entries) {
    const sheetXml = await readZipText(bytes, sheet.path);
    if (!sheetXml) {
      results.push({
        sheetName: sheet.name,
        grid: { headers: [], rows: [], sheetName: sheet.name },
        rowCount: 0,
        isDataBearing: false,
        isReadme: isLikelyReadmeSheetName(sheet.name),
        skippedReason: "Empty sheet",
        interpretation: {
          role: "not_for_knowledge",
          recommendation: "exclude",
          confidence: "high",
          reason: "Empty sheet.",
          relatedSheets: [],
        },
      });
      continue;
    }

    const cells = parseSheetCells(sheetXml, shared);
    const matrix = matrixFromCells(cells);
    const grid = gridFromMatrix(matrix, sheet.name);
    const isReadme = isLikelyReadmeSheetName(sheet.name);

    if (!grid) {
      results.push({
        sheetName: sheet.name,
        grid: { headers: [], rows: [], sheetName: sheet.name },
        rowCount: 0,
        isDataBearing: false,
        isReadme,
        skippedReason: "No tabular header detected",
        interpretation: {
          role: "not_for_knowledge",
          recommendation: "exclude",
          confidence: "high",
          reason: "No usable tabular header was detected.",
          relatedSheets: [],
        },
      });
      continue;
    }

    results.push({
      sheetName: sheet.name,
      grid,
      rowCount: grid.rows.length,
      isDataBearing: isWorksheetDataBearing(grid, sheet.name),
      isReadme,
    });
  }

  const allGrids = results.map((sheet) => sheet.grid);
  return results.map((sheet) => ({
    ...sheet,
    interpretation: interpretWorksheet(sheet.grid, sheet.sheetName, allGrids),
  }));
}

/** @deprecated Use parseXlsxWorkbook — returns highest-scoring data sheet only. */
async function parseXlsxGrid(buffer: ArrayBuffer): Promise<SheetGrid> {
  const sheets = await parseXlsxWorkbook(buffer);
  let best: { grid: SheetGrid; score: number } | null = null;

  for (const sheet of sheets) {
    if (!sheet.grid.headers.length) continue;
    const score = scoreSheetCandidate(sheet.grid, sheet.sheetName);
    if (!best || score > best.score) best = { grid: sheet.grid, score };
  }

  if (!best || best.score <= 0) return { headers: [], rows: [] };
  return best.grid;
}

type WorksheetEntry = { name: string; path: string };

async function listWorksheetEntries(bytes: Uint8Array): Promise<WorksheetEntry[]> {
  const workbook = await readZipText(bytes, "xl/workbook.xml");
  const rels = await readZipText(bytes, "xl/_rels/workbook.xml.rels");
  const entries: WorksheetEntry[] = [];

  if (workbook && rels) {
    const sheetTags = [...workbook.matchAll(/<sheet\b([^>]*)\/?>/gi)];
    for (const tag of sheetTags) {
      const attrs = tag[1] ?? "";
      const name =
        /name="([^"]+)"/i.exec(attrs)?.[1] ??
        /name='([^']+)'/i.exec(attrs)?.[1] ??
        "Sheet";
      const rid =
        /r:id="(rId\d+)"/i.exec(attrs)?.[1] ??
        /r:id='(rId\d+)'/i.exec(attrs)?.[1];
      if (!rid) continue;
      const target = new RegExp(
        `Id="${rid}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${rid}"`,
        "i"
      ).exec(rels);
      const relTarget = target?.[1] || target?.[2];
      if (!relTarget) continue;
      const normalized = relTarget.replace(/^\//, "").replace(/^\.\//, "");
      const path = normalized.startsWith("xl/") ? normalized : `xl/${normalized}`;
      entries.push({ name: decodeXml(name), path });
    }
    if (entries.length > 0) return entries;
  }

  const contentTypes = await readZipText(bytes, "[Content_Types].xml");
  if (contentTypes) {
    const overrides = [
      ...contentTypes.matchAll(/PartName="(\/xl\/worksheets\/sheet[^"]+\.xml)"/gi),
    ].map((m) => m[1].replace(/^\//, ""));
    overrides.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return overrides.map((path, i) => ({ name: `Sheet${i + 1}`, path }));
  }

  for (const path of ["xl/worksheets/sheet1.xml", "xl/worksheets/sheet.xml"]) {
    if (await readZipEntry(bytes, path)) {
      return [{ name: "Sheet1", path }];
    }
  }
  return [];
}

async function readZipText(bytes: Uint8Array, path: string): Promise<string | null> {
  const raw = await readZipEntry(bytes, path);
  if (!raw) return null;
  return new TextDecoder("utf-8").decode(raw);
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const texts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) =>
      decodeXml(x[1])
    );
    out.push(texts.join(""));
  }
  return out;
}

function parseSheetCells(xml: string, shared: string[]): Map<string, string> {
  const map = new Map<string, string>();
  // Match full <c>...</c> so inlineStr / is cells without <v> still parse.
  const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(xml))) {
    const attrs = m[1];
    const inner = m[2];
    const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
    if (!ref) continue;
    const type = /t="([^"]+)"/.exec(attrs)?.[1];
    const rawV = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "";
    let value = "";
    if (type === "s") {
      const idx = Number(rawV);
      value = Number.isFinite(idx) ? (shared[idx] ?? "") : "";
    } else if (type === "inlineStr" || type === "str") {
      const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);
      value = t ? decodeXml(t[1]) : decodeXml(rawV);
    } else if (type === "b") {
      value = rawV === "1" ? "TRUE" : "FALSE";
    } else {
      value = decodeXml(rawV);
    }
    map.set(ref, value);
  }
  return map;
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function colLettersToNum(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function keyToRC(ref: string): { r: number; c: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)!;
  return { c: colLettersToNum(m[1]), r: Number(m[2]) };
}

function rcToKey(r: number, c: number): string {
  let n = c;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return `${letters}${r}`;
}
