/**
 * Spreadsheet column → Knowledge destinations for Intake mapping.
 * Unknown columns default to preserve-as-attribute (never Skip unless chosen).
 */

import type { KnowledgeApplicability } from "@/types/knowledge";
import { canonicalizeKnowledgeAudiences } from "@/types/knowledge";

export type SheetGridLike = {
  headers: string[];
  rows: string[][];
  sheetName?: string;
};

export type CoreField = "title" | "summary" | "body";
export type ApplicabilityField = "jurisdictions" | "regions" | "languages" | "audiences";
export type ProvenanceField =
  | "source_url"
  | "citation"
  | "source_document"
  | "reviewed_date"
  | "verification_status";

export type ColumnMappingValue =
  | { dest: "core"; field: CoreField }
  | { dest: "applicability"; field: ApplicabilityField }
  | { dest: "provenance"; field: ProvenanceField }
  | { dest: "attribute"; key: string }
  | { dest: "skip" };

/** @deprecated Prefer ColumnMappingValue — kept for gradual UI migration labels. */
export type KnowledgeColumnTarget = string;

export type ColumnMapping = Record<string, ColumnMappingValue>;

export type MappingConfidence = "high" | "medium" | "low";

export type ColumnMappingSuggestion = {
  value: ColumnMappingValue;
  confidence: MappingConfidence;
  /** Competing destinations or weak match — needs human review. */
  ambiguous: boolean;
  note?: string;
};

export type ColumnMappingSuggestions = Record<string, ColumnMappingSuggestion>;

export type IntakeProvenance = Partial<Record<ProvenanceField, string>>;

export type MappedKnowledgeDraft = {
  title: string;
  summary: string;
  body: string;
  applicability: KnowledgeApplicability;
  attributes: Record<string, string>;
  provenance: IntakeProvenance;
  source_row: number;
  sheet_name?: string;
};

/** Suggested standard attribute keys (conventions, not DB columns). */
export const STANDARD_ATTRIBUTE_KEYS = [
  "requirement_id",
  "local_variation",
  "property_occupancy",
  "category",
  "legal_status",
  "applies_when",
  "action",
  "frequency",
  "timing",
  "evidence",
  "responsible_party",
  "professional_required",
  "insurance_relevance",
  "risk_or_consequence",
  "priority",
  "lead_time_days",
  "app_logic",
] as const;

const CORE_ALIASES: Record<CoreField, string[]> = {
  title: ["title", "topic", "heading", "requirement name", "knowledge"],
  summary: ["summary", "short description", "blurb", "abstract"],
  // Deliberately exclude bare "notes" / "app logic" — those are attributes.
  body: ["body", "guidance", "guidance text", "editorial", "article body", "long description"],
};

const APPLICABILITY_ALIASES: Record<ApplicabilityField, string[]> = {
  jurisdictions: ["jurisdiction", "jurisdictions", "country", "nation"],
  regions: ["region", "regions", "province"],
  languages: ["language", "languages", "locale"],
  audiences: ["audience", "audiences", "persona"],
};

const PROVENANCE_ALIASES: Record<ProvenanceField, string[]> = {
  source_url: [
    "official source url",
    "source url",
    "official source",
    "source link",
  ],
  citation: ["citation", "cite", "reference"],
  source_document: ["source document", "source doc", "filename"],
  reviewed_date: ["last reviewed", "review date", "reviewed date", "reviewed"],
  verification_status: ["verification status", "verification"],
};

const ATTRIBUTE_ALIASES: Record<string, string[]> = {
  requirement_id: ["requirement id", "req id", "requirement_id", "id"],
  local_variation: ["local variation", "variation", "local notes"],
  property_occupancy: [
    "property / occupancy",
    "property occupancy",
    "occupancy",
    "property type",
  ],
  category: ["category", "theme", "group"],
  legal_status: ["legal status", "status legal", "statutory", "mandatory"],
  applies_when: ["applies when", "trigger", "condition"],
  action: ["owner action", "required action", "what to do", "action"],
  frequency: ["frequency", "deadline", "how often", "cadence"],
  timing: ["timing", "when due", "schedule window"],
  evidence: ["evidence to retain", "evidence", "proof to retain", "proof"],
  responsible_party: ["responsible party", "owner role", "responsible"],
  professional_required: ["professional required", "competent person", "professional"],
  insurance_relevance: ["insurance relevance", "insurance"],
  risk_or_consequence: [
    "penalty / consequence",
    "risk or consequence",
    "consequence",
    "penalty",
    "risk",
  ],
  priority: ["app priority", "priority"],
  lead_time_days: ["lead time days", "lead_time_days", "lead time"],
  app_logic: ["app logic notes", "app logic", "logic notes", "system notes"],
};

