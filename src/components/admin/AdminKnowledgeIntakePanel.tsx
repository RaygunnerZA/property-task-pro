import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileSpreadsheet, Loader2, PenLine, Upload } from "lucide-react";
import {
  useAdminAnalyseKnowledgeDocument,
  useAdminAnalyseKnowledgeUrl,
  useAdminBulkCreateKnowledgeCandidates,
  useAdminImportKnowledgeProposals,
  useAdminInterpretKnowledgeWorkbook,
  useAdminUploadKnowledgeIntakeFile,
  useAdminUpsertPlatformKnowledge,
  type KnowledgeIntakeStorage,
  type WorkbookInterpretationResult,
} from "@/hooks/admin/useAdminKnowledge";
import { AdminKnowledgeProposalsReview } from "@/components/admin/AdminKnowledgeProposalsReview";
import {
  isKnowledgeDocumentFile,
  isSpreadsheetFile,
  proposalsFromDocAnalysis,
  type KnowledgeSourceProvenance,
  type ProposedKnowledgeCandidate,
} from "@/lib/knowledge/knowledgeDocumentIntake";
import {
  applyColumnMapping,
  buildWorkbookManifest,
  interpretationFromWorkbookResult,
  mappingSummary,
  parseSpreadsheetWorkbook,
  slugifyAttributeKey,
  summarizeSheetForContext,
  suggestColumnMappingDetailed,
  suggestionsSummary,
  STANDARD_ATTRIBUTE_KEYS,
  type ColumnMapping,
  type ColumnMappingSuggestion,
  type ColumnMappingSuggestions,
  type ColumnMappingValue,
  type ParsedWorksheet,
  type SheetInterpretation,
  type SheetRecommendation,
  type SheetRole,
  type SheetGrid,
  type SpreadsheetWorkbook,
} from "@/lib/knowledge/knowledgeSheetParse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  EMPTY_APPLICABILITY,
  type KnowledgeApplicability,
} from "@/types/knowledge";
import { toast } from "sonner";
import { toErrorMessage } from "@/lib/error";

type DestCategory =
  | "core"
  | "applicability"
  | "provenance"
  | "attribute"
  | "custom"
  | "skip";

function categoryOf(value: ColumnMappingValue | undefined): DestCategory {
  if (!value || value.dest === "skip") return "skip";
  if (value.dest === "attribute") {
    const known = (STANDARD_ATTRIBUTE_KEYS as readonly string[]).includes(value.key);
    return known ? "attribute" : "custom";
  }
  return value.dest;
}

function defaultForCategory(
  cat: DestCategory,
  header: string,
  previous?: ColumnMappingValue
): ColumnMappingValue {
  switch (cat) {
    case "core":
      return { dest: "core", field: "title" };
    case "applicability":
      return { dest: "applicability", field: "jurisdictions" };
    case "provenance":
      return { dest: "provenance", field: "source_url" };
    case "attribute": {
      const key =
        previous?.dest === "attribute" &&
        (STANDARD_ATTRIBUTE_KEYS as readonly string[]).includes(previous.key)
          ? previous.key
          : "category";
      return { dest: "attribute", key };
    }
    case "custom": {
      const key =
        previous?.dest === "attribute" ? previous.key : slugifyAttributeKey(header);
      return { dest: "attribute", key };
    }
    case "skip":
      return { dest: "skip" };
  }
}

function mappingFromSuggestions(s: ColumnMappingSuggestions): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const [header, sug] of Object.entries(s)) {
    mapping[header] = sug.value;
  }
  return mapping;
}

type SheetIntakeConfig = {
  sheetName: string;
  grid: SheetGrid;
  rowCount: number;
  selected: boolean;
  isDataBearing: boolean;
  skippedReason?: string;
  recommendedInterpretation: SheetInterpretation;
  interpretation: SheetInterpretation;
  mapping: ColumnMapping;
  suggestions: ColumnMappingSuggestions;
  mappingReviewOpen: boolean;
};

type SheetOverrideMode = "auto" | "include" | "context" | "exclude";

function initSheetConfig(
  parsed: ParsedWorksheet,
  ai?: WorkbookInterpretationResult["sheets"][number]
): SheetIntakeConfig {
  const detailed =
    parsed.grid.headers.length > 0
      ? suggestColumnMappingDetailed(parsed.grid.headers)
      : ({} as ColumnMappingSuggestions);
  const recommended = interpretationFromWorkbookResult(ai);
  return {
    sheetName: parsed.sheetName,
    grid: parsed.grid,
    rowCount: parsed.rowCount,
    selected: recommended.recommendation === "include",
    isDataBearing: parsed.isDataBearing,
    skippedReason: parsed.skippedReason,
    recommendedInterpretation: recommended,
    interpretation: recommended,
    mapping: mappingFromSuggestions(detailed),
    suggestions: detailed,
    mappingReviewOpen: false,
  };
}

