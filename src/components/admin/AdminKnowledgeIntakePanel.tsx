import { useMemo, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import {
  useAdminBulkCreateKnowledgeCandidates,
  useAdminUploadKnowledgeIntakeFile,
  useAdminUpsertPlatformKnowledge,
} from "@/hooks/admin/useAdminKnowledge";
import {
  applyColumnMapping,
  parseSpreadsheetFile,
  suggestColumnMapping,
  type ColumnMapping,
  type KnowledgeColumnTarget,
  type SheetGrid,
} from "@/lib/knowledge/knowledgeSheetParse";
import { extractOfficePlainText } from "@/lib/officeDocumentText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EMPTY_APPLICABILITY,
  type KnowledgeApplicability,
} from "@/types/knowledge";
import { toast } from "sonner";

const TARGETS: { value: KnowledgeColumnTarget; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "summary", label: "Summary" },
  { value: "body", label: "Body" },
  { value: "jurisdictions", label: "Jurisdictions" },
  { value: "regions", label: "Regions" },
  { value: "languages", label: "Languages" },
  { value: "audiences", label: "Audiences" },
  { value: "skip", label: "Skip" },
];

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

export function AdminKnowledgeIntakePanel() {
  const uploadFile = useAdminUploadKnowledgeIntakeFile();
  const bulkCreate = useAdminBulkCreateKnowledgeCandidates();
  const upsert = useAdminUpsertPlatformKnowledge();

  const [grid, setGrid] = useState<SheetGrid | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [storage, setStorage] = useState<{
    bucket: string;
    path: string;
    filename: string;
    mime: string;
  } | null>(null);
  const [defaultUnscoped, setDefaultUnscoped] = useState(false);

  const [manualTitle, setManualTitle] = useState("");
  const [manualSummary, setManualSummary] = useState("");
  const [manualBody, setManualBody] = useState("");
  const [manualApplicability, setManualApplicability] = useState<KnowledgeApplicability>({
    ...EMPTY_APPLICABILITY,
  });

  const drafts = useMemo(() => {
    if (!grid) return [];
    return applyColumnMapping(grid, mapping, { defaultUnscoped });
  }, [grid, mapping, defaultUnscoped]);

  const readyCount = drafts.filter(
    (d) => d.applicability.jurisdictions.length > 0 || d.applicability.unscoped
  ).length;

  const handleFile = async (file: File) => {
    try {
      const name = file.name.toLowerCase();
      const isSheet = name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls");
      const isDoc =
        name.endsWith(".pdf") ||
        name.endsWith(".docx") ||
        name.endsWith(".doc") ||
        name.endsWith(".txt");

      const uploaded = await uploadFile.mutateAsync(file);
      setStorage(uploaded);

      if (isSheet) {
        const parsed = await parseSpreadsheetFile(file);
        if (!parsed.headers.length) {
          toast.error("Could not read columns from spreadsheet");
          return;
        }
        setGrid(parsed);
        setMapping(suggestColumnMapping(parsed.headers));
        toast.success(`Parsed ${parsed.rows.length} rows — review column mapping`);
        return;
      }

      if (isDoc) {
        let body = "";
        if (name.endsWith(".txt")) {
          body = await file.text();
        } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
          body = await extractOfficePlainText(await file.arrayBuffer(), file.name);
        } else {
          toast.message(
            "PDF stored as provenance. Paste text into Manual, or prefer DOCX/CSV for structured intake."
          );
        }
        setManualTitle(file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
        setManualBody(body.slice(0, 12000));
        toast.success("File stored — complete Manual form to create a candidate");
        return;
      }

      toast.error("Supported: CSV, XLSX, PDF, DOCX, TXT");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const createFromSheet = () => {
    if (!storage || !grid) return;
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
        columnMapping: mapping,
        candidates: candidates.map((c) => ({
          title: c.title,
          summary: c.summary || undefined,
          body: c.body || undefined,
          applicability: c.applicability,
          source_row: c.source_row,
        })),
      },
      {
        onSuccess: (res) => {
          toast.success(`Created ${res.created_count} candidates (critic running)`);
          setGrid(null);
          setMapping({});
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Create failed"),
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
        onError: (e) => toast.error(e instanceof Error ? e.message : "Create failed"),
      }
    );
  };

  const busy = uploadFile.isPending || bulkCreate.isPending || upsert.isPending;

  return (
    <div className="space-y-8">
      <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          <h2 className="font-medium text-sm">Upload</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Spreadsheet → map columns → create candidates. Docs stored as provenance. Never
          publishes. Critic runs on every create.
        </p>
        <label className="inline-flex cursor-pointer">
          <Button asChild size="sm" className="shadow-primary-btn border-0" disabled={busy}>
            <span>
              {uploadFile.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-2" />
              )}
              Choose file
            </span>
          </Button>
          <input
            type="file"
            className="hidden"
            accept=".csv,.xlsx,.xls,.pdf,.doc,.docx,.txt"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
        </label>

        {grid && (
          <div className="space-y-3 pt-2 border-t border-border/40">
            <p className="text-xs text-muted-foreground">
              {grid.rows.length} data rows · {readyCount} ready with applicability
            </p>
            <div className="space-y-2">
              {grid.headers.map((header) => (
                <div key={header} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono min-w-[8rem] truncate">{header}</span>
                  <select
                    className="rounded-md bg-muted/50 px-2 py-1"
                    value={mapping[header] ?? "skip"}
                    onChange={(e) =>
                      setMapping((m) => ({
                        ...m,
                        [header]: e.target.value as KnowledgeColumnTarget,
                      }))
                    }
                  >
                    {TARGETS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
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
              {drafts.slice(0, 8).map((d) => (
                <div key={d.source_row} className="flex justify-between gap-2">
                  <span className="truncate font-medium">{d.title}</span>
                  <span className="text-muted-foreground shrink-0">
                    {d.applicability.jurisdictions.join("|") ||
                      (d.applicability.unscoped ? "unscoped" : "missing applicability")}
                  </span>
                </div>
              ))}
              {drafts.length > 8 && (
                <p className="text-muted-foreground">…and {drafts.length - 8} more</p>
              )}
            </div>
            <Button
              size="sm"
              className="shadow-primary-btn border-0"
              disabled={busy || readyCount === 0}
              onClick={createFromSheet}
            >
              {bulkCreate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create {readyCount} candidates
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
        <h2 className="font-medium text-sm">Manual</h2>
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
    </div>
  );
}
