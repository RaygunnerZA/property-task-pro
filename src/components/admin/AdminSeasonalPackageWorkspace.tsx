import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SeasonalGuidanceCard } from "@/components/filla/SeasonalGuidanceCard";
import { useAdminKnowledgeQueue } from "@/hooks/admin/useAdminKnowledge";
import {
  publicUrlForPackageImage,
  uploadSeasonalPackageImage,
  useAdminApproveSeasonalPackage,
  useAdminArchiveSeasonalPackage,
  useAdminSeasonalPackage,
  useAdminUpsertSeasonalPackage,
} from "@/hooks/admin/useAdminSeasonalPackages";
import {
  EMPTY_CREATIVE,
  FUTURE_SEASONAL_SURFACES,
  SEASONAL_SURFACES,
  audienceLabel,
  canApproveSeasonalPackage,
  deriveSeasonalReleaseState,
  evaluateSeasonalReleaseGates,
  normalizeCreative,
  normalizeSurfaces,
  primarySeasonalAction,
  type SeasonalPackageAdminItem,
  type SeasonalPackageCreative,
  type SeasonalSurfaceId,
} from "@/lib/seasonal/seasonalPackageRelease";
import type { SeasonalCtaType, SeasonalPackage, SeasonalSeason } from "@/types/seasonalPackage";
import type { KnowledgeRow } from "@/types/knowledge";

type StepId = "foundation" | "content" | "creative" | "distribution" | "preview";

const STEPS: { id: StepId; label: string }[] = [
  { id: "foundation", label: "Foundation" },
  { id: "content", label: "Content" },
  { id: "creative", label: "Creative" },
  { id: "distribution", label: "Distribution" },
  { id: "preview", label: "Preview & approve" },
];

const CTA_OPTIONS: { id: SeasonalCtaType; label: string }[] = [
  { id: "create_task", label: "Create task" },
  { id: "upload_document", label: "Upload document" },
  { id: "add_asset", label: "Add asset" },
  { id: "open_knowledge", label: "Open Knowledge" },
  { id: "none", label: "None" },
];

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function jurisdictionFromApplicability(app: Record<string, unknown> | null | undefined): string {
  const jurisdictions = Array.isArray(app?.jurisdictions)
    ? (app?.jurisdictions as unknown[]).filter((j): j is string => typeof j === "string")
    : [];
  if (jurisdictions.length === 0) {
    return app?.unscoped === true ? "Unscoped" : "—";
  }
  return jurisdictions.join(", ");
}

type DraftItem = {
  id?: string;
  knowledge_id: string;
  tip_text: string;
  why_now: string;
  cta_type: SeasonalCtaType;
  cta_label: string;
  knowledge_title?: string | null;
  knowledge_status?: string | null;
  knowledge_applicability?: Record<string, unknown> | null;
};

type Props = {
  packageId: string | null;
  onBack: () => void;
  onSaved: (id: string) => void;
};