function recommendationLabel(value: SheetRecommendation): string {
  switch (value) {
    case "include":
      return "Include";
    case "keep_as_context":
      return "Keep as context";
    case "exclude":
      return "Exclude";
  }
}

function roleLabel(value: SheetRole): string {
  switch (value) {
    case "knowledge_data":
      return "Knowledge data";
    case "reference_context":
      return "Reference / context";
    case "not_for_knowledge":
      return "Not for knowledge";
  }
}

function badgeTone(role: SheetRole): string {
  switch (role) {
    case "knowledge_data":
      return "bg-emerald-100/80 text-emerald-800";
    case "reference_context":
      return "bg-sky-100/80 text-sky-800";
    case "not_for_knowledge":
      return "bg-muted text-muted-foreground";
  }
}

function overrideModeForSheet(sheet: SheetIntakeConfig): SheetOverrideMode {
  if (
    sheet.interpretation.recommendation === sheet.recommendedInterpretation.recommendation &&
    sheet.interpretation.role === sheet.recommendedInterpretation.role &&
    sheet.interpretation.reason === sheet.recommendedInterpretation.reason
  ) {
    return "auto";
  }
  if (sheet.selected) return "include";
  if (sheet.interpretation.recommendation === "keep_as_context") return "context";
  if (sheet.interpretation.recommendation === "exclude") return "exclude";
  return "context";
}

function applySheetOverride(sheet: SheetIntakeConfig, mode: SheetOverrideMode): SheetIntakeConfig {
  if (mode === "auto") {
    return {
      ...sheet,
      interpretation: sheet.recommendedInterpretation,
      selected: sheet.recommendedInterpretation.recommendation === "include",
    };
  }
  if (mode === "include") {
    return {
      ...sheet,
      selected: true,
      interpretation: {
        ...sheet.interpretation,
        role: "knowledge_data",
        recommendation: "include",
        confidence: "high",
        reason: "Manually overridden to create Knowledge candidates from this sheet.",
      },
    };
  }
  if (mode === "context") {
    return {
      ...sheet,
      selected: false,
      interpretation: {
        ...sheet.interpretation,
        role: "reference_context",
        recommendation: "keep_as_context",
        confidence: "high",
        reason: "Manually overridden to keep this sheet as workbook context only.",
      },
    };
  }
  return {
    ...sheet,
    selected: false,
    interpretation: {
      ...sheet.interpretation,
      role: "not_for_knowledge",
      recommendation: "exclude",
      confidence: "high",
      reason: "Manually overridden to exclude this sheet from Knowledge intake.",
    },
  };
}

function ambiguousHeaders(suggestions: ColumnMappingSuggestions): string[] {
  return Object.entries(suggestions)
    .filter(([, s]) => s.ambiguous || s.confidence === "low")
    .map(([h]) => h);
}

function SheetMappingSummary({
  sheet,
  onToggleReview,
}: {
  sheet: SheetIntakeConfig;
  onToggleReview: () => void;
}) {
  const summary = mappingSummary(sheet.mapping);
  const confidence = suggestionsSummary(sheet.suggestions);
  const reviewHeaders = ambiguousHeaders(sheet.suggestions);

  return (
    <div className="rounded-lg bg-muted/20 p-2 space-y-1.5">
      <p className="text-[11px] text-muted-foreground">
        {summary.core} core · {summary.applicability} applicability ·{" "}
        {summary.provenance} provenance · {summary.attributes} attributes · {summary.skip}{" "}
        skip
      </p>
      <p className="text-[11px] text-muted-foreground">
        Confidence: {confidence.high} high · {confidence.medium} medium · {confidence.low}{" "}
        low
        {reviewHeaders.length > 0 && (
          <span className="text-[hsl(16_70%_40%)]"> · {reviewHeaders.length} need review</span>
        )}
      </p>
      {reviewHeaders.length > 0 && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic h-7 text-[11px]"
          onClick={onToggleReview}
        >
          {sheet.mappingReviewOpen ? (
            <ChevronDown className="h-3 w-3 mr-1" />
          ) : (
            <ChevronRight className="h-3 w-3 mr-1" />
          )}
          {sheet.mappingReviewOpen ? "Hide mapping" : "Review mapping"} ({reviewHeaders.length})
        </Button>
      )}
    </div>
  );
}

