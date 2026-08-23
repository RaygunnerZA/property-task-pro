/**
 * Parse CSV / XLSX into a grid for Knowledge Intake column mapping.
 */

import { extractOfficePlainText } from "@/lib/officeDocumentText";
import type { KnowledgeApplicability } from "@/types/knowledge";

export type SheetGrid = {
  headers: string[];
  rows: string[][];
  sheetName?: string;
};

export type KnowledgeColumnTarget =
  | "title"
  | "summary"
  | "body"
  | "jurisdictions"
  | "regions"
  | "languages"
  | "audiences"
  | "skip";

export type ColumnMapping = Record<string, KnowledgeColumnTarget>;

export type MappedKnowledgeDraft = {
  title: string;
  summary: string;
  body: string;
  applicability: KnowledgeApplicability;
  source_row: number;
};

const TARGET_ALIASES: Record<KnowledgeColumnTarget, string[]> = {
  title: ["title", "topic", "name", "heading", "knowledge"],
  summary: ["summary", "short description", "blurb", "abstract"],
  body: ["body", "content", "guidance", "notes", "description", "detail", "details"],
  jurisdictions: ["jurisdiction", "jurisdictions", "country", "nation", "law", "legal"],
  regions: ["region", "regions", "area", "state", "province"],
  languages: ["language", "languages", "locale", "lang"],
  audiences: ["audience", "audiences", "role", "roles", "persona"],
  skip: [],
};

function splitCsvLine(line: string): string[] {
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
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseCsvText(text: string): SheetGrid {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]).map((h, i) => h || `Column ${i + 1}`);
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    while (cells.length < headers.length) cells.push("");
    return cells.slice(0, headers.length);
  });
  return { headers, rows };
}

function guessTarget(header: string): KnowledgeColumnTarget {
  const h = header.toLowerCase().trim();
  for (const [target, aliases] of Object.entries(TARGET_ALIASES) as [
    KnowledgeColumnTarget,
    string[],
  ][]) {
    if (target === "skip") continue;
    if (aliases.some((a) => h === a || h.includes(a))) return target;
  }
  return "skip";
}

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<KnowledgeColumnTarget>();
  for (const header of headers) {
    const guess = guessTarget(header);
    if (guess !== "skip" && !used.has(guess)) {
      mapping[header] = guess;
      used.add(guess);
    } else {
      mapping[header] = "skip";
    }
  }
  if (![...Object.values(mapping)].includes("title") && headers[0]) {
    mapping[headers[0]] = "title";
  }
  return mapping;
}

function splitMulti(value: string): string[] {
  return value
    .split(/[;|,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function applyColumnMapping(
  grid: SheetGrid,
  mapping: ColumnMapping,
  opts?: { defaultUnscoped?: boolean }
): MappedKnowledgeDraft[] {
  const headerIndex = new Map(grid.headers.map((h, i) => [h, i]));
  const drafts: MappedKnowledgeDraft[] = [];

  grid.rows.forEach((row, rowIdx) => {
    const get = (target: KnowledgeColumnTarget): string => {
      const header = Object.entries(mapping).find(([, t]) => t === target)?.[0];
      if (!header) return "";
      const idx = headerIndex.get(header);
      return idx == null ? "" : (row[idx] ?? "").trim();
    };

    const title = get("title");
    if (!title) return;

    const jurisdictions = splitMulti(get("jurisdictions"));
    drafts.push({
      title,
      summary: get("summary"),
      body: get("body"),
      applicability: {
        jurisdictions,
        regions: splitMulti(get("regions")),
        languages: splitMulti(get("languages")),
        audiences: splitMulti(get("audiences")).map((a) => a.toLowerCase()) as KnowledgeApplicability["audiences"],
        unscoped: jurisdictions.length === 0 && Boolean(opts?.defaultUnscoped),
      },
      source_row: rowIdx + 2,
    });
  });

  return drafts;
}

export async function parseSpreadsheetFile(file: File): Promise<SheetGrid> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv" || file.type === "text/plain") {
    return parseCsvText(await file.text());
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const structured = await parseXlsxGrid(buffer);
    if (structured.headers.length > 0) return structured;
    const text = await extractOfficePlainText(buffer, file.name);
    const lines = text
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return { headers: [], rows: [] };
    const headers = lines[0].split(/\t+/);
    const rows = lines.slice(1).map((l) => {
      const cells = l.split(/\t+/);
      while (cells.length < headers.length) cells.push("");
      return cells.slice(0, headers.length);
    });
    return { headers, rows, sheetName: "Sheet1" };
  }

  throw new Error("Unsupported file type. Upload CSV or XLSX.");
}

async function parseXlsxGrid(buffer: ArrayBuffer): Promise<SheetGrid> {
  const bytes = new Uint8Array(buffer);
  const sharedXml = await readZipText(bytes, "xl/sharedStrings.xml");
  const sheetXml =
    (await readZipText(bytes, "xl/worksheets/sheet1.xml")) ||
    (await readZipText(bytes, "xl/worksheets/sheet.xml"));
  if (!sheetXml) return { headers: [], rows: [] };

  const shared = sharedXml ? parseSharedStrings(sharedXml) : [];
  const cells = parseSheetCells(sheetXml, shared);
  if (cells.size === 0) return { headers: [], rows: [] };

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
  if (matrix.length === 0) return { headers: [], rows: [] };
  const headers = matrix[0].map((h, i) => h.trim() || `Column ${i + 1}`);
  const rows = matrix.slice(1).map((row) => {
    const copy = [...row];
    while (copy.length < headers.length) copy.push("");
    return copy.slice(0, headers.length);
  });
  return { headers, rows, sheetName: "Sheet1" };
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const texts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => decodeXml(x[1]));
    out.push(texts.join(""));
  }
  return out;
}

function parseSheetCells(xml: string, shared: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const cellRe = /<c\b([^>]*)>(?:[\s\S]*?<v>([\s\S]*?)<\/v>)?/g;
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(xml))) {
    const attrs = m[1];
    const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
    if (!ref) continue;
    const type = /t="([^"]+)"/.exec(attrs)?.[1];
    const raw = m[2] ?? "";
    let value = "";
    if (type === "s") {
      const idx = Number(raw);
      value = Number.isFinite(idx) ? (shared[idx] ?? "") : "";
    } else if (type === "inlineStr") {
      const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(m[0]);
      value = t ? decodeXml(t[1]) : "";
    } else {
      value = decodeXml(raw);
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

async function readZipText(bytes: Uint8Array, path: string): Promise<string | null> {
  const LOCAL = 0x04034b50;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (offset + 30 <= bytes.length) {
    if (view.getUint32(offset, true) !== LOCAL) break;
    const method = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLen));
    const dataStart = offset + 30 + nameLen + extraLen;
    const packed = bytes.subarray(dataStart, dataStart + compSize);
    offset = dataStart + compSize;
    if (name.replace(/\\/g, "/") !== path) continue;
    let raw: Uint8Array;
    if (method === 0) raw = packed;
    else if (method === 8) {
      if (typeof DecompressionStream === "undefined") return null;
      const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      raw = new Uint8Array(await new Response(stream).arrayBuffer());
    } else return null;
    return new TextDecoder("utf-8").decode(raw);
  }
  return null;
}