export function AdminSeasonalPackageWorkspace({ packageId, onBack, onSaved }: Props) {
  const detailQuery = useAdminSeasonalPackage(packageId);
  const publishedKnowledge = useAdminKnowledgeQueue(["published"]);
  const upsert = useAdminUpsertSeasonalPackage();
  const approve = useAdminApproveSeasonalPackage();
  const archive = useAdminArchiveSeasonalPackage();

  const [step, setStep] = useState<StepId>("foundation");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [season, setSeason] = useState<SeasonalSeason>("autumn");
  const [displayFrom, setDisplayFrom] = useState("");
  const [displayUntil, setDisplayUntil] = useState("");
  const [prepWindow, setPrepWindow] = useState("");
  const [audiences, setAudiences] = useState("owner, manager");
  const [jurisdictions, setJurisdictions] = useState("");
  const [surfaces, setSurfaces] = useState<SeasonalSurfaceId[]>([
    "home_inflow",
    "property_rail",
  ]);
  const [creative, setCreative] = useState<SeasonalPackageCreative>(EMPTY_CREATIVE);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [pickKnowledgeId, setPickKnowledgeId] = useState("");

  useEffect(() => {
    const detail = detailQuery.data;
    if (!detail) {
      if (!packageId) {
        const today = new Date();
        const y = today.getUTCFullYear();
        setSlug("");
        setTitle("");
        setIntroduction("");
        setSeason("autumn");
        setDisplayFrom(`${y}-08-15`);
        setDisplayUntil(`${y}-10-31`);
        setPrepWindow("Aug–Oct");
        setAudiences("owner, manager");
        setJurisdictions("");
        setSurfaces(["home_inflow", "property_rail"]);
        setCreative(EMPTY_CREATIVE);
        setItems([]);
      }
      return;
    }
    const pkg = detail.package;
    setSlug(pkg.slug);
    setTitle(pkg.title);
    setIntroduction(pkg.introduction);
    setSeason(pkg.season);
    setDisplayFrom(pkg.display_from);
    setDisplayUntil(pkg.display_until);
    setPrepWindow(pkg.prep_window_label ?? "");
    const aud = Array.isArray(pkg.applicability?.audiences)
      ? (pkg.applicability.audiences as string[]).join(", ")
      : "owner, manager";
    setAudiences(aud);
    const juris = Array.isArray(pkg.applicability?.jurisdictions)
      ? (pkg.applicability.jurisdictions as string[]).join(", ")
      : "";
    setJurisdictions(juris);
    setSurfaces(normalizeSurfaces(pkg.surfaces));
    setCreative(normalizeCreative(pkg.creative));
    setItems(
      detail.items.map((i) => ({
        id: i.id,
        knowledge_id: i.knowledge_id,
        tip_text: i.tip_text,
        why_now: i.why_now ?? "",
        cta_type: i.cta_type,
        cta_label: i.cta_label,
        knowledge_title: i.knowledge_title,
        knowledge_status: i.knowledge_status,
        knowledge_applicability: i.knowledge_applicability,
      }))
    );
  }, [detailQuery.data, packageId]);

  const applicability = useMemo(() => {
    const audienceList = audiences
      .split(/[,|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const jurisdictionList = jurisdictions
      .split(/[,|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      audiences: audienceList,
      jurisdictions: jurisdictionList,
      regions: [],
      languages: ["en"],
      unscoped: jurisdictionList.length === 0,
    };
  }, [audiences, jurisdictions]);

  const adminItems: SeasonalPackageAdminItem[] = items.map((item, index) => ({
    id: item.id ?? `new-${index}`,
    knowledge_id: item.knowledge_id,
    tip_output_id: null,
    tip_text: item.tip_text,
    why_now: item.why_now || null,
    cta_type: item.cta_type,
    cta_label: item.cta_label,
    display_order: index + 1,
    knowledge_title: item.knowledge_title ?? null,
    knowledge_summary: null,
    knowledge_status: item.knowledge_status ?? "published",
    knowledge_applicability: item.knowledge_applicability ?? null,
  }));

  const gates = evaluateSeasonalReleaseGates({
    title,
    introduction,
    display_from: displayFrom,
    display_until: displayUntil,
    surfaces,
    creative,
    items: adminItems,
  });
  const canApprove = canApproveSeasonalPackage(gates);
  const derived = deriveSeasonalReleaseState({
    status: detailQuery.data?.package.status ?? "draft",
    display_from: displayFrom,
    display_until: displayUntil,
    surfaces,
    creative,
    title,
    introduction,
    items: adminItems,
  });
  const primary = primarySeasonalAction(derived, displayFrom);

  const previewPackage: SeasonalPackage = {
    id: packageId ?? "preview",
    slug: slug || "preview",
    title: title || "Untitled package",
    introduction: introduction || "Introduction",
    season,
    hemisphere: "northern",
    display_from: displayFrom,
    display_until: displayUntil,
    urgency_band: "timely",
    prep_window_label: prepWindow || null,
    applicability,
    status: "draft",
    version: detailQuery.data?.package.version ?? 1,
    org_id: null,
    items: adminItems,
  };

  const publishedOptions = (publishedKnowledge.data ?? []) as KnowledgeRow[];
  const busy = upsert.isPending || approve.isPending || archive.isPending;

  const saveDraft = async () => {
    const nextSlug = slug.trim() || slugify(title);
    if (!nextSlug || !title.trim()) {
      toast.error("Title and slug are required");
      return;
    }
    try {
      const detail = await upsert.mutateAsync({
        id: packageId ?? undefined,
        slug: nextSlug,
        title: title.trim(),
        introduction: introduction.trim(),
        season,
        display_from: displayFrom,
        display_until: displayUntil,
        prep_window_label: prepWindow || null,
        applicability,
        surfaces,
        creative,
        items: items.map((item, index) => ({
          id: item.id,
          knowledge_id: item.knowledge_id,
          tip_text: item.tip_text,
          why_now: item.why_now || null,
          cta_type: item.cta_type,
          cta_label: item.cta_label,
          display_order: index + 1,
        })),
      });
      toast.success("Draft saved");
      if (detail?.package.id) onSaved(detail.package.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const runApprove = async () => {
    if (!packageId) {
      toast.error("Save the draft before approving");
      return;
    }
    if (!canApprove) {
      toast.error("Release gates are incomplete");
      return;
    }
    try {
      await saveDraft();
      await approve.mutateAsync(packageId);
      toast.success(
        primary.kind === "approve_schedule"
          ? "Package approved and scheduled"
          : "Package approved for publication"
      );
      setConfirmOpen(false);
      onSaved(packageId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    }
  };

  const addKnowledge = (knowledgeId: string) => {
    const k = publishedOptions.find((row) => row.id === knowledgeId);
    if (!k) return;
    if (items.some((i) => i.knowledge_id === knowledgeId)) {
      toast.error("Already in this package");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        knowledge_id: k.id,
        tip_text: (k.summary || k.title || "").trim(),
        why_now: "",
        cta_type: "create_task",
        cta_label: "Create task",
        knowledge_title: k.title,
        knowledge_status: k.status,
        knowledge_applicability: (k.applicability as Record<string, unknown>) ?? {},
      },
    ]);
    setPickKnowledgeId("");
  };

  const uploadImage = async (
    kind: "thumbnail" | "square" | "vertical" | "horizontal",
    file: File | null
  ) => {
    if (!file) return;
    const nextSlug = slug.trim() || slugify(title) || "untitled";
    try {
      const path = await uploadSeasonalPackageImage({ slug: nextSlug, kind, file });
      setCreative((prev) => {
        const next: SeasonalPackageCreative = { ...prev };
        if (kind === "thumbnail") next.thumbnail_path = path;
        if (kind === "square") next.square_path = path;
        if (kind === "vertical") next.vertical_path = path;
        if (kind === "horizontal") next.horizontal_path = path;
        if (next.status === "missing") next.status = "draft";
        return next;
      });
      toast.success(`${kind} uploaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  if (packageId && detailQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic"
          onClick={onBack}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Packages
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{title || "New seasonal package"}</p>
          <p className="text-[11px] text-muted-foreground">
            {derived.replace(/_/g, " ")} · {audienceLabel(applicability)}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic"
          disabled={busy}
          onClick={() => void saveDraft()}
        >
          Save draft
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {STEPS.map((s, index) => {
          const active = step === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-xs inline-flex items-center gap-1.5",
                active ? "bg-primary/15 text-primary" : "bg-muted/30 text-muted-foreground"
              )}
            >
              <span className="font-mono text-[10px]">{index + 1}</span>
              {s.label}
            </button>
          );
        })}
      </div>

      {step === "foundation" ? (
        <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs space-y-1 sm:col-span-2">
              <span className="text-muted-foreground">Title</span>
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!packageId && !slug) setSlug(slugify(e.target.value));
                }}
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Slug</span>
              <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Season</span>
              <select
                className="w-full h-9 rounded-md bg-background px-2 text-sm shadow-sm"
                value={season}
                onChange={(e) => setSeason(e.target.value as SeasonalSeason)}
              >
                {["spring", "summer", "autumn", "winter"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs space-y-1 sm:col-span-2">
              <span className="text-muted-foreground">Introduction</span>
              <Textarea
                value={introduction}
                onChange={(e) => setIntroduction(e.target.value)}
                rows={3}
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Display from</span>
              <Input
                type="date"
                value={displayFrom}
                onChange={(e) => setDisplayFrom(e.target.value)}
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Display until</span>
              <Input
                type="date"
                value={displayUntil}
                onChange={(e) => setDisplayUntil(e.target.value)}
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Prep window label</span>
              <Input value={prepWindow} onChange={(e) => setPrepWindow(e.target.value)} />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Audience (comma-separated)</span>
              <Input value={audiences} onChange={(e) => setAudiences(e.target.value)} />
            </label>
            <label className="text-xs space-y-1 sm:col-span-2">
              <span className="text-muted-foreground">
                Jurisdiction / region (blank = unscoped)
              </span>
              <Input value={jurisdictions} onChange={(e) => setJurisdictions(e.target.value)} />
            </label>
          </div>

          <div className="space-y-2 border-t border-border/30 pt-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Published Knowledge items
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                className="min-w-[14rem] flex-1 h-9 rounded-md bg-background px-2 text-sm shadow-sm"
                value={pickKnowledgeId}
                onChange={(e) => setPickKnowledgeId(e.target.value)}
              >
                <option value="">Select published Knowledge…</option>
                {publishedOptions.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.title}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                className="border-0 btn-neomorphic"
                disabled={!pickKnowledgeId}
                onClick={() => addKnowledge(pickKnowledgeId)}
              >
                Add
              </Button>
            </div>
            <ol className="space-y-2">
              {items.map((item, index) => (
                <li
                  key={`${item.knowledge_id}-${index}`}
                  className="rounded-lg bg-muted/30 px-3 py-2 text-xs space-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">
                        {index + 1}. {item.knowledge_title || item.knowledge_id}
                      </p>
                      <p className="text-muted-foreground">
                        {item.knowledge_status} ·{" "}
                        {jurisdictionFromApplicability(item.knowledge_applicability)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-destructive text-[11px]"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-0 btn-neomorphic text-[11px]"
                      disabled={index === 0}
                      onClick={() =>
                        setItems((prev) => {
                          const next = [...prev];
                          const tmp = next[index - 1];
                          next[index - 1] = next[index];
                          next[index] = tmp;
                          return next;
                        })
                      }
                    >
                      Up
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-0 btn-neomorphic text-[11px]"
                      disabled={index === items.length - 1}
                      onClick={() =>
                        setItems((prev) => {
                          const next = [...prev];
                          const tmp = next[index + 1];
                          next[index + 1] = next[index];
                          next[index] = tmp;
                          return next;
                        })
                      }
                    >
                      Down
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {step === "content" ? (
        <section className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add published Knowledge in Foundation first.
            </p>
          ) : null}
          {items.map((item, index) => (
            <div key={`${item.knowledge_id}-${index}`} className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
              <p className="text-sm font-medium">
                {item.knowledge_title || "Knowledge item"}
                <span className="ml-2 text-[10px] font-mono uppercase text-muted-foreground">
                  Package presentation · grounded in published Knowledge
                </span>
              </p>
              <label className="text-xs space-y-1 block">
                <span className="text-muted-foreground">Tip text</span>
                <Textarea
                  value={item.tip_text}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, tip_text: e.target.value } : row
                      )
                    )
                  }
                  rows={2}
                />
              </label>
              <label className="text-xs space-y-1 block">
                <span className="text-muted-foreground">Why now</span>
                <Input
                  value={item.why_now}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, why_now: e.target.value } : row
                      )
                    )
                  }
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs space-y-1">
                  <span className="text-muted-foreground">CTA type</span>
                  <select
                    className="w-full h-9 rounded-md bg-background px-2 text-sm shadow-sm"
                    value={item.cta_type}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row, i) =>
                          i === index
                            ? { ...row, cta_type: e.target.value as SeasonalCtaType }
                            : row
                        )
                      )
                    }
                  >
                    {CTA_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs space-y-1">
                  <span className="text-muted-foreground">CTA label</span>
                  <Input
                    value={item.cta_label}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, cta_label: e.target.value } : row
                        )
                      )
                    }
                  />
                </label>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {step === "creative" ? (
        <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Optional for Home / property rail. Required when Knowledge library is selected.
            Paths store in <code className="text-[10px]">packages/&#123;slug&#125;/</code> on
            knowledge-content-images.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">Status</span>
            {(["missing", "draft", "approved"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={creative.status === s ? "default" : "outline"}
                className={cn(
                  "h-8 border-0 text-xs",
                  creative.status === s ? "shadow-primary-btn" : "btn-neomorphic"
                )}
                onClick={() => setCreative((prev) => ({ ...prev, status: s }))}
              >
                {s}
              </Button>
            ))}
          </div>
          <label className="text-xs space-y-1 block">
            <span className="text-muted-foreground">Alt text</span>
            <Input
              value={creative.alt_text}
              onChange={(e) =>
                setCreative((prev) => ({ ...prev, alt_text: e.target.value }))
              }
            />
          </label>
          {(
            [
              ["thumbnail", "Thumbnail / concept", "thumbnail_path"],
              ["square", "Square", "square_path"],
              ["vertical", "Vertical", "vertical_path"],
              ["horizontal", "Horizontal", "horizontal_path"],
            ] as const
          ).map(([kind, label, pathKey]) => {
            const path = creative[pathKey];
            const url = publicUrlForPackageImage(path);
            return (
              <div key={kind} className="rounded-lg bg-muted/30 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium">{label}</p>
                  <label className="text-[11px] text-primary cursor-pointer hover:underline">
                    Upload
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => void uploadImage(kind, e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
                {path ? (
                  <p className="text-[10px] text-muted-foreground break-all">{path}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">No file</p>
                )}
                {url ? (
                  <img src={url} alt="" className="h-20 w-20 rounded-md object-cover shadow-sm" />
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}

      {step === "distribution" ? (
        <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Select in-app surfaces only. Website / newsletter / social stay future options.
          </p>
          <div className="space-y-2">
            {SEASONAL_SURFACES.map((surface) => {
              const checked = surfaces.includes(surface.id);
              return (
                <label
                  key={surface.id}
                  className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={(e) => {
                      setSurfaces((prev) =>
                        e.target.checked
                          ? [...prev, surface.id]
                          : prev.filter((id) => id !== surface.id)
                      );
                    }}
                  />
                  <span>
                    <span className="font-medium">{surface.label}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {surface.requiresApprovedCreative
                        ? "Requires approved square or horizontal image + alt text"
                        : "Image optional"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="space-y-1 opacity-60">
            {FUTURE_SEASONAL_SURFACES.map((surface) => (
              <label
                key={surface.id}
                className="flex items-center gap-2 rounded-lg bg-muted/20 px-3 py-2 text-sm"
              >
                <input type="checkbox" disabled />
                <span>
                  {surface.label}{" "}
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">
                    Coming later
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {step === "preview" ? (
        <section className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {surfaces.includes("home_inflow") || surfaces.includes("property_rail") ? (
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase text-muted-foreground">
                  {surfaces.includes("home_inflow") ? "Home card" : "Property strip"}
                </p>
                <SeasonalGuidanceCard
                  package={previewPackage}
                  variant={surfaces.includes("property_rail") && !surfaces.includes("home_inflow") ? "rail" : "feed"}
                />
              </div>
            ) : null}
            {surfaces.includes("knowledge_library") ? (
              <div className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-2">
                <p className="text-[10px] font-mono uppercase text-muted-foreground">
                  Knowledge library feature
                </p>
                {publicUrlForPackageImage(creative.square_path || creative.horizontal_path) ? (
                  <img
                    src={
                      publicUrlForPackageImage(
                        creative.square_path || creative.horizontal_path
                      ) ?? undefined
                    }
                    alt={creative.alt_text || title}
                    className="h-36 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-36 rounded-lg bg-muted/40 grid place-items-center text-xs text-muted-foreground">
                    Image required
                  </div>
                )}
                <p className="font-medium text-sm">{title || "Untitled"}</p>
                <p className="text-xs text-muted-foreground line-clamp-3">{introduction}</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-2">
            <p className="text-[10px] font-mono uppercase text-muted-foreground">
              Release checklist
            </p>
            <ul className="space-y-1.5">
              {gates.map((gate) => (
                <li key={gate.id} className="flex items-start gap-2 text-xs">
                  {gate.pass ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5" />
                  ) : (
                    <span className="mt-0.5 h-3.5 w-3.5 rounded-full bg-[hsl(16_82%_56%)]/30" />
                  )}
                  <span>
                    <span className={gate.pass ? "text-foreground" : "text-[hsl(16_72%_40%)]"}>
                      {gate.label}
                    </span>
                    {gate.detail ? (
                      <span className="block text-muted-foreground">{gate.detail}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-0 btn-neomorphic"
              disabled={busy}
              onClick={() => void saveDraft()}
            >
              Save draft
            </Button>
            <Button
              size="sm"
              className="shadow-primary-btn border-0"
              disabled={busy || !canApprove || !packageId}
              onClick={() => setConfirmOpen(true)}
            >
              {primary.kind === "approve_schedule"
                ? "Approve and schedule"
                : "Approve and publish package"}
            </Button>
            {packageId && detailQuery.data?.package.status !== "archived" ? (
              <Button
                size="sm"
                variant="outline"
                className="border-0 btn-neomorphic text-destructive"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("Archive this package? It will leave customer surfaces.")) {
                    return;
                  }
                  void archive.mutateAsync(packageId).then(
                    () => toast.success("Package archived"),
                    (e) => toast.error(e instanceof Error ? e.message : "Archive failed")
                  );
                }}
              >
                Archive
              </Button>
            ) : null}
          </div>

          {confirmOpen ? (
            <div className="rounded-xl bg-[hsl(16_82%_56%)]/10 p-4 space-y-3">
              <p className="text-sm font-medium">Confirm package approval</p>
              <p className="text-xs text-muted-foreground">
                Surfaces: {surfaces.join(", ") || "none"} · Window: {displayFrom} → {displayUntil}
                . Customer visibility still requires approved status and the display window.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="shadow-primary-btn border-0"
                  disabled={busy}
                  onClick={() => void runApprove()}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-0 btn-neomorphic"
                  onClick={() => setConfirmOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="flex justify-between">
        <Button
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic"
          disabled={STEPS.findIndex((s) => s.id === step) === 0}
          onClick={() => {
            const idx = STEPS.findIndex((s) => s.id === step);
            if (idx > 0) setStep(STEPS[idx - 1].id);
          }}
        >
          <ChevronDown className="h-3.5 w-3.5 rotate-90 mr-1" />
          Back
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic"
          disabled={STEPS.findIndex((s) => s.id === step) === STEPS.length - 1}
          onClick={() => {
            const idx = STEPS.findIndex((s) => s.id === step);
            if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].id);
          }}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
