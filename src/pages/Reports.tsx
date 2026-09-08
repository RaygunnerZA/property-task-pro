import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, BarChart3, Building2, Calendar, Plus } from "lucide-react";
import { StandardPage } from "@/components/design-system/StandardPage";
import { LoadingState } from "@/components/design-system/LoadingState";
import { PageContentTitle } from "@/components/design-system/PageContentTitle";
import { Button } from "@/components/ui/button";
import {
  FilterBar,
  type FilterGroup,
  type FilterOption,
} from "@/components/ui/filters/FilterBar";
import {
  PropertyWorkspaceLayout,
  WorkspaceSectionHeading,
  WorkspaceSurfaceCard,
  WorkspaceTabList,
  WorkspaceTabTrigger,
} from "@/components/property-workspace";
import { PropertyAvatarChip } from "@/components/reports/PropertyAvatarChip";
import { ReportAiSummary } from "@/components/reports/ReportAiSummary";
import { ReportGroupCarousel } from "@/components/reports/ReportGroupCarousel";
import { ReportIllustration } from "@/components/reports/ReportIllustration";
import { ReportKpiRow } from "@/components/reports/ReportKpiRow";
import { useReportLiveData } from "@/hooks/useReportLiveData";
import { useReportInstances } from "@/hooks/useReportInstances";
import { DATE_RANGE_OPTIONS } from "@/lib/reports/dateRange";
import { emptyReportDesignFilters } from "@/lib/reports/designFilters";
import { templatesInGroup, type ReportGroupId } from "@/lib/reports/reportGroups";
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

type ReportsWorkTab = "groups" | "recent";

const RANGE_PREFIX = "range-";
const PROPERTY_PREFIX = "property-";