type ScoredCandidate = {
  value: ColumnMappingValue;
  score: number;
  matchKind: "exact" | "phrase" | "token";
  label: string;
};

export function slugifyAttributeKey(header: string): string {
  const slug = header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 64);
  return slug || "field";
}

function normHeader(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, " ");
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Score how well `alias` matches `header`.
 * Short aliases (≤3 chars) only match as whole tokens — avoids "id" inside "Evidence".
 */
function scoreAliasMatch(header: string, alias: string): Omit<ScoredCandidate, "value" | "label"> | null {
  const h = normHeader(header);
  const a = alias.toLowerCase().trim();
  if (!a) return null;

  if (h === a) {
    return { score: 1000 + a.length, matchKind: "exact" };
  }

  const hTokens = tokens(h);
  const aTokens = tokens(a);
  if (aTokens.length === 0) return null;

  // Short aliases: exact token only (never substring of a longer word).
  if (a.length <= 3 || (aTokens.length === 1 && aTokens[0]!.length <= 3)) {
    if (hTokens.includes(a) || (aTokens.length === 1 && hTokens.includes(aTokens[0]!))) {
      return { score: 200 + a.length, matchKind: "token" };
    }
    return null;
  }

  if (h.includes(a)) {
    return { score: 700 + a.length, matchKind: "phrase" };
  }

  // All alias tokens present as header tokens (order-insensitive).
  if (aTokens.every((t) => hTokens.includes(t))) {
    return { score: 500 + a.length, matchKind: "token" };
  }

  return null;
}

function collectCandidates(header: string): ScoredCandidate[] {
  const out: ScoredCandidate[] = [];

  if (isAppLogicHeader(header)) {
    out.push({
      value: { dest: "attribute", key: "app_logic" },
      score: 1100,
      matchKind: "exact",
      label: "attribute.app_logic",
    });
  }

  for (const [field, aliases] of Object.entries(CORE_ALIASES) as [CoreField, string[]][]) {
    for (const alias of aliases) {
      const m = scoreAliasMatch(header, alias);
      if (m) {
        out.push({
          value: { dest: "core", field },
          ...m,
          label: `core.${field}`,
        });
      }
    }
  }
  for (const [field, aliases] of Object.entries(APPLICABILITY_ALIASES) as [
    ApplicabilityField,
    string[],
  ][]) {
    for (const alias of aliases) {
      const m = scoreAliasMatch(header, alias);
      if (m) {
        out.push({
          value: { dest: "applicability", field },
          ...m,
          label: `applicability.${field}`,
        });
      }
    }
  }
  for (const [field, aliases] of Object.entries(PROVENANCE_ALIASES) as [
    ProvenanceField,
    string[],
  ][]) {
    for (const alias of aliases) {
      const m = scoreAliasMatch(header, alias);
      if (m) {
        out.push({
          value: { dest: "provenance", field },
          ...m,
          label: `provenance.${field}`,
        });
      }
    }
  }
  for (const [key, aliases] of Object.entries(ATTRIBUTE_ALIASES)) {
    for (const alias of aliases) {
      const m = scoreAliasMatch(header, alias);
      if (m) {
        out.push({
          value: { dest: "attribute", key },
          ...m,
          label: `attribute.${key}`,
        });
      }
    }
  }

  return out;
}

