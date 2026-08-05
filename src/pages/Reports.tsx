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
import { ReportAiSummary } from "@/components/reports/ReportAiSummary";
import { ReportKpiRow } from "@/components/reports/ReportKpiRow";
import { useReportLiveData } from "@/hooks/useReportLiveData";
import { useReportInstances } from "@/hooks/useReportInstances";
import { DATE_RANGE_OPTIONS } from "@/lib/reports/dateRange";
import { REPORT_TEMPLATES } from "@/lib/reports/templates";
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
      <StandardPage title="Reports" icon={<BarChart3 className="h-6 w-6" />}>
        <LoadingState message="Loading reports…" />
      </StandardPage>
    );
  }

  return (
    <StandardPage
      title="Reports"
      subtitle="Live workspaces — explore, then export"
      icon={<BarChart3 className="h-6 w-6" />}
      maxWidth="lg"
      action={
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          onClick={() => handleOpenTemplate("executive")}
        >
          <Plus className="h-4 w-4" />
          New workspace
        </Button>
      }
    >
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={dateRangePreset}
            onValueChange={(v) => setDateRangePreset(v as ReportDateRangePreset)}
          >
            <SelectTrigger className="w-[160px] border-0 bg-card/70 shadow-e1">
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

          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger className="w-[200px] border-0 bg-card/70 shadow-e1">
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
        </div>

        <div className="space-y-4">
          <ReportAiSummary text={live.brief} />
          <ReportKpiRow
            kpis={live.kpis}
            previousKpis={live.previousKpis}
            onSelect={(seed) => {
              const templateId: ReportTemplateId =
                seed === "upcoming" ? "compliance" : "maintenance";
              handleOpenTemplate(templateId, seed);
            }}
          />
        </div>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Templates</h2>
            <p className="text-xs text-muted-foreground">
              Opens a live workspace — not a PDF
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {REPORT_TEMPLATES.map((template) => {
              const Icon = template.icon;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleOpenTemplate(template.id)}
                  className={cn(
                    "group flex items-start gap-3 rounded-xl bg-card/70 p-4 text-left shadow-e1",
                    "transition-shadow hover:shadow-e2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {template.title}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {template.question}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/80">
                      {template.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Recent reports
          </h2>
          {instances.length === 0 ? (
            <div className="rounded-xl bg-card/50 p-5 text-sm text-muted-foreground shadow-e1">
              No saved workspaces yet. Open a template to start one — it stays
              editable until you finalize and export.
            </div>
          ) : (
            <ul className="divide-y divide-border/40 overflow-hidden rounded-xl bg-card/70 shadow-e1">
              {instances.slice(0, 12).map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/reports/${r.id}`)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {r.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.status === "finalized" ? "Finalized" : "Draft"} · Updated{" "}
                        {formatDistanceToNow(new Date(r.updatedAt), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </StandardPage>
  );
}