export default function Reports() {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const [dateRangePreset, setDateRangePreset] =
    useState<ReportDateRangePreset>("30d");
  const [propertyId, setPropertyId] = useState<string>("all");
  const [workTab, setWorkTab] = useState<ReportsWorkTab>("groups");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<ReportGroupId | null>(
    null
  );

  const propertyIds = useMemo(
    () => (propertyId === "all" ? [] : [propertyId]),
    [propertyId]
  );

  const live = useReportLiveData({
    propertyIds,
    dateRangePreset,
    spaceIds: [],
    taskStatuses: [],
  });
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

  const q = searchQuery.trim().toLowerCase();

  const filteredTemplates = useMemo(() => {
    let list = templatesInGroup(selectedGroupId);
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.question.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [selectedGroupId, q]);

  const filteredInstances = useMemo(() => {
    const list = instances.slice(0, 24);
    if (!q) return list;
    return list.filter((r) => r.title.toLowerCase().includes(q));
  }, [instances, q]);

  const primaryOptions: FilterOption[] = useMemo(
    () =>
      DATE_RANGE_OPTIONS.map((opt) => ({
        id: `${RANGE_PREFIX}${opt.value}`,
        label: opt.label.replace(/^Last /, ""),
        icon: <Calendar className="h-4 w-4" />,
      })),
    []
  );

  const secondaryGroups: FilterGroup[] = useMemo(() => {
    if (!showPropertyChrome) return [];
    return [
      {
        id: "property",
        label: "Property",
        options: [
          {
            id: `${PROPERTY_PREFIX}all`,
            label: "All properties",
            icon: <Building2 className="h-4 w-4" />,
          },
          ...live.properties
            .filter((p) => typeof p.id === "string")
            .map((p) => ({
              id: `${PROPERTY_PREFIX}${p.id}`,
              label: p.nickname?.trim() || p.address?.trim() || "Property",
              icon: <Building2 className="h-4 w-4" />,
            })),
        ],
      },
    ];
  }, [showPropertyChrome, live.properties]);

  const selectedFilters = useMemo(() => {
    const set = new Set<string>([`${RANGE_PREFIX}${dateRangePreset}`]);
    if (showPropertyChrome && propertyId !== "all") {
      set.add(`${PROPERTY_PREFIX}${propertyId}`);
    }
    return set;
  }, [dateRangePreset, propertyId, showPropertyChrome]);

  const handleFilterChange = useCallback(
    (filterId: string, selected: boolean) => {
      if (filterId.startsWith(RANGE_PREFIX)) {
        if (!selected) return;
        const value = filterId.slice(RANGE_PREFIX.length) as ReportDateRangePreset;
        setDateRangePreset(value);
        return;
      }
      if (filterId.startsWith(PROPERTY_PREFIX)) {
        const next = filterId.slice(PROPERTY_PREFIX.length);
        setPropertyId(selected ? next : "all");
      }
    },
    []
  );

  const resetFilters = useCallback(() => {
    setDateRangePreset("30d");
    setPropertyId("all");
  }, []);

  const hasExtraFilters =
    dateRangePreset !== "30d" || propertyId !== "all";

  const openWorkspace = (templateId: ReportTemplateId) => {
    const instance = createFromTemplate({
      templateId,
      propertyIds,
      dateRangePreset,
      scopeLabel: live.scopeLabel,
      aiSummary: live.brief,
      filters: emptyReportDesignFilters(templateId),
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
      <WorkspaceSurfaceCard
        title="Context"
        description="What this portfolio looks like right now"
      >
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">
              {live.kpis.needsAttention}
            </span>{" "}
            items need attention
          </li>
          <li>
            <span className="font-semibold text-foreground">{live.kpis.overdue}</span>{" "}
            overdue ·{" "}
            <span className="font-semibold text-foreground">{live.kpis.upcoming}</span>{" "}
            upcoming
          </li>
          <li>
            <span className="font-semibold text-foreground">{instances.length}</span>{" "}
            saved workspace{instances.length === 1 ? "" : "s"}
          </li>
          <li className="pt-1 text-2xs">
            Scope: {live.scopeLabel}. Open a template, then refine filters and
            download as CSV, Excel, or PDF.
          </li>
        </ul>
      </WorkspaceSurfaceCard>

      <ReportAiSummary
        text={live.brief}
        className="border border-primary/15 bg-[hsl(185_35%_95%)]/90"
      />

      <WorkspaceSurfaceCard
        title="Property Health"
        description="Pulse for the selected period"
      >
        <ReportKpiRow
          kpis={live.kpis}
          previousKpis={live.previousKpis}
          onSelect={(seed) => {
            const templateId: ReportTemplateId =
              seed === "upcoming" ? "compliance" : "maintenance";
            openWorkspace(templateId);
          }}
        />
      </WorkspaceSurfaceCard>
    </div>
  );

  const compactTemplates = (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <WorkspaceSectionHeading className="mb-0">
          {selectedGroupId ? "Templates in pack" : "Templates"}
        </WorkspaceSectionHeading>
        {selectedGroupId ? (
          <button
            type="button"
            className="text-2xs font-medium text-primary hover:underline"
            onClick={() => setSelectedGroupId(null)}
          >
            Show all
          </button>
        ) : null}
      </div>
      <ul className="space-y-2">
        {filteredTemplates.map((template) => {
          const Icon = template.icon;
          return (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => openWorkspace(template.id)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl p-2.5 text-left shadow-e1",
                  "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-e2",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  REPORT_TEMPLATE_CARD_TINT[template.id]
                )}
              >
                <ReportIllustration
                  src={REPORT_TEMPLATE_ILLUSTRATION[template.id]}
                  washClassName={REPORT_TEMPLATE_WASH[template.id]}
                  className="h-14 w-14 shrink-0 rounded-lg"
                  imgClassName="p-1.5"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <Icon
                      className="h-3.5 w-3.5 shrink-0 text-primary-deep"
                      aria-hidden
                    />
                    <span className="truncate text-sm font-medium text-foreground">
                      {template.title}
                    </span>
                  </span>
                  <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                    {template.question}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          );
        })}
        {filteredTemplates.length === 0 ? (
          <li className="py-4 text-sm text-muted-foreground">
            No templates match your search.
          </li>
        ) : null}
      </ul>
    </section>
  );

  const recentList =
    filteredInstances.length === 0 ? (
      <div className="flex flex-col items-center gap-4 rounded-xl bg-[hsl(185_30%_94%)] px-5 py-8 text-center shadow-e1 sm:flex-row sm:text-left">
        <ReportIllustration
          src={REPORT_EMPTY_ILLUSTRATION}
          washClassName={REPORT_EMPTY_WASH}
          className="h-24 w-24 shrink-0"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {q ? "No reports match your search" : "No saved workspaces yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {q
              ? "Try a different search, or open a template from By pack."
              : "Open a template to start a workspace — refine filters there, then download."}
          </p>
        </div>
      </div>
    ) : (
      <ul className="space-y-2">
        {filteredInstances.map((r) => {
          const scoped =
            showPropertyChrome && r.propertyIds.length === 1
              ? propertyById.get(r.propertyIds[0])
              : null;
          const scopedName = scoped
            ? scoped.nickname?.trim() || scoped.address?.trim() || "Property"
            : null;

          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => navigate(`/reports/${r.id}`)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl p-2.5 text-left shadow-e1",
                  "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-e2",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  REPORT_TEMPLATE_CARD_TINT[r.templateId]
                )}
              >
                <ReportIllustration
                  src={REPORT_TEMPLATE_ILLUSTRATION[r.templateId]}
                  washClassName={REPORT_TEMPLATE_WASH[r.templateId]}
                  className="h-14 w-14 shrink-0 rounded-lg"
                  imgClassName="p-1.5"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {r.title}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-card px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wide shadow-e1",
                        r.status === "finalized"
                          ? "bg-success/30 text-success-foreground"
                          : "bg-warning/40 text-warning-foreground"
                      )}
                    >
                      {r.status === "finalized" ? "Final" : "Draft"}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {scoped && scopedName ? (
                      <PropertyAvatarChip
                        name={scopedName}
                        thumbnailUrl={scoped.thumbnail_url}
                        iconName={scoped.icon_name}
                        iconColorHex={scoped.icon_color_hex}
                      />
                    ) : showPropertyChrome && r.propertyIds.length === 0 ? (
                      <span className="text-2xs font-medium uppercase tracking-wide">
                        Portfolio
                      </span>
                    ) : null}
                    <span>
                      Updated{" "}
                      {formatDistanceToNow(new Date(r.updatedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          );
        })}
      </ul>
    );

  const workColumn = (
    <div ref={panelRef} className="space-y-5">
      <PageContentTitle
        title="Reports"
        subtitle={`${live.scopeLabel} · browse packs, open a workspace`}
      />

      <div className="min-w-0">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search templates or recent reports"
          className="w-full rounded-[10px] border-0 bg-card/60 px-3 py-2.5 text-sm shadow-e1 outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label="Search reports"
        />
      </div>

      <FilterBar
        primaryOptions={primaryOptions}
        secondaryGroups={secondaryGroups}
        selectedFilters={selectedFilters}
        onFilterChange={handleFilterChange}
        primaryOptionLimit={0}
        clearPreservePrefixes={[]}
        collapseFilterChipAfterMs={2000}
        collapseInteractionRootRef={panelRef}
        showClearButton={hasExtraFilters}
        onClearAll={resetFilters}
      />

      <div>
        <WorkspaceSectionHeading>Operational view</WorkspaceSectionHeading>
        <WorkspaceTabList>
          <WorkspaceTabTrigger
            selected={workTab === "groups"}
            onClick={() => setWorkTab("groups")}
          >
            By pack
          </WorkspaceTabTrigger>
          <WorkspaceTabTrigger
            selected={workTab === "recent"}
            onClick={() => setWorkTab("recent")}
          >
            Recent ({instances.length})
          </WorkspaceTabTrigger>
        </WorkspaceTabList>
      </div>

      {workTab === "groups" ? (
        <div className="space-y-5">
          <ReportGroupCarousel
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
          />
          <div className="border-t border-border/30 pt-5">{compactTemplates}</div>
        </div>
      ) : (
        <div className="space-y-3">{recentList}</div>
      )}
    </div>
  );

  const actionColumn = (
    <div className="flex flex-col gap-4">
      <WorkspaceSurfaceCard
        title="Create report"
        description="Start an executive workspace with the filters above"
      >
        <Button
          type="button"
          className="btn-accent-vibrant w-full gap-1.5"
          onClick={() => openWorkspace("executive")}
        >
          <Plus className="h-4 w-4" />
          New workspace
        </Button>
      </WorkspaceSurfaceCard>

      <WorkspaceSurfaceCard
        title="Refine later"
        description="Inside a workspace you can change range, spaces, task status, and sections."
      >
        <p className="text-2xs leading-snug text-muted-foreground">
          Downloads (CSV, Excel, PDF) use whatever filters you set there.
        </p>
      </WorkspaceSurfaceCard>
    </div>
  );

  const workspace = (
    <>
      <div className="hidden workspace:block">
        <PropertyWorkspaceLayout
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
    <StandardPage
      title="Reports"
      subtitle="Browse packs — open a workspace, then download"
      icon={<BarChart3 className="h-6 w-6" />}
      maxWidth="full"
      contentClassName="w-full max-w-[1480px]"
    >
      {workspace}
    </StandardPage>
  );
}
