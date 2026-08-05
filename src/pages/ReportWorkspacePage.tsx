import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileDown, Lock, Trash2 } from "lucide-react";
import { StandardPageWithBack } from "@/components/design-system/StandardPageWithBack";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { Button } from "@/components/ui/button";
import { ReportAiSummary } from "@/components/reports/ReportAiSummary";
import { ReportKpiRow } from "@/components/reports/ReportKpiRow";
import { ReportTrendChart } from "@/components/reports/ReportTrendChart";
import { ReportAttentionList } from "@/components/reports/ReportAttentionList";
import {
  ReportComplianceSection,
  ReportEvidenceSection,
  ReportNotesSection,
  ReportSpacesSection,
  ReportTasksSection,
} from "@/components/reports/ReportSections";
import {
  useReportInstance,
  useReportInstances,
} from "@/hooks/useReportInstances";
import { useReportLiveData } from "@/hooks/useReportLiveData";
import { getReportTemplate, resolveReportSections } from "@/lib/reports/templates";
import { openReportPrintWindow } from "@/lib/reports/exportHtml";
import { createReportId } from "@/lib/reports/storage";
import type {
  ChartAnnotation,
  ReportInstance,
  ReportSnapshot,
} from "@/lib/reports/types";
import { BarChart3 } from "lucide-react";
import { toast } from "sonner";

