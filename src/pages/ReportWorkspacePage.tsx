import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BarChart3, Lock, Trash2 } from "lucide-react";
import { StandardPageWithBack } from "@/components/design-system/StandardPageWithBack";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { Button } from "@/components/ui/button";
import {
  PropertyWorkspaceLayout,
  WorkspaceSurfaceCard,
} from "@/components/property-workspace";
import { ReportAiSummary } from "@/components/reports/ReportAiSummary";
import {
  ReportDesignPanel,
  type ReportDesignDraft,
} from "@/components/reports/ReportDesignPanel";
import { ReportExportActions } from "@/components/reports/ReportExportActions";
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
import { useSpaces } from "@/hooks/useSpaces";
import { getReportTemplate, resolveReportSections } from "@/lib/reports/templates";
import { emptyReportDesignFilters } from "@/lib/reports/designFilters";
import { downloadReportAs } from "@/lib/reports/exportFiles";
import { createReportId } from "@/lib/reports/storage";
import type {
  ChartAnnotation,
  ReportInstance,
  ReportSnapshot,
} from "@/lib/reports/types";
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
    spaceIds: draft?.filters?.spaceIds,
    taskStatuses: draft?.filters?.taskStatuses,
  });

  const spacePropertyId =
    draft?.propertyIds?.length === 1 ? draft.propertyIds[0] : undefined;
  const { spaces } = useSpaces(spacePropertyId);

  const isFinalized = draft?.status === "finalized";
  const template = draft ? getReportTemplate(draft.templateId) : null;
  const sections = useMemo(() => {
    if (!draft) return [];
    return resolveReportSections(
      draft.templateId,
      live.isSingleProperty,
      draft.filters?.sectionIds
    );
  }, [draft, live.isSingleProperty]);

  const designDraft: ReportDesignDraft | null = useMemo(() => {
    if (!draft) return null;
    return {
      templateId: draft.templateId,
      dateRangePreset: draft.dateRangePreset,
      propertyId: draft.propertyIds.length === 1 ? draft.propertyIds[0] : "all",
      filters: draft.filters ?? emptyReportDesignFilters(draft.templateId),
    };
  }, [draft]);

  const propertyOptions = useMemo(
    () =>
      live.properties
        .filter((p) => typeof p.id === "string")
        .map((p) => ({
          id: p.id as string,
          name: p.nickname?.trim() || p.address?.trim() || "Property",
        })),
    [live.properties]
  );

  const spaceOptions = useMemo(
    () =>
      spaces.map((s) => ({
        id: s.id,
        name: (s.name ?? "Space").trim() || "Space",
        propertyId: s.property_id,
      })),
    [spaces]
  );

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

  const applyDesign = useCallback(
    (next: ReportDesignDraft) => {
      if (!draft || isFinalized) return;
      const propertyIds = next.propertyId === "all" ? [] : [next.propertyId];
      persist({
        ...draft,
        templateId: next.templateId,
        dateRangePreset: next.dateRangePreset,
        propertyIds,
        filters: next.filters,
      });
    },
    [draft, isFinalized, persist]
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

  const prepareForExport = useCallback((): ReportInstance => {
    if (!draft) throw new Error("No draft");
    if (draft.status === "finalized" && draft.snapshot) return draft;
    const snapshot = buildSnapshot();
    if (!snapshot) return draft;
    return {
      ...draft,
      snapshot,
      aiSummary: draft.aiSummary || snapshot.briefParagraph,
    };
  }, [draft, buildSnapshot]);

  const handleExport = useCallback(
    (format: "csv" | "excel" | "pdf" = "pdf") => {
      if (!draft) return;
      const toExport = prepareForExport();
      downloadReportAs(toExport, format);
      toast.success(
        format === "csv"
          ? "CSV downloaded"
          : format === "excel"
            ? "Excel file downloaded"
            : "PDF downloaded"
      );
    },
    [draft, prepareForExport]
  );

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

  const pageShell = (body: ReactNode) => (
    <StandardPageWithBack
      title="Report"
      backTo="/reports"
      maxWidth="full"
      contentClassName="w-full max-w-[1480px]"
    >
      {body}
    </StandardPageWithBack>
  );

  if (!id) {
    return pageShell(
      <EmptyState
        icon={BarChart3}
        title="Missing report"
        description="No report id in the URL."
        action={{ label: "Back to Reports", onClick: () => navigate("/reports") }}
      />
    );
  }

  if (!draft) {
    if (live.isLoading) {
      return pageShell(<LoadingState message="Opening workspace…" />);
    }
    return pageShell(
      <EmptyState
        icon={BarChart3}
        title="Report not found"
        description="This workspace may have been deleted or belongs to another organisation."
        action={{ label: "Back to Reports", onClick: () => navigate("/reports") }}
      />
    );
  }

  const contextColumn = (
    <div className="space-y-4">
      <WorkspaceSurfaceCard
        title="Context"
        description="What this workspace covers"
      >
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">
              {template?.title ?? "Report"}
            </span>
          </li>
          <li>
            Status:{" "}
            <span className="font-semibold text-foreground">
              {isFinalized ? "Finalized" : "Draft · live data"}
            </span>
          </li>
          <li className="pt-1 text-2xs">
            Edit in the middle column. Download CSV, Excel, or PDF from the action
            rail when ready.
          </li>
        </ul>
      </WorkspaceSurfaceCard>
      {display ? (
        <WorkspaceSurfaceCard title="Property Health" description="Pulse metrics">
          <ReportKpiRow
            kpis={display.kpis}
            previousKpis={display.previousKpis}
          />
        </WorkspaceSurfaceCard>
      ) : null}
    </div>
  );

  const workColumn = (
    <div className="space-y-5 pb-8">
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

      <p className="text-xs text-muted-foreground">
        {isFinalized
          ? `Frozen ${draft.finalizedAt ? new Date(draft.finalizedAt).toLocaleString() : ""}`
          : "Draft updates as live data changes until you finalize."}
      </p>
    </div>
  );

  const actionColumn = (
    <div className="flex flex-col gap-4">
      <WorkspaceSurfaceCard title="Primary" description="Lock numbers before sharing">
        <div className="flex flex-col gap-2">
          {!isFinalized && (
            <Button type="button" variant="outline" className="btn-neomorphic w-full" onClick={handleFinalize}>
              <Lock className="mr-1.5 h-3.5 w-3.5" />
              Finalize
            </Button>
          )}
          {isFinalized ? (
            <p className="text-2xs leading-snug text-muted-foreground">
              Numbers are frozen. Downloads use the finalized snapshot.
            </p>
          ) : (
            <p className="text-2xs leading-snug text-muted-foreground">
              Drafts export with a live snapshot. Finalize to freeze values.
            </p>
          )}
        </div>
      </WorkspaceSurfaceCard>

      <ReportExportActions
        instance={draft}
        prepareInstance={prepareForExport}
        onExport={handleExport}
      />

      {!isFinalized && designDraft ? (
        <ReportDesignPanel
          draft={designDraft}
          onChange={applyDesign}
          properties={propertyOptions}
          spaces={spaceOptions}
          showPropertySelect={propertyOptions.length > 1}
        />
      ) : null}

      <WorkspaceSurfaceCard title="Danger zone" description="Remove this workspace">
        <Button
          type="button"
          variant="ghost"
          className="w-full text-[#EB6834] hover:text-[#EB6834]"
          onClick={() => {
            remove(draft.id);
            toast.message("Report deleted");
            navigate("/reports");
          }}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
      </WorkspaceSurfaceCard>
    </div>
  );

  const workspace = (
    <>
      <div className="hidden workspace:block">
        <PropertyWorkspaceLayout
          embedMobileStack={false}
          contextColumn={contextColumn}
          workColumn={workColumn}
          actionColumn={actionColumn}
        />
      </div>
      <div className="flex flex-col gap-6 workspace:hidden">
        {actionColumn}
        {workColumn}
        {contextColumn}
      </div>
    </>
  );

  return (
    <StandardPageWithBack
      title={draft.title}
      subtitle={`${template?.title ?? "Report"} · ${
        isFinalized ? "Finalized" : "Draft · live data"
      }`}
      backTo="/reports"
      maxWidth="full"
      contentClassName="w-full max-w-[1480px]"
      icon={<BarChart3 className="h-6 w-6" />}
    >
      {workspace}
    </StandardPageWithBack>
  );
}