function bestPerLabel(candidates: ScoredCandidate[]): ScoredCandidate[] {
  const best = new Map<string, ScoredCandidate>();
  for (const c of candidates) {
    const prev = best.get(c.label);
    if (!prev || c.score > prev.score) best.set(c.label, c);
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

/** True when header is operational metadata that must not become Body. */
function isAppLogicHeader(header: string): boolean {
  const h = normHeader(header);
  return h.includes("app logic") || h === "logic notes" || h === "system notes";
}

export function analyseColumnMapping(header: string): ColumnMappingSuggestion {
  const ranked = bestPerLabel(collectCandidates(header));

  if (ranked.length === 0) {
    const key = slugifyAttributeKey(header);
    return {
      value: { dest: "attribute", key },
      confidence: "medium",
      ambiguous: false,
      note: "No known alias — preserved as custom attribute",
    };
  }

  const top = ranked[0]!;
  const runnerUp = ranked[1];
  const nearTie =
    Boolean(runnerUp) && runnerUp!.label !== top.label && top.score - runnerUp!.score < 120;

  let confidence: MappingConfidence = "high";
  let ambiguous = false;
  let note: string | undefined;

  const shortExact =
    top.matchKind === "exact" &&
    (normHeader(header).length <= 3 || tokens(header).every((t) => t.length <= 3));

  if (nearTie) {
    confidence = "low";
    ambiguous = true;
    note = `Ambiguous: also matches ${runnerUp!.label}`;
  } else if (shortExact || (top.matchKind === "token" && top.score < 400)) {
    confidence = "low";
    ambiguous = true;
    note = "Weak / short match — confirm destination";
  } else if (top.matchKind === "token") {
    confidence = "medium";
    note = "Token match — confirm if unsure";
  } else if (top.matchKind === "phrase") {
    confidence = "high";
  }

  return {
    value: top.value,
    confidence,
    ambiguous,
    note,
  };
}

export function guessColumnMapping(header: string): ColumnMappingValue {
  return analyseColumnMapping(header).value;
}

export function suggestColumnMappingDetailed(headers: string[]): ColumnMappingSuggestions {
  const suggestions: ColumnMappingSuggestions = {};
  const usedCore = new Set<CoreField>();
  const usedApplicability = new Set<ApplicabilityField>();
  const usedProvenance = new Set<ProvenanceField>();
  const usedAttrKeys = new Set<string>();

  for (const header of headers) {
    let suggestion = analyseColumnMapping(header);
    let guess = suggestion.value;

    if (guess.dest === "core") {
      if (usedCore.has(guess.field)) {
        guess = { dest: "attribute", key: slugifyAttributeKey(header) };
        suggestion = {
          value: guess,
          confidence: "low",
          ambiguous: true,
          note: "Duplicate core field — preserved as attribute",
        };
      } else {
        usedCore.add(guess.field);
      }
    } else if (guess.dest === "applicability") {
      if (usedApplicability.has(guess.field)) {
        guess = { dest: "attribute", key: slugifyAttributeKey(header) };
        suggestion = {
          value: guess,
          confidence: "low",
          ambiguous: true,
          note: "Duplicate applicability field — preserved as attribute",
        };
      } else {
        usedApplicability.add(guess.field);
      }
    } else if (guess.dest === "provenance") {
      if (usedProvenance.has(guess.field)) {
        guess = { dest: "attribute", key: slugifyAttributeKey(header) };
        suggestion = {
          value: guess,
          confidence: "low",
          ambiguous: true,
          note: "Duplicate provenance field — preserved as attribute",
        };
      } else {
        usedProvenance.add(guess.field);
      }
    } else if (guess.dest === "attribute") {
      let key = guess.key;
      if (usedAttrKeys.has(key)) {
        key = `${key}_${slugifyAttributeKey(header)}`.slice(0, 64);
        suggestion = {
          value: { dest: "attribute", key },
          confidence: "low",
          ambiguous: true,
          note: `Duplicate attribute key — remapped to ${key}`,
        };
      } else {
        suggestion = { ...suggestion, value: { dest: "attribute", key } };
      }
      usedAttrKeys.add(key);
      guess = { dest: "attribute", key };
    }

    suggestions[header] = { ...suggestion, value: guess };
  }

  if (
    ![...Object.values(suggestions)].some(
      (s) => s.value.dest === "core" && s.value.field === "title"
    )
  ) {
    const first = headers[0];
    if (first) {
      suggestions[first] = {
        value: { dest: "core", field: "title" },
        confidence: "medium",
        ambiguous: true,
        note: "No title column detected — first column assigned as title",
      };
    }
  }

  return suggestions;
}

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const detailed = suggestColumnMappingDetailed(headers);
  const mapping: ColumnMapping = {};
  for (const [header, s] of Object.entries(detailed)) {
    mapping[header] = s.value;
  }
  return mapping;
}

function splitMulti(value: string): string[] {
  return value
    .split(/[;|,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function cellFor(
  headerIndex: Map<string, number>,
  row: string[],
  header: string | undefined
): string {
  if (!header) return "";
  const idx = headerIndex.get(header);
  return idx == null ? "" : (row[idx] ?? "").trim();
}

export function applyColumnMapping(
  grid: SheetGridLike,
  mapping: ColumnMapping,
  opts?: { defaultUnscoped?: boolean }
): MappedKnowledgeDraft[] {
  const headerIndex = new Map(grid.headers.map((h, i) => [h, i]));
  const drafts: MappedKnowledgeDraft[] = [];

  const findHeader = (
    pred: (v: ColumnMappingValue) => boolean
  ): string | undefined => Object.entries(mapping).find(([, v]) => pred(v))?.[0];

  grid.rows.forEach((row, rowIdx) => {
    const titleHeader = findHeader((v) => v.dest === "core" && v.field === "title");
    const title = cellFor(headerIndex, row, titleHeader);
    if (!title) return;

    const summary = cellFor(
      headerIndex,
      row,
      findHeader((v) => v.dest === "core" && v.field === "summary")
    );
    const body = cellFor(
      headerIndex,
      row,
      findHeader((v) => v.dest === "core" && v.field === "body")
    );

    const jurisdictions = splitMulti(
      cellFor(
        headerIndex,
        row,
        findHeader((v) => v.dest === "applicability" && v.field === "jurisdictions")
      )
    );

    const attributes: Record<string, string> = {};
    const provenance: IntakeProvenance = {};

    for (const [header, value] of Object.entries(mapping)) {
      const cell = cellFor(headerIndex, row, header);
      if (!cell) continue;
      if (value.dest === "attribute") {
        attributes[value.key] = cell;
      } else if (value.dest === "provenance") {
        provenance[value.field] = cell;
      }
    }

    drafts.push({
      title,
      summary,
      body,
      applicability: {
        jurisdictions,
        regions: splitMulti(
          cellFor(
            headerIndex,
            row,
            findHeader((v) => v.dest === "applicability" && v.field === "regions")
          )
        ),
        languages: splitMulti(
          cellFor(
            headerIndex,
            row,
            findHeader((v) => v.dest === "applicability" && v.field === "languages")
          )
        ),
        audiences: canonicalizeKnowledgeAudiences(
          splitMulti(
            cellFor(
              headerIndex,
              row,
              findHeader((v) => v.dest === "applicability" && v.field === "audiences")
            )
          )
        ),
        unscoped: jurisdictions.length === 0 && Boolean(opts?.defaultUnscoped),
      },
      attributes,
      provenance,
      source_row: rowIdx + 2,
      sheet_name: grid.sheetName,
    });
  });

  return drafts;
}

export function mappingSummary(mapping: ColumnMapping): {
  core: number;
  applicability: number;
  provenance: number;
  attributes: number;
  skip: number;
} {
  const counts = { core: 0, applicability: 0, provenance: 0, attributes: 0, skip: 0 };
  for (const v of Object.values(mapping)) {
    if (v.dest === "core") counts.core += 1;
    else if (v.dest === "applicability") counts.applicability += 1;
    else if (v.dest === "provenance") counts.provenance += 1;
    else if (v.dest === "attribute") counts.attributes += 1;
    else counts.skip += 1;
  }
  return counts;
}

export function suggestionsSummary(suggestions: ColumnMappingSuggestions): {
  high: number;
  medium: number;
  low: number;
  ambiguous: number;
} {
  const counts = { high: 0, medium: 0, low: 0, ambiguous: 0 };
  for (const s of Object.values(suggestions)) {
    counts[s.confidence] += 1;
    if (s.ambiguous) counts.ambiguous += 1;
  }
  return counts;
}

export function describeMapping(value: ColumnMappingValue): string {
  if (value.dest === "core") return `Core · ${value.field}`;
  if (value.dest === "applicability") return `Applicability · ${value.field}`;
  if (value.dest === "provenance") return `Source · ${value.field}`;
  if (value.dest === "attribute") return `Attribute · ${value.key}`;
  return "Skip (discard)";
}

/** Alias hits used when scoring header rows in sheet selection. */
const STANDARD_ATTR_SET = new Set<string>(STANDARD_ATTRIBUTE_KEYS);

export function headerAliasHit(header: string): boolean {
  const g = guessColumnMapping(header);
  return g.dest !== "attribute" || STANDARD_ATTR_SET.has(g.key);
}