function ColumnMappingRow({
  header,
  value,
  suggestion,
  onChange,
}: {
  header: string;
  value: ColumnMappingValue;
  suggestion?: ColumnMappingSuggestion;
  onChange: (next: ColumnMappingValue) => void;
}) {
  const cat = categoryOf(value);
  const needsReview = Boolean(suggestion?.ambiguous || suggestion?.confidence === "low");

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 text-xs rounded-lg px-2 py-1.5",
        needsReview && "bg-[hsl(16_70%_95%)] ring-1 ring-[hsl(16_75%_60%/0.35)]"
      )}
    >
      <span className="font-mono min-w-[10rem] max-w-[14rem] truncate" title={header}>
        {header}
      </span>
      {needsReview && (
        <span
          className="text-[10px] font-mono uppercase tracking-wider text-[hsl(16_70%_40%)]"
          title={suggestion?.note}
        >
          Review
        </span>
      )}
      <select
        className="rounded-md bg-muted/50 px-2 py-1"
        value={cat}
        onChange={(e) =>
          onChange(defaultForCategory(e.target.value as DestCategory, header, value))
        }
        aria-label={`Destination for ${header}`}
      >
        <option value="core">Core field</option>
        <option value="applicability">Applicability</option>
        <option value="provenance">Source / provenance</option>
        <option value="attribute">Structured attribute</option>
        <option value="custom">Custom attribute</option>
        <option value="skip">Skip (discard)</option>
      </select>

      {value.dest === "core" && (
        <select
          className="rounded-md bg-muted/50 px-2 py-1"
          value={value.field}
          onChange={(e) =>
            onChange({ dest: "core", field: e.target.value as "title" | "summary" | "body" })
          }
        >
          <option value="title">title</option>
          <option value="summary">summary</option>
          <option value="body">body</option>
        </select>
      )}

      {value.dest === "applicability" && (
        <select
          className="rounded-md bg-muted/50 px-2 py-1"
          value={value.field}
          onChange={(e) =>
            onChange({
              dest: "applicability",
              field: e.target.value as "jurisdictions" | "regions" | "languages" | "audiences",
            })
          }
        >
          <option value="jurisdictions">jurisdictions</option>
          <option value="regions">regions</option>
          <option value="languages">languages</option>
          <option value="audiences">audiences</option>
        </select>
      )}

      {value.dest === "provenance" && (
        <select
          className="rounded-md bg-muted/50 px-2 py-1"
          value={value.field}
          onChange={(e) =>
            onChange({
              dest: "provenance",
              field: e.target.value as
                | "source_url"
                | "citation"
                | "source_document"
                | "reviewed_date"
                | "verification_status",
            })
          }
        >
          <option value="source_url">source URL</option>
          <option value="citation">citation</option>
          <option value="source_document">source document</option>
          <option value="reviewed_date">reviewed date</option>
          <option value="verification_status">verification status</option>
        </select>
      )}

      {value.dest === "attribute" && cat === "attribute" && (
        <select
          className="rounded-md bg-muted/50 px-2 py-1 max-w-[12rem]"
          value={value.key}
          onChange={(e) => onChange({ dest: "attribute", key: e.target.value })}
        >
          {STANDARD_ATTRIBUTE_KEYS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
          {!(STANDARD_ATTRIBUTE_KEYS as readonly string[]).includes(value.key) && (
            <option value={value.key}>{value.key}</option>
          )}
        </select>
      )}

      {value.dest === "attribute" && cat === "custom" && (
        <Input
          className="h-8 w-40 text-xs font-mono"
          value={value.key}
          onChange={(e) => {
            const key = e.target.value
              .toLowerCase()
              .replace(/[^a-z0-9_]+/g, "_")
              .replace(/^_+|_+$/g, "")
              .slice(0, 64);
            onChange({
              dest: "attribute",
              key: key || slugifyAttributeKey(header),
            });
          }}
          placeholder="attribute_key"
          aria-label={`Custom attribute key for ${header}`}
        />
      )}

      {suggestion?.note && needsReview && (
        <span className="basis-full text-[10px] text-muted-foreground pl-[10rem]">
          {suggestion.note}
        </span>
      )}
    </div>
  );
}