export default function ReportWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { instance } = useReportInstance(id);
  const { save, remove, finalize } = useReportInstances();

  const [draft, setDraft] = useState<ReportInstance | null>(null);

  useEffect(() => {
    if (instance) setDraft(instance);
  }, [instance]);

  const live = useReportLiveData({
    propertyIds: draft?.propertyIds ?? [],
    dateRangePreset: draft?.dateRangePreset ?? "30d",
    templateId: draft?.templateId,
  });

  const isFinalized = draft?.status === "finalized";
  const template = draft ? getReportTemplate(draft.templateId) : null;
  const sections = useMemo(() => {
    if (!draft) return [];
    return resolveReportSections(draft.templateId, live.isSingleProperty);
  }, [draft, live.isSingleProperty]);

  const display = useMemo(() => {
    if (!draft) return null;
    if (isFinalized && draft.snapshot) {
      return {
        kpis: draft.snapshot.kpis,
        previousKpis: undefined,
        trend: draft.snapshot.trend,
        attention: draft.snapshot.attention,
        taskRows: draft.snapshot.taskRows,
        complianceRows: draft.snapshot.complianceRows,
        spaceRows: draft.snapshot.spaceRows,
      };
    }
    return {
      kpis: live.kpis,
      previousKpis: live.previousKpis,
      trend: live.trend,
      attention: live.attention,
      taskRows: live.taskRows,
      complianceRows: live.complianceRows,
      spaceRows: live.spaceRows,
    };
  }, [draft, isFinalized, live]);

  const persist = useCallback(
    (next: ReportInstance) => {
      setDraft(next);
      save(next);
    },
    [save]
  );

  const buildSnapshot = useCallback((): ReportSnapshot | null => {
    if (!draft || !display) return null;
    return {
      frozenAt: new Date().toISOString(),
      kpis: display.kpis,
      briefParagraph: draft.aiSummary || live.brief,
      trend: display.trend,
      attention: display.attention,
      taskRows: display.taskRows,
      complianceRows: display.complianceRows,
      spaceRows: display.spaceRows,
    };
  }, [draft, display, live.brief]);

  const handleFinalize = () => {
    if (!draft || !id) return;
    const snapshot = buildSnapshot();
    if (!snapshot) return;
    const next = finalize(id, snapshot);
    if (next) {
      setDraft(next);
      toast.success("Report finalized — numbers are frozen");
    }
  };

  const handleExport = () => {
    if (!draft) return;
    let toExport = draft;
    if (!isFinalized) {
      const snapshot = buildSnapshot();
      if (snapshot) {
        toExport = {
          ...draft,
          snapshot,
          aiSummary: draft.aiSummary || snapshot.briefParagraph,
        };
      }
    }
    openReportPrintWindow(toExport);
    toast.message("Print dialog opened — choose Save as PDF if needed");
  };

  const handleAddAnnotation = (periodKey: string, note: string) => {
    if (!draft || isFinalized) return;
    const annotation: ChartAnnotation = {
      id: createReportId(),
      periodKey,
      note,
      createdAt: new Date().toISOString(),
    };
    persist({
      ...draft,
      annotations: [...draft.annotations, annotation],
    });
  };

  if (!id) {
    return (
      <StandardPageWithBack title="Report" backTo="/reports">
        <EmptyState
          icon={BarChart3}
          title="Missing report"
          description="No report id in the URL."
          action={{ label: "Back to Reports", onClick: () => navigate("/reports") }}
        />
      </StandardPageWithBack>
    );
  }

  if (!draft) {
    if (live.isLoading) {
      return (
        <StandardPageWithBack title="Report" backTo="/reports">
          <LoadingState message="Opening workspace…" />
        </StandardPageWithBack>
      );
    }
    return (
      <StandardPageWithBack title="Report" backTo="/reports">
        <EmptyState
          icon={BarChart3}
          title="Report not found"
          description="This workspace may have been deleted or belongs to another organisation."
          action={{ label: "Back to Reports", onClick: () => navigate("/reports") }}
        />
      </StandardPageWithBack>
    );
  }

  return (
    <StandardPageWithBack
      title={draft.title}
      subtitle={`${template?.title ?? "Report"} · ${
        isFinalized ? "Finalized" : "Draft · live data"
      }`}
      backTo="/reports"
      maxWidth="lg"
      icon={<BarChart3 className="h-6 w-6" />}
      action={
        <div className="flex items-center gap-2">
          {!isFinalized && (
            <Button type="button" variant="outline" size="sm" onClick={handleFinalize}>
              <Lock className="mr-1.5 h-3.5 w-3.5" />
              Finalize
            </Button>
          )}
          <Button type="button" size="sm" onClick={handleExport}>
            <FileDown className="mr-1.5 h-3.5 w-3.5" />
            Export PDF
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pb-16">
        {display && (
          <ReportKpiRow kpis={display.kpis} previousKpis={display.previousKpis} />
        )}

        {sections.includes("ai_summary") && (
          <ReportAiSummary
            text={draft.aiSummary}
            editable={!isFinalized}
            onChange={(aiSummary) => persist({ ...draft, aiSummary })}
          />
        )}

        {sections.includes("trend") && display && (
          <ReportTrendChart
            trend={display.trend}
            annotations={draft.annotations}
            canAnnotate={!isFinalized}
            onAddAnnotation={handleAddAnnotation}
          />
        )}

        {sections.includes("attention") && display && (
          <ReportAttentionList items={display.attention} />
        )}

        {sections.includes("tasks") && display && (
          <ReportTasksSection rows={display.taskRows} />
        )}

        {sections.includes("compliance") && display && (
          <ReportComplianceSection rows={display.complianceRows} />
        )}

        {sections.includes("spaces") && display && (
          <ReportSpacesSection rows={display.spaceRows} />
        )}

        {sections.includes("evidence") && <ReportEvidenceSection />}

        {sections.includes("notes") && (
          <ReportNotesSection
            notes={draft.notes}
            readOnly={isFinalized}
            onChange={(notes) => persist({ ...draft, notes })}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-4">
          <p className="text-xs text-muted-foreground">
            {isFinalized
              ? `Frozen ${draft.finalizedAt ? new Date(draft.finalizedAt).toLocaleString() : ""}`
              : "Draft updates as live data changes until you finalize."}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-[#EB6834] hover:text-[#EB6834]"
            onClick={() => {
              remove(draft.id);
              toast.message("Report deleted");
              navigate("/reports");
            }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>
    </StandardPageWithBack>
  );
}
