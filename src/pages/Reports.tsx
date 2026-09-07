import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, BarChart3, Plus } from "lucide-react";
import { StandardPage } from "@/components/design-system/StandardPage";
import { LoadingState } from "@/components/design-system/LoadingState";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PropertyWorkspaceLayout,
  WorkspaceSectionHeading,
  WorkspaceSurfaceCard,
} from "@/components/property-workspace";
import { PropertyAvatarChip } from "@/components/reports/PropertyAvatarChip";
import { ReportAiSummary } from "@/components/reports/ReportAiSummary";
import { ReportIllustration } from "@/components/reports/ReportIllustration";
import { ReportKpiRow } from "@/components/reports/ReportKpiRow";
import { useReportLiveData } from "@/hooks/useReportLiveData";
import { useReportInstances } from "@/hooks/useReportInstances";
import { DATE_RANGE_OPTIONS } from "@/lib/reports/dateRange";
import { REPORT_TEMPLATES } from "@/lib/reports/templates";
import {
  REPORT_EMPTY_ILLUSTRATION,
  REPORT_EMPTY_WASH,
  REPORT_TEMPLATE_CARD_TINT,
  REPORT_TEMPLATE_ILLUSTRATION,
  REPORT_TEMPLATE_WASH,
} from "@/lib/reportIllustrations";
import type {
  ReportDateRangePreset,
  ReportTemplateId,
} from "@/lib/reports/types";
import { cn } from "@/lib/utils";