function ApplicabilityFields({
  value,
  onChange,
}: {
  value: KnowledgeApplicability;
  onChange: (next: KnowledgeApplicability) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-xs space-y-1">
        <span className="text-muted-foreground">Jurisdictions (comma-separated)</span>
        <Input
          value={value.jurisdictions.join(", ")}
          onChange={(e) =>
            onChange({
              ...value,
              jurisdictions: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="GB-ENG, IE"
        />
      </label>
      <label className="text-xs space-y-1">
        <span className="text-muted-foreground">Regions</span>
        <Input
          value={value.regions.join(", ")}
          onChange={(e) =>
            onChange({
              ...value,
              regions: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </label>
      <label className="text-xs space-y-1">
        <span className="text-muted-foreground">Languages</span>
        <Input
          value={value.languages.join(", ")}
          onChange={(e) =>
            onChange({
              ...value,
              languages: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="en-GB"
        />
      </label>
      <label className="text-xs space-y-1">
        <span className="text-muted-foreground">Audiences</span>
        <Input
          value={value.audiences.join(", ")}
          onChange={(e) =>
            onChange({
              ...value,
              audiences: e.target.value
                .split(",")
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean) as KnowledgeApplicability["audiences"],
            })
          }
          placeholder="owner, manager, field, tenant, public"
        />
      </label>
      <label className="flex items-center gap-2 text-xs sm:col-span-2">
        <input
          type="checkbox"
          checked={Boolean(value.unscoped)}
          onChange={(e) => onChange({ ...value, unscoped: e.target.checked })}
        />
        <span className="text-muted-foreground">
          Unscoped (platform-global — only when no jurisdiction applies)
        </span>
      </label>
    </div>
  );
}

type IntakeMode = "upload" | "url" | "manual";

export function AdminKnowledgeIntakePanel() {
  const uploadFile = useAdminUploadKnowledgeIntakeFile();
  const analyseDocument = useAdminAnalyseKnowledgeDocument();
  const analyseUrl = useAdminAnalyseKnowledgeUrl();
  const interpretWorkbook = useAdminInterpretKnowledgeWorkbook();
  const importProposals = useAdminImportKnowledgeProposals();
  const bulkCreate = useAdminBulkCreateKnowledgeCandidates();
  const upsert = useAdminUpsertPlatformKnowledge();

  const [intakeMode, setIntakeMode] = useState<IntakeMode>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [pasteBuffer, setPasteBuffer] = useState("");
  const [workbook, setWorkbook] = useState<{
    kind: SpreadsheetWorkbook["kind"];
    sheets: SheetIntakeConfig[];
  } | null>(null);
  const [docStorage, setDocStorage] = useState<KnowledgeIntakeStorage | null>(null);
  const [docSource, setDocSource] = useState<KnowledgeSourceProvenance | null>(null);
  const [proposals, setProposals] = useState<ProposedKnowledgeCandidate[] | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [storage, setStorage] = useState<KnowledgeIntakeStorage | null>(null);
  const [defaultUnscoped, setDefaultUnscoped] = useState(false);

  const [manualTitle, setManualTitle] = useState("");
  const [manualSummary, setManualSummary] = useState("");
  const [manualBody, setManualBody] = useState("");
  const [manualApplicability, setManualApplicability] = useState<KnowledgeApplicability>({
    ...EMPTY_APPLICABILITY,
  });

  const selectedSheets = useMemo(
    () =>
      workbook?.sheets.filter(
        (s) =>
          s.selected &&
          s.interpretation.recommendation === "include" &&
          s.grid.headers.length > 0
      ) ?? [],
    [workbook]
  );

  const contextSheets = useMemo(
    () =>
      workbook?.sheets.filter((s) => s.interpretation.recommendation === "keep_as_context") ?? [],
    [workbook]
  );

  const drafts = useMemo(() => {
    return selectedSheets.flatMap((sheet) =>
      applyColumnMapping(sheet.grid, sheet.mapping, { defaultUnscoped }).map((d) => ({
        ...d,
        sheet_name: sheet.sheetName,
      }))
    );
  }, [selectedSheets, defaultUnscoped]);

  const readyCount = drafts.filter(
    (d) => d.applicability.jurisdictions.length > 0 || d.applicability.unscoped
  ).length;

  const totalReviewNeeded = useMemo(
    () =>
      selectedSheets.reduce(
        (n, s) => n + ambiguousHeaders(s.suggestions).length,
        0
      ),
    [selectedSheets]
  );

  const updateSheet = (
    sheetName: string,
    patch: Partial<Pick<SheetIntakeConfig, "selected" | "mappingReviewOpen" | "interpretation">> & {
      mapping?: ColumnMapping;
      suggestions?: ColumnMappingSuggestions;
    }
  ) => {
    setWorkbook((wb) => {
      if (!wb) return wb;
      return {
        ...wb,
        sheets: wb.sheets.map((s) =>
          s.sheetName === sheetName ? { ...s, ...patch } : s
        ),
      };
    });
  };

  const updateSheetColumn = (sheetName: string, header: string, next: ColumnMappingValue) => {
    setWorkbook((wb) => {
      if (!wb) return wb;
      return {
        ...wb,
        sheets: wb.sheets.map((s) => {
          if (s.sheetName !== sheetName) return s;
          return {
            ...s,
            mapping: { ...s.mapping, [header]: next },
            suggestions: {
              ...s.suggestions,
              [header]: {
                value: next,
                confidence: "high",
                ambiguous: false,
                note: "Manually set",
              },
            },
          };
        }),
      };
    });
  };

  const handleFile = async (file: File) => {
    try {
      const isSheet = isSpreadsheetFile(file);
      const isDoc = isKnowledgeDocumentFile(file);

      if (!isSheet && !isDoc) {
        toast.error("Supported uploads: CSV, XLSX, PDF, DOCX, TXT, or images");
        return;
      }

      const uploaded = await uploadFile.mutateAsync(file);
      setStorage(uploaded);
      setProposals(null);
      setDocSource(null);

      if (isSheet) {
        const parsed = await parseSpreadsheetWorkbook(file);
        const manifest = buildWorkbookManifest(parsed);
        let interpreted: WorkbookInterpretationResult | null = null;
        try {
          interpreted = await interpretWorkbook.mutateAsync(manifest);
          if (interpreted.interpretation_status !== "ok") {
            toast.error("Workbook AI interpretation is unavailable on the server. Using safe context fallback.");
          }
        } catch {
          toast.error("Workbook interpretation unavailable — defaulted sheets to context for review");
        }
        const sheets = parsed.sheets.map((sheet) =>
          initSheetConfig(
            sheet,
            interpreted?.sheets.find((item) => item.sheet_name === sheet.sheetName)
          )
        );
        const includeCount = sheets.filter(
          (s) => s.interpretation.recommendation === "include"
        ).length;
        const contextCount = sheets.filter(
          (s) => s.interpretation.recommendation === "keep_as_context"
        ).length;
        if (includeCount === 0) {
          toast.error(
            "No sheets were confidently classified as Knowledge data. Review the sheet interpretations and override if needed."
          );
        }
        setWorkbook({ kind: parsed.kind, sheets });
        setDocStorage(null);
        const needsReview = sheets
          .filter((s) => s.selected)
          .reduce((n, s) => n + ambiguousHeaders(s.suggestions).length, 0);
        toast.success(
          parsed.kind === "xlsx"
            ? `Workbook: ${parsed.sheets.length} sheets · ${includeCount} include · ${contextCount} context · ${needsReview} columns need review`
            : `Parsed ${sheets[0]?.rowCount ?? 0} rows${needsReview ? ` · ${needsReview} columns need review` : ""}`
        );
        return;
      }

      setWorkbook(null);
      setDocStorage(uploaded);
      const analysis = await analyseDocument.mutateAsync(uploaded);
      const source: KnowledgeSourceProvenance = {
        source_document: uploaded.filename,
        storage_bucket: uploaded.bucket,
        storage_path: uploaded.path,
        retrieved_date: new Date().toISOString(),
        intake_mode: "upload",
        document_type: analysis.document_type,
        extractor: "ai-doc-analyse",
      };
      setDocSource(source);
      setProposals(proposalsFromDocAnalysis(analysis, source));
      toast.success("Document analysed — review proposed candidates");
    } catch (e) {
      toast.error(toErrorMessage(e, "Upload failed"));
    }
  };

  const handleUrlAnalyse = async (overrideUrl?: string) => {
    const target = (overrideUrl ?? urlInput).trim();
    if (!target) return;
    try {
      const result = await analyseUrl.mutateAsync(target);
      setWorkbook(null);
      setProposals(null);
      setStorage(result.storage);
      setDocStorage(result.storage);
      const source: KnowledgeSourceProvenance = {
        source_url: result.source.source_url,
        source_document: result.source.source_document,
        retrieved_date: result.source.retrieved_date,
        storage_bucket: result.storage.bucket,
        storage_path: result.storage.path,
        intake_mode: "url",
        document_type: result.analysis.document_type,
        extractor: "ai-doc-analyse",
      };
      setDocSource(source);
      setProposals(proposalsFromDocAnalysis(result.analysis, source));
      toast.success("URL fetched and analysed — review proposed candidates");
    } catch (e) {
      toast.error(toErrorMessage(e, "URL intake failed"));
    }
  };

  const importDocumentProposals = () => {
    if (!proposals?.length || !docSource) return;
    const store = docStorage ?? storage;
    importProposals.mutate(
      {
        filename: store?.filename ?? docSource.source_document ?? "document",
        mime: store?.mime,
        storage: store,
        intakeMode: docSource.intake_mode ?? "upload",
        source: docSource,
        proposals,
      },
      {
        onSuccess: (res) => {
          toast.success(`Added ${res.created_count} to review (critic running)`);
          setProposals(null);
          setDocSource(null);
          setDocStorage(null);
          setWorkbook(null);
          setUrlInput("");
        },
        onError: (e) => toast.error(toErrorMessage(e, "Import failed")),
      }
    );
  };

  const createFromSheet = () => {
    if (!storage || !workbook || selectedSheets.length === 0) return;
    const contextSummaries = workbook.sheets
      .filter((s) => s.interpretation.recommendation !== "include")
      .map((s) => summarizeSheetForContext(s.grid, s.interpretation));
    const candidates = drafts.filter(
      (d) => d.applicability.jurisdictions.length > 0 || d.applicability.unscoped
    );
    if (!candidates.length) {
      toast.error("No rows with jurisdiction or Unscoped");
      return;
    }
    bulkCreate.mutate(
      {
        filename: storage.filename,
        mime: storage.mime,
        storageBucket: storage.bucket,
        storagePath: storage.path,
        columnMapping: Object.fromEntries(
          selectedSheets.map((s) => [s.sheetName, s.mapping])
        ),
        sheetNames: selectedSheets.map((s) => s.sheetName),
        batchMetadata: {
          workbook_sheets: workbook.sheets.map((s) => ({
            sheet_name: s.sheetName,
            role: s.interpretation.role,
            recommendation: s.interpretation.recommendation,
            confidence: s.interpretation.confidence,
            reason: s.interpretation.reason,
            row_count: s.rowCount,
            related_sheets: s.interpretation.relatedSheets,
            selected_for_candidates: s.selected,
          })),
          context_sheet_names: contextSheets.map((s) => s.sheetName),
          context_sheets: contextSummaries,
        },
        candidates: candidates.map((c) => ({
          title: c.title,
          summary: c.summary || undefined,
          body: c.body || undefined,
          applicability: c.applicability,
          attributes: c.attributes,
          provenance: {
            ...c.provenance,
            context_sheet_names: contextSheets.map((s) => s.sheetName).join(", "),
            workbook_context: JSON.stringify(contextSummaries).slice(0, 4000),
          },
          source_row: c.source_row,
          sheet_name: c.sheet_name,
        })),
      },
      {
        onSuccess: (res) => {
          toast.success(`Added ${res.created_count} to review (critic running)`);
          setWorkbook(null);
        },
        onError: (e) => toast.error(toErrorMessage(e, "Import failed")),
      }
    );
  };

  const createManual = () => {
    if (!manualTitle.trim()) {
      toast.error("Title required");
      return;
    }
    if (manualApplicability.jurisdictions.length === 0 && !manualApplicability.unscoped) {
      toast.error("Set at least one jurisdiction or mark Unscoped");
      return;
    }
    upsert.mutate(
      {
        title: manualTitle.trim(),
        summary: manualSummary.trim() || undefined,
        body: manualBody.trim() || undefined,
        applicability: manualApplicability,
      },
      {
        onSuccess: () => {
          toast.success("Candidate created — critic invoked");
          setManualTitle("");
          setManualSummary("");
          setManualBody("");
          setManualApplicability({ ...EMPTY_APPLICABILITY });
        },
        onError: (e) => toast.error(toErrorMessage(e, "Create failed")),
      }
    );
  };

  const busy =
    uploadFile.isPending ||
    analyseDocument.isPending ||
    analyseUrl.isPending ||
    interpretWorkbook.isPending ||
    importProposals.isPending ||
    bulkCreate.isPending ||
    upsert.isPending;

  const submitPasteOrUrl = () => {
    const raw = pasteBuffer.trim() || urlInput.trim();
    if (!raw) return;
    if (/^https?:\/\//i.test(raw.split(/\s/)[0] ?? "")) {
      setIntakeMode("url");
      setUrlInput(raw.split(/\s/)[0] ?? raw);
      void handleUrlAnalyse(raw.split(/\s/)[0] ?? raw);
      return;
    }
    // Pasted prose → treat as a text document for claim extraction.
    const blob = new Blob([raw], { type: "text/plain" });
    const file = new File([blob], "pasted-source.txt", { type: "text/plain" });
    setIntakeMode("upload");
    void handleFile(file);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-4">
        <div className="space-y-1">
          <h2 className="font-medium text-sm">Add source</h2>
          <p className="text-xs text-muted-foreground">
            Drag a file here, choose a file, paste text, or add a URL. Pipeline: source → extract
            claims → applicability → critic → Review. Never auto-publish.
          </p>
        </div>

        <div
          className={cn(
            "rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border/60 bg-muted/20",
            busy && "opacity-60 pointer-events-none"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) {
              setIntakeMode("upload");
              void handleFile(f);
            }
          }}
        >
          <Upload className="h-6 w-6 text-primary mx-auto mb-2" />
          <p className="text-sm text-foreground">Drop a source file</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            CSV/XLSX · PDF/DOCX/TXT · images
          </p>
          <label className="inline-flex cursor-pointer mt-3">
            <Button asChild size="sm" className="shadow-primary-btn border-0" disabled={busy}>
              <span>
                {uploadFile.isPending ||
                analyseDocument.isPending ||
                interpretWorkbook.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Select file
              </span>
            </Button>
            <input
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls,.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp,.gif"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setIntakeMode("upload");
                  void handleFile(f);
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex-1 min-w-[16rem] text-xs space-y-1">
            <span className="text-muted-foreground">Paste text or URL</span>
            <Textarea
              value={pasteBuffer || urlInput}
              onChange={(e) => {
                const v = e.target.value;
                setPasteBuffer(v);
                if (/^https?:\/\//i.test(v.trim())) setUrlInput(v.trim());
              }}
              placeholder="https://… or paste source text"
              rows={3}
              disabled={busy}
              className="text-sm"
            />
          </label>
          <Button
            size="sm"
            className="shadow-primary-btn border-0"
            disabled={busy || !(pasteBuffer.trim() || urlInput.trim())}
            onClick={() => submitPasteOrUrl()}
          >
            {analyseUrl.isPending || analyseDocument.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Analyse
          </Button>
        </div>

        <button
          type="button"
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          onClick={() => setIntakeMode((m) => (m === "manual" ? "upload" : "manual"))}
        >
          <PenLine className="h-3 w-3" />
          {intakeMode === "manual" ? "Hide manual entry" : "Or create a candidate manually"}
        </button>

        {proposals && proposals.length > 0 && (
          <AdminKnowledgeProposalsReview
            proposals={proposals}
            onChange={setProposals}
            sourceLabel={
              docSource?.source_url ??
              docSource?.source_document ??
              storage?.filename ??
              "document"
            }
            busy={importProposals.isPending}
            onImport={importDocumentProposals}
          />
        )}

        {intakeMode === "upload" && workbook && (
          <div className="space-y-3 pt-2 border-t border-border/40">
            <p className="text-xs text-muted-foreground">
              {workbook.kind === "xlsx"
                ? `Workbook · ${workbook.sheets.length} sheets · ${selectedSheets.length} include · ${contextSheets.length} context`
                : "CSV"}
              {" · "}
              {drafts.length} rows · {readyCount} ready with applicability
              {totalReviewNeeded > 0 && (
                <span className="text-[hsl(16_70%_40%)]">
                  {" "}
                  · {totalReviewNeeded} column mappings need review
                </span>
              )}
            </p>

            <div className="space-y-2">
              {workbook.sheets.map((sheet) => {
                const reviewHeaders = ambiguousHeaders(sheet.suggestions);
                const sheetReady = applyColumnMapping(sheet.grid, sheet.mapping, {
                  defaultUnscoped,
                }).filter(
                  (d) => d.applicability.jurisdictions.length > 0 || d.applicability.unscoped
                ).length;

                return (
                  <div
                    key={sheet.sheetName}
                    className={cn(
                      "rounded-lg border border-border/30 p-3 space-y-2",
                      sheet.selected && "bg-card/40"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-xs font-medium">{sheet.sheetName}</span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-[6px] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider",
                          badgeTone(sheet.interpretation.role)
                        )}
                      >
                        {roleLabel(sheet.interpretation.role)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {recommendationLabel(sheet.interpretation.recommendation)} ·{" "}
                        {sheet.interpretation.confidence} confidence
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {sheet.rowCount} rows
                        {sheet.selected
                          ? ` · ${sheetReady} ready`
                          : ""}
                      </span>
                      {sheet.skippedReason && (
                        <span className="text-[11px] text-muted-foreground italic">
                          {sheet.skippedReason}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{sheet.interpretation.reason}</p>
                    {sheet.interpretation.relatedSheets.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Related: {sheet.interpretation.relatedSheets.join(", ")}
                      </p>
                    )}
                    <label className="text-xs space-y-1 block">
                      <span className="text-muted-foreground">Override</span>
                      <select
                        className="rounded-md bg-muted/50 px-2 py-1"
                        value={overrideModeForSheet(sheet)}
                        onChange={(e) => {
                          const next = applySheetOverride(
                            sheet,
                            e.target.value as SheetOverrideMode
                          );
                          updateSheet(sheet.sheetName, {
                            selected: next.selected,
                            interpretation: next.interpretation,
                          });
                        }}
                      >
                        <option value="auto">Auto</option>
                        <option value="include">Include</option>
                        <option value="context">Keep as context</option>
                        <option value="exclude">Exclude</option>
                      </select>
                    </label>

                    {sheet.interpretation.recommendation === "keep_as_context" && (
                      <div className="rounded-lg bg-muted/20 p-2 text-xs text-muted-foreground">
                        Kept with the workbook as provenance/context only. This sheet will not
                        generate Knowledge candidates.
                      </div>
                    )}

                    {sheet.selected &&
                      sheet.interpretation.recommendation === "include" &&
                      sheet.grid.headers.length > 0 && (
                      <>
                        <SheetMappingSummary
                          sheet={sheet}
                          onToggleReview={() =>
                            updateSheet(sheet.sheetName, {
                              mappingReviewOpen: !sheet.mappingReviewOpen,
                            })
                          }
                        />
                        {sheet.mappingReviewOpen && reviewHeaders.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <p className="text-xs text-[hsl(16_70%_40%)]">
                              Review ambiguous mappings for “{sheet.sheetName}”.
                            </p>
                            {reviewHeaders.map((header) => (
                              <ColumnMappingRow
                                key={header}
                                header={header}
                                value={sheet.mapping[header] ?? { dest: "skip" }}
                                suggestion={sheet.suggestions[header]}
                                onChange={(next) =>
                                  updateSheetColumn(sheet.sheetName, header, next)
                                }
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={defaultUnscoped}
                onChange={(e) => setDefaultUnscoped(e.target.checked)}
              />
              Rows without jurisdiction → Unscoped
            </label>
            <div className="rounded-lg bg-muted/30 p-2 max-h-48 overflow-auto text-xs space-y-1">
              {drafts.slice(0, 8).map((d) => {
                const attrKeys = Object.keys(d.attributes);
                return (
                  <div key={`${d.sheet_name}-${d.source_row}`} className="space-y-0.5">
                    <div className="flex justify-between gap-2">
                      <span className="truncate font-medium">
                        {d.sheet_name ? `[${d.sheet_name}] ` : ""}
                        {d.title}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {d.applicability.jurisdictions.join("|") ||
                          (d.applicability.unscoped ? "unscoped" : "missing applicability")}
                      </span>
                    </div>
                    {attrKeys.length > 0 && (
                      <p className="text-muted-foreground truncate">
                        attrs: {attrKeys.slice(0, 6).join(", ")}
                        {attrKeys.length > 6 ? ` +${attrKeys.length - 6}` : ""}
                      </p>
                    )}
                  </div>
                );
              })}
              {drafts.length > 8 && (
                <p className="text-muted-foreground">…and {drafts.length - 8} more</p>
              )}
            </div>
            <Button
              size="sm"
              className="shadow-primary-btn border-0"
              disabled={busy || readyCount === 0 || selectedSheets.length === 0}
              onClick={createFromSheet}
            >
              {bulkCreate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add {readyCount} to review
              {selectedSheets.length > 1 ? ` from ${selectedSheets.length} sheets` : ""}
            </Button>
          </div>
        )}
      </section>

      {intakeMode === "manual" && (
      <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
        <h2 className="font-medium text-sm">Manual entry</h2>
        <p className="text-xs text-muted-foreground">
          Create a single platform candidate. Applicability is required. Critic always runs.
        </p>
        <Input
          placeholder="Title"
          value={manualTitle}
          onChange={(e) => setManualTitle(e.target.value)}
        />
        <Input
          placeholder="Summary"
          value={manualSummary}
          onChange={(e) => setManualSummary(e.target.value)}
        />
        <Textarea
          placeholder="Body"
          value={manualBody}
          onChange={(e) => setManualBody(e.target.value)}
          rows={5}
        />
        <ApplicabilityFields value={manualApplicability} onChange={setManualApplicability} />
        <Button
          size="sm"
          className="shadow-primary-btn border-0"
          disabled={busy}
          onClick={createManual}
        >
          {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Create candidate + run critic
        </Button>
      </section>
      )}
    </div>
  );
}