export default function Reports() {
  const navigate = useNavigate();
  const [dateRangePreset, setDateRangePreset] =
    useState<ReportDateRangePreset>("30d");
  const [propertyId, setPropertyId] = useState<string>("all");

  const propertyIds = useMemo(
    () => (propertyId === "all" ? [] : [propertyId]),
    [propertyId]
  );

  const live = useReportLiveData({ propertyIds, dateRangePreset });
  const { instances, createFromTemplate } = useReportInstances();
  const showPropertyChrome = live.properties.length > 1;

  const propertyById = useMemo(() => {
    const map = new Map(
      live.properties
        .filter((p) => typeof p.id === "string")
        .map((p) => [p.id as string, p])
    );
    return map;
  }, [live.properties]);

  const handleOpenTemplate = (
    templateId: ReportTemplateId,
    kpiSeed?: "attention" | "completed" | "overdue" | "upcoming"
  ) => {
    let aiSummary = live.brief;

    if (kpiSeed === "overdue") {
      aiSummary = `${live.scopeLabel} has ${live.kpis.overdue} overdue task${
        live.kpis.overdue === 1 ? "" : "s"
      } requiring attention. ${live.brief}`;
    } else if (kpiSeed === "upcoming") {
      aiSummary = `${live.kpis.upcoming} upcoming item${
        live.kpis.upcoming === 1 ? "" : "s"
      } in the next window. ${live.brief}`;
    }

    const instance = createFromTemplate({
      templateId,
      propertyIds,
      dateRangePreset,
      scopeLabel: live.scopeLabel,
      aiSummary,
    });
    navigate(`/reports/${instance.id}`);
  };

  if (live.isLoading) {
    return (
      <StandardPage
        title="Reports"
        icon={<BarChart3 className="h-6 w-6" />}
        maxWidth="full"
        contentClassName="w-full max-w-[1480px]"
      >
        <LoadingState message="Loading reports…" />
      </StandardPage>
    );
  }

  const contextColumn = (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <Select
          value={dateRangePreset}
          onValueChange={(v) => setDateRangePreset(v as ReportDateRangePreset)}
        >
          <SelectTrigger className="w-full border-0 bg-card/70 shadow-e1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showPropertyChrome ? (
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger className="w-full border-0 bg-card/70 shadow-e1">
              <SelectValue placeholder="Property" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All properties</SelectItem>
              {live.properties.map((p) => (
                <SelectItem key={p.id!} value={p.id!}>
                  {p.nickname?.trim() || p.address?.trim() || "Property"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {showPropertyChrome && propertyId !== "all"
          ? (() => {
              const p = propertyById.get(propertyId);
              if (!p) return null;
              return (
                <PropertyAvatarChip
                  name={p.nickname?.trim() || p.address?.trim() || "Property"}
                  thumbnailUrl={p.thumbnail_url}
                  iconName={p.icon_name}
                  iconColorHex={p.icon_color_hex}
                />
              );
            })()
          : null}
      </div>

      <ReportAiSummary
        text={live.brief}
        className="border border-primary/15 bg-[hsl(185_35%_95%)]/90"
      />
      <ReportKpiRow
        className="sm:grid-cols-2"
        kpis={live.kpis}
        previousKpis={live.previousKpis}
        onSelect={(seed) => {
          const templateId: ReportTemplateId =
            seed === "upcoming" ? "compliance" : "maintenance";
          handleOpenTemplate(templateId, seed);
        }}
      />
    </div>
  );

  const templatesSection = (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <WorkspaceSectionHeading className="mb-0">Templates</WorkspaceSectionHeading>
        <p className="text-xs text-muted-foreground">
          Opens a live workspace — not a PDF
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => handleOpenTemplate(template.id)}
            className={cn(
              "group flex w-full flex-col overflow-hidden rounded-xl text-left shadow-e1",
              "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-e2 active:translate-y-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              REPORT_TEMPLATE_CARD_TINT[template.id]
            )}
          >
            <ReportIllustration
              src={REPORT_TEMPLATE_ILLUSTRATION[template.id]}
              washClassName={REPORT_TEMPLATE_WASH[template.id]}
              className="aspect-[5/4] w-full rounded-none"
              imgClassName="p-3 transition-transform duration-300 ease-out group-hover:scale-105"
            />
            <div className="flex flex-col gap-1 p-3.5 pt-2.5">
              <span className="font-medium leading-snug text-foreground">
                {template.title}
              </span>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {template.question}
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary-deep">
                Open workspace
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );

  const workColumn = (
    <div className="space-y-8">
      <section>
        <WorkspaceSectionHeading>Recent reports</WorkspaceSectionHeading>
        {instances.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl bg-[hsl(185_30%_94%)] px-5 py-8 text-center shadow-e1 sm:flex-row sm:text-left">
            <ReportIllustration
              src={REPORT_EMPTY_ILLUSTRATION}
              washClassName={REPORT_EMPTY_WASH}
              className="h-28 w-28 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                No saved workspaces yet
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open a template to start one — it stays editable until you
                finalize and export.
              </p>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {instances.slice(0, 12).map((r) => {
              const scoped =
                showPropertyChrome && r.propertyIds.length === 1
                  ? propertyById.get(r.propertyIds[0])
                  : null;
              const scopedName = scoped
                ? scoped.nickname?.trim() ||
                  scoped.address?.trim() ||
                  "Property"
                : null;

              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/reports/${r.id}`)}
                    className={cn(
                      "group flex h-full w-full flex-col overflow-hidden rounded-xl text-left shadow-e1",
                      "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-e2",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      REPORT_TEMPLATE_CARD_TINT[r.templateId]
                    )}
                  >
                    <ReportIllustration
                      src={REPORT_TEMPLATE_ILLUSTRATION[r.templateId]}
                      washClassName={REPORT_TEMPLATE_WASH[r.templateId]}
                      className="aspect-[5/4] w-full rounded-none"
                      imgClassName="p-3 transition-transform duration-200 group-hover:scale-105"
                    />
                    <div className="flex flex-1 flex-col gap-2 p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 truncate text-sm font-medium text-foreground">
                          {r.title}
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-card px-2 py-0.5 font-mono text-2xs uppercase tracking-wide shadow-e1",
                            r.status === "finalized"
                              ? "bg-success/30 text-success-foreground"
                              : "bg-warning/40 text-warning-foreground"
                          )}
                        >
                          {r.status === "finalized" ? "Final" : "Draft"}
                        </span>
                      </div>
                      {scoped && scopedName ? (
                        <PropertyAvatarChip
                          name={scopedName}
                          thumbnailUrl={scoped.thumbnail_url}
                          iconName={scoped.icon_name}
                          iconColorHex={scoped.icon_color_hex}
                        />
                      ) : showPropertyChrome && r.propertyIds.length === 0 ? (
                        <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                          Portfolio
                        </span>
                      ) : null}
                      <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          Updated{" "}
                          {formatDistanceToNow(new Date(r.updatedAt), {
                            addSuffix: true,
                          })}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );

  const actionColumn = (
    <div className="flex flex-col gap-4">
      <WorkspaceSurfaceCard
        title="Primary"
        description="Start a live report workspace"
      >
        <Button
          type="button"
          className="w-full gap-1.5"
          onClick={() => handleOpenTemplate("executive")}
        >
          <Plus className="h-4 w-4" />
          New workspace
        </Button>
      </WorkspaceSurfaceCard>
      <WorkspaceSurfaceCard
        title="How it works"
        description="Templates open an editable workspace. Finalize when you’re ready to export."
      >
        {null}
      </WorkspaceSurfaceCard>
    </div>
  );

  return (
    <StandardPage
      title="Reports"
      subtitle="Live workspaces — explore, then export"
      icon={<BarChart3 className="h-6 w-6" />}
      maxWidth="full"
      contentClassName="w-full max-w-[1480px]"
    >
      <div className="space-y-8">
        {templatesSection}
        <PropertyWorkspaceLayout
          contextColumn={contextColumn}
          workColumn={workColumn}
          actionColumn={actionColumn}
        />
      </div>
    </StandardPage>
  );
}
