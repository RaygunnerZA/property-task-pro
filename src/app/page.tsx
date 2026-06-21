import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { ThirdColumnConcertina } from "@/components/layout/ThirdColumnConcertina";
import { LeftColumn } from "@/components/layout/LeftColumn";
import { RightColumn } from "@/components/layout/RightColumn";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { MessageDetailPanel } from "@/components/messaging/MessageDetailPanel";
import {
  SignalFeedDetailPanel,
  type SignalFeedDetailSnapshot,
  type WorkbenchAttentionSelectPayload,
} from "@/components/dashboard/SignalFeedDetailPanel";
import { IntakeModal } from "@/components/intake/IntakeModal";
import { AssistantPanelBody } from "@/components/assistant/AssistantPanel";
import { useAssistantContext } from "@/contexts/AssistantContext";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useQueryClient } from "@tanstack/react-query";
import { buildTasksByDate } from "@/lib/calendarDayMeta";
import { isAllPropertiesActive } from "@/utils/propertyFilter";
import { getEffectiveDefaultPropertyId } from "@/lib/propertySelectorPreferences";
import type { IntakeMode } from "@/types/intake";
import {
  ISSUES_OPEN_TASK_FILTER_IDS,
  propertyHubAssetsPath,
  propertyHubIssuesPath,
  propertyHubPeoplePath,
  propertyHubRecordsPath,
  propertyHubSpacesPath,
  WORKBENCH_ISSUES_FILTER_QUERY,
  WORKBENCH_PANEL_TAB_QUERY,
  WORKBENCH_RECORDS_VIEW_QUERY,
  WORKBENCH_TAB_ALIAS_QUERY,
  WORKBENCH_TASK_PRIORITY_QUERY,
  normalizeRecordsView,
  normalizeWorkbenchIssuesFilter,
  normalizeWorkbenchPanelTab,
  type RecordsView,
  type WorkbenchIssuesFilter,
  type WorkbenchPanelTab,
  type DashboardWorkbenchPanel,
} from "@/lib/propertyRoutes";
import { RecordsActionRail } from "@/components/records/RecordsActionRail";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { IntakeActionButtonPair } from "@/components/intake/IntakeActionButton";
import { AddToFillaDropPanel } from "@/components/intake/AddToFillaDropPanel";
import { AddToFillaSheet } from "@/components/intake/AddToFillaSheet";
import { useIntakeItems } from "@/hooks/useIntakeItems";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkbenchControlsProvider, useWorkbenchControls } from "@/contexts/WorkbenchControlsContext";
import {
  WorkbenchGradientHeader,
  createGradientHeaderStyle,
} from "@/components/layout/WorkbenchGradientHeader";
import { WORKBENCH_SECTION_ROUTES } from "@/lib/mainNavigation";
import { LAYOUT_BREAKPOINTS } from "@/lib/layoutBreakpoints";

export type { DashboardWorkbenchPanel };

export type DashboardProps = {
  /** `home` = Today hub with workspace links; otherwise a dedicated workbench page. */
  workbenchPanel?: DashboardWorkbenchPanel;
};

function workbenchRouteForTab(tab: WorkbenchPanelTab): string {
  return WORKBENCH_SECTION_ROUTES[tab];
}

const LG_BREAKPOINT = LAYOUT_BREAKPOINTS.layout;

/** Use the live address bar when mutating query params so we never drop `property` or revert scope if React's `searchParams` is one frame behind (e.g. Hall selected then Compliance tab immediately). */
function workbenchSearchParamsFromBrowser(fallback: URLSearchParams): URLSearchParams {
  if (typeof window === "undefined") {
    return new URLSearchParams(fallback);
  }
  return new URLSearchParams(window.location.search);
}

type SelectedItem =
  | { type: "task"; id: string }
  | { type: "message"; id: string }
  | { type: "signal"; id: string; snapshot: SignalFeedDetailSnapshot }
  | null;

type ExpandedSection = 'details' | 'assistant' | null;

function WorkbenchFiltersSync({
  filterIds,
  enabled = true,
}: {
  filterIds: string[] | null | undefined;
  enabled?: boolean;
}) {
  const { setSelectedFilters } = useWorkbenchControls();
  useEffect(() => {
    if (!enabled || !filterIds) return;
    setSelectedFilters(new Set(filterIds));
  }, [enabled, filterIds, setSelectedFilters]);
  return null;
}

export default function Dashboard({ workbenchPanel = "home" }: DashboardProps) {
  const navigate = useNavigate();
  const isDedicatedWorkbench = workbenchPanel !== "home";
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [intakeMinimized, setIntakeMinimized] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState<boolean>(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [workbenchIntakeMode, setWorkbenchIntakeMode] = useState<IntakeMode>("report_issue");
  const [modalInitialIntakeMode, setModalInitialIntakeMode] = useState<IntakeMode>("report_issue");
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
  const { isOpen: assistantOpen, closeAssistant, openAssistant, assistantContext, messages, proposedAction, loading, onSendMessage, onConfirmAction, onRejectAction } = useAssistantContext();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [filterToApply, setFilterToApply] = useState<string | null>(null);
  const [assistantFiltersToApply, setAssistantFiltersToApply] = useState<string[] | null>(null);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set());
  const tabBeforeCreateTaskRef = useRef<string>("issues");
  const prevSearchStringRef = useRef<string | undefined>(undefined);
  const workbenchPropertyInitRef = useRef(false);
  const prevWorkbenchPropertyIdRef = useRef<string | null | undefined>(undefined);
  /** User chose ALL (multi-org); URL may still show ?property= for a frame — don't collapse selection until URL clears. */
  const pendingPropertyParamClearRef = useRef(false);

  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  const [recordsReanalyseBusy, setRecordsReanalyseBusy] = useState(false);
  const [showAddToFilla, setShowAddToFilla] = useState(false);
  const { data: readyIntakeItems = [] } = useIntakeItems("ready");

  // Fetch data once at the Dashboard level
  const { data: tasks = [], isLoading: tasksLoading } = useTasksQuery();
  const { data: properties = [], isLoading: propertiesLoading } = usePropertiesQuery();

  // URL ↔ selection: ?property=id opens the single-property workbench; clearing the param (e.g. Hub) widens to all.
  useEffect(() => {
    if (properties.length === 0) return;
    const curSearch = searchParams.toString();
    const prevSearch = prevSearchStringRef.current;
    prevSearchStringRef.current = curSearch;

    const pid = searchParams.get("property");
    const allIds = properties.map((p) => p.id);

    // One-property org: "all properties" is still that single id — keep ?property= so sidebar
    // (Compliance, Documents, …) and shared links stay scoped to the hub property.
    if (!pid && allIds.length === 1) {
      const next = new URLSearchParams(searchParams);
      next.set("property", allIds[0]);
      setSearchParams(next, { replace: true });
      return;
    }

    if (pid) {
      if (properties.some((p) => p.id === pid)) {
        setSelectedPropertyIds((prev) => {
          const skipStaleUrlWhileClearing =
            pendingPropertyParamClearRef.current && isAllPropertiesActive(prev, allIds);
          if (skipStaleUrlWhileClearing) {
            return prev;
          }
          if (isAllPropertiesActive(prev, allIds)) {
            return prev;
          }
          const skipMulti = prev.size > 1 && !isAllPropertiesActive(prev, allIds);
          if (skipMulti) {
            return prev;
          }
          return new Set([pid]);
        });
      } else {
        const next = new URLSearchParams(searchParams);
        next.delete("property");
        setSearchParams(next, { replace: true });
      }
      return;
    }

    pendingPropertyParamClearRef.current = false;

    if (
      prevSearch !== undefined &&
      prevSearch.includes("property=") &&
      !curSearch.includes("property=")
    ) {
      setSelectedPropertyIds(new Set(allIds));
      return;
    }

    setSelectedPropertyIds((prev) => {
      if (prev.size > 0) return prev;
      if (allIds.length > 1 && orgId) {
        const effectiveDefault = getEffectiveDefaultPropertyId(orgId);
        if (effectiveDefault && allIds.includes(effectiveDefault)) {
          return new Set([effectiveDefault]);
        }
      }
      return new Set(allIds);
    });

    // Seed ?property= from pinned/learned default only on first URL sync — not when other
    // query params change (e.g. issuesFilter) while the user has widened scope to ALL.
    if (prevSearch === undefined && allIds.length > 1 && orgId && !pid) {
      const effectiveDefault = getEffectiveDefaultPropertyId(orgId);
      if (effectiveDefault && allIds.includes(effectiveDefault)) {
        const next = new URLSearchParams(searchParams);
        next.set("property", effectiveDefault);
        setSearchParams(next, { replace: true });
      }
    }
  }, [properties, searchParams, setSearchParams, orgId]);

  const handlePropertySelectionChange = useCallback(
    (next: Set<string>) => {
      setSelectedPropertyIds(next);
      if (properties.length === 0) return;
      const allIds = properties.map((p) => p.id);
      if (isAllPropertiesActive(next, allIds) && allIds.length > 1) {
        pendingPropertyParamClearRef.current = true;
      } else {
        pendingPropertyParamClearRef.current = false;
      }
      const params = workbenchSearchParamsFromBrowser(searchParams);
      params.delete(WORKBENCH_PANEL_TAB_QUERY);
      params.delete(WORKBENCH_RECORDS_VIEW_QUERY);
      if (next.size === 1) {
        params.set("property", Array.from(next)[0]);
        setSearchParams(params, { replace: true });
      } else if (isAllPropertiesActive(next, allIds)) {
        if (allIds.length === 1) {
          params.set("property", allIds[0]);
        } else {
          params.delete("property");
        }
        setSearchParams(params, { replace: true });
      } else {
        setSearchParams(params, { replace: true });
      }
    },
    [properties, searchParams, setSearchParams]
  );

  /** Dedicated routes lock the panel; Home no longer hosts tab state (legacy `panelTab` redirects). */
  const activeTab = useMemo((): WorkbenchPanelTab => {
    if (isDedicatedWorkbench) return workbenchPanel;
    return "issues";
  }, [isDedicatedWorkbench, workbenchPanel]);

  const recordsView = useMemo((): RecordsView => {
    return normalizeRecordsView(searchParams.get(WORKBENCH_RECORDS_VIEW_QUERY));
  }, [searchParams]);

  const issuesFilter = useMemo((): WorkbenchIssuesFilter => {
    return normalizeWorkbenchIssuesFilter(searchParams.get(WORKBENCH_ISSUES_FILTER_QUERY));
  }, [searchParams]);

  const taskPriorityUrgent = searchParams.get(WORKBENCH_TASK_PRIORITY_QUERY) === "urgent";

  const navigateToWorkbenchSection = useCallback(
    (tab: WorkbenchPanelTab) => {
      const params = workbenchSearchParamsFromBrowser(searchParams);
      params.delete(WORKBENCH_PANEL_TAB_QUERY);
      params.delete(WORKBENCH_TAB_ALIAS_QUERY);
      if (tab !== "records") {
        params.delete(WORKBENCH_RECORDS_VIEW_QUERY);
      }
      const qs = params.toString();
      navigate(`${workbenchRouteForTab(tab)}${qs ? `?${qs}` : ""}`);
    },
    [navigate, searchParams]
  );

  const handleWorkbenchTabChange = useCallback(
    (tab: string) => {
      const normalized = normalizeWorkbenchPanelTab(tab);
      if (workbenchPanel === "home") {
        navigateToWorkbenchSection(normalized);
        return;
      }
      if (normalized === workbenchPanel) return;
      navigateToWorkbenchSection(normalized);
    },
    [workbenchPanel, navigateToWorkbenchSection]
  );

  const handleRecordsViewChange = useCallback(
    (next: RecordsView) => {
      const params = workbenchSearchParamsFromBrowser(searchParams);
      params.delete(WORKBENCH_PANEL_TAB_QUERY);
      params.delete(WORKBENCH_TAB_ALIAS_QUERY);
      if (next === "all") {
        params.delete(WORKBENCH_RECORDS_VIEW_QUERY);
      } else {
        params.set(WORKBENCH_RECORDS_VIEW_QUERY, next);
      }
      if (workbenchPanel === "records") {
        setSearchParams(params, { replace: true });
        return;
      }
      const qs = params.toString();
      navigate(`/records${qs ? `?${qs}` : ""}`);
    },
    [workbenchPanel, navigate, searchParams, setSearchParams]
  );

  const handleIssuesFilterChange = useCallback(
    (next: WorkbenchIssuesFilter) => {
      const params = workbenchSearchParamsFromBrowser(searchParams);
      params.delete(WORKBENCH_TASK_PRIORITY_QUERY);
      if (next === "all") {
        params.delete(WORKBENCH_ISSUES_FILTER_QUERY);
      } else {
        params.set(WORKBENCH_ISSUES_FILTER_QUERY, next);
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const effectiveTaskListFiltersToApply = useMemo(() => {
    if (workbenchPanel === "home") return undefined;
    if (assistantFiltersToApply != null) return assistantFiltersToApply;
    if (activeTab !== "issues") return undefined;
    if (issuesFilter === "open") {
      const ids: string[] = [...ISSUES_OPEN_TASK_FILTER_IDS];
      if (taskPriorityUrgent) ids.push("filter-urgent");
      return ids;
    }
    if (issuesFilter === "done") return ["filter-status-done"];
    return undefined;
  }, [workbenchPanel, assistantFiltersToApply, activeTab, issuesFilter, taskPriorityUrgent]);

  /** Legacy hub URLs with `panelTab` / `tab` → dedicated workbench routes. */
  useEffect(() => {
    if (workbenchPanel !== "home") return;
    const panel = searchParams.get(WORKBENCH_PANEL_TAB_QUERY);
    const alias = searchParams.get(WORKBENCH_TAB_ALIAS_QUERY);
    if (!panel && !alias) return;
    const merged = normalizeWorkbenchPanelTab(panel, alias);
    navigateToWorkbenchSection(merged);
  }, [workbenchPanel, searchParams, navigateToWorkbenchSection]);

  /** Property-scoped hub lives on `/issues` (Attention) — redirect legacy `/?property=`. */
  useEffect(() => {
    if (workbenchPanel !== "home") return;
    const pid = searchParams.get("property");
    if (!pid) return;
    if (searchParams.get(WORKBENCH_PANEL_TAB_QUERY) || searchParams.get(WORKBENCH_TAB_ALIAS_QUERY)) {
      return;
    }
    const params = workbenchSearchParamsFromBrowser(searchParams);
    params.delete(WORKBENCH_PANEL_TAB_QUERY);
    params.delete(WORKBENCH_TAB_ALIAS_QUERY);
    const qs = params.toString();
    navigate(`/issues${qs ? `?${qs}` : ""}`, { replace: true });
  }, [workbenchPanel, searchParams, navigate]);

  // When property scope changes on a dedicated workbench page, strip stale panelTab query keys.
  useEffect(() => {
    if (!isDedicatedWorkbench || properties.length === 0) return;
    const pid = searchParams.get("property");
    if (!workbenchPropertyInitRef.current) {
      workbenchPropertyInitRef.current = true;
      prevWorkbenchPropertyIdRef.current = pid;
      return;
    }
    const prev = prevWorkbenchPropertyIdRef.current;
    if (pid === prev) return;
    prevWorkbenchPropertyIdRef.current = pid;
    const params = new URLSearchParams(searchParams);
    if (!params.has(WORKBENCH_PANEL_TAB_QUERY) && !params.has(WORKBENCH_TAB_ALIAS_QUERY)) return;
    params.delete(WORKBENCH_PANEL_TAB_QUERY);
    params.delete(WORKBENCH_TAB_ALIAS_QUERY);
    setSearchParams(params, { replace: true });
  }, [isDedicatedWorkbench, searchParams, setSearchParams, properties]);

  const tasksByDate = useMemo(() => buildTasksByDate(tasks), [tasks]);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= LG_BREAKPOINT);
    };
    
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Sync concertina with AssistantContext: when openAssistant is called, expand assistant section
  useEffect(() => {
    if (assistantOpen && isLargeScreen) {
      setExpandedSection('assistant');
    }
  }, [assistantOpen, isLargeScreen]);

  // When transitioning from large to small screen, close any auto-opened create modal
  useEffect(() => {
    if (!isLargeScreen) setShowCreateTask(false);
  }, [isLargeScreen]);

  useEffect(() => {
    const onApplyFilters = (event: Event) => {
      const customEvent = event as CustomEvent<{ filterIds?: string[] }>;
      const filterIds = Array.isArray(customEvent.detail?.filterIds)
        ? customEvent.detail.filterIds
        : [];
      setAssistantFiltersToApply(filterIds);
      handleWorkbenchTabChange("issues");
      window.setTimeout(() => setAssistantFiltersToApply(null), 100);
    };
    window.addEventListener("filla:assistant-apply-task-filters", onApplyFilters);
    return () => window.removeEventListener("filla:assistant-apply-task-filters", onApplyFilters);
  }, [handleWorkbenchTabChange]);

  useEffect(() => {
    const onOpenTask = (event: Event) => {
      const customEvent = event as CustomEvent<{ taskId?: string }>;
      const taskId = customEvent.detail?.taskId;
      if (!taskId) return;

      handleWorkbenchTabChange("issues");
      setSelectedItem({ type: "task", id: taskId });
      if (isLargeScreen) {
        setExpandedSection("details");
        setIntakeMinimized(true);
      }
    };

    window.addEventListener("filla:assistant-open-task", onOpenTask);
    return () => window.removeEventListener("filla:assistant-open-task", onOpenTask);
  }, [isLargeScreen, handleWorkbenchTabChange]);

  const handleTaskClick = (taskId: string) => {
    if (isLargeScreen) {
      setExpandedSection('details');
      setIntakeMinimized(true);
    }
    setSelectedItem({ type: 'task', id: taskId });
  };

  const handleAttentionItemSelect = useCallback(
    (payload: WorkbenchAttentionSelectPayload) => {
      if (isLargeScreen) {
        setExpandedSection("details");
        setIntakeMinimized(true);
      }
      if (payload.kind === "message") {
        setSelectedItem({ type: "message", id: payload.messageId });
      } else {
        setSelectedItem({
          type: "signal",
          id: payload.snapshot.id,
          snapshot: payload.snapshot,
        });
      }
    },
    [isLargeScreen]
  );

  const handleOpenIntake = (mode: IntakeMode = "report_issue") => {
    tabBeforeCreateTaskRef.current = activeTab;
    if (isLargeScreen) {
      setWorkbenchIntakeMode(mode);
      setExpandedSection(null);
      setIntakeMinimized(false);
      setSelectedItem(null);
      return;
    }
    setModalInitialIntakeMode(mode);
    setShowCreateTask(true);
  };

  const handleCreateTaskOpenChange = (open: boolean) => {
    setShowCreateTask(open);
    if (!open) {
      handleWorkbenchTabChange(tabBeforeCreateTaskRef.current);
    }
  };

  const handleTaskCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    handleWorkbenchTabChange(tabBeforeCreateTaskRef.current);
  };

  const handleMessageClick = (messageId: string) => {
    if (isLargeScreen) {
      setExpandedSection("details");
      setIntakeMinimized(true);
    }
    setSelectedItem({ type: "message", id: messageId });
  };

  const handleClosePanel = () => {
    if (isLargeScreen) {
      setExpandedSection((section) => (section === "details" ? null : section));
      setIntakeMinimized(false);
      setSelectedItem(null);
      return;
    }
    setSelectedItem(null);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    // Auto-switch to schedule tab when a date is selected
    if (date) {
      handleWorkbenchTabChange("schedule");
    }
  };

  const resolveScopedPropertyId = useCallback((): string | null => {
    if (selectedPropertyIds.size === 1) {
      return Array.from(selectedPropertyIds)[0];
    }
    return searchParams.get("property");
  }, [selectedPropertyIds, searchParams]);

  const handleFilterClick = (filterId: string) => {
    const pid = resolveScopedPropertyId();

    if (filterId === "show-spaces-urgent") {
      if (pid) navigate(`${propertyHubSpacesPath(pid)}?workTab=issues&urgent=1`);
      return;
    }
    if (filterId === "show-assets-attention") {
      if (pid) navigate(`${propertyHubAssetsPath(pid)}&attention=1`);
      return;
    }
    if (filterId === "show-spaces") {
      if (pid) navigate(propertyHubSpacesPath(pid));
      else navigate("/properties");
      return;
    }
    if (filterId === "show-assets") {
      if (pid) navigate(propertyHubAssetsPath(pid));
      else navigate("/assets");
      return;
    }
    if (filterId === "show-people") {
      navigate(pid ? propertyHubPeoplePath(pid) : "/settings/team");
      return;
    }
    if (filterId === "show-records") {
      if (pid) {
        navigate(propertyHubRecordsPath(pid));
        return;
      }
      handleWorkbenchTabChange("records");
      return;
    }

    handleWorkbenchTabChange("issues");
    if (filterId === "show-tasks") {
      handleIssuesFilterChange("open");
      return;
    }
    if (filterId === "show-tasks-urgent") {
      const params = workbenchSearchParamsFromBrowser(searchParams);
      params.delete(WORKBENCH_PANEL_TAB_QUERY);
      params.delete(WORKBENCH_TAB_ALIAS_QUERY);
      params.set(WORKBENCH_ISSUES_FILTER_QUERY, "open");
      params.set(WORKBENCH_TASK_PRIORITY_QUERY, "urgent");
      const qs = params.toString();
      navigate(`/issues${qs ? `?${qs}` : ""}`);
      return;
    }
    // Set the filter to apply, which will trigger TaskList to apply it.
    setFilterToApply(filterId);
    // Reset filterToApply after a brief moment to allow the filter to be toggled again
    setTimeout(() => setFilterToApply(null), 100);
  };

  const showWorkbenchDetailSection =
    selectedItem?.type === "task" ||
    selectedItem?.type === "message" ||
    selectedItem?.type === "signal";
  const detailsSectionTitle =
    selectedItem?.type === "task"
      ? "Task Details"
      : selectedItem?.type === "message"
        ? "Message"
        : selectedItem?.type === "signal"
          ? "Signal"
          : "Details";

  const intakeScopedPropertyId = useMemo(() => {
    if (selectedPropertyIds.size !== 1) return undefined;
    return Array.from(selectedPropertyIds)[0];
  }, [selectedPropertyIds]);

  const handleRecordsReanalyse = useCallback(async () => {
    if (!orgId || !intakeScopedPropertyId) return;
    setRecordsReanalyseBusy(true);
    try {
      const { error } = await supabase.functions.invoke("ai-doc-reanalyse", {
        body: { org_id: orgId, property_id: intakeScopedPropertyId, overwrite: false },
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["property-documents"] });
    } catch {
      // Non-blocking: errors surface when user opens a document
    } finally {
      setRecordsReanalyseBusy(false);
    }
  }, [orgId, intakeScopedPropertyId, queryClient]);

  const thirdColumnContent = isLargeScreen ? (
    <div className="flex min-w-0 max-w-full flex-col pt-4 pr-1 pb-0 pl-1">
      {activeTab === "records" && intakeScopedPropertyId ? (
        <div className="pb-[16px] shrink-0">
          <RecordsActionRail
            propertyId={intakeScopedPropertyId}
            onOpenIntake={handleOpenIntake}
            onAddComplianceRule={() =>
              window.dispatchEvent(new CustomEvent("filla:records-open-rule-modal"))
            }
            onUploadClick={() =>
              window.dispatchEvent(new CustomEvent("filla:records-open-upload"))
            }
            onReanalyse={handleRecordsReanalyse}
            reanalyseBusy={recordsReanalyseBusy}
          />
        </div>
      ) : intakeMinimized ? (
        /* ── Minimised intake — keep primary CTAs bold (matches TaskPanel toolbar) */
        <div className="mb-2 shrink-0 w-full min-w-0">
          <div
            className={cn(
              "w-full min-h-12 h-12 rounded-[15px] bg-background overflow-visible",
              "shadow-[inset_2px_1px_2px_0px_rgba(0,0,0,0.1),inset_-1px_-2px_2px_0px_rgba(255,255,255,0.61)]"
            )}
          >
            <div className="px-2 py-[6px]">
              <IntakeActionButtonPair
                variant="toolbar"
                layout="grid"
                onAddRecord={() => handleOpenIntake("add_record")}
                onReportIssue={() => handleOpenIntake("report_issue")}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="pb-[20px]">
          <IntakeModal
            open={true}
            onOpenChange={() => undefined}
            onTaskCreated={handleTaskCreated}
            defaultPropertyId={intakeScopedPropertyId}
            variant="column"
            headless
            intakeMode={workbenchIntakeMode}
            onIntakeModeChange={setWorkbenchIntakeMode}
          />
        </div>
      )}
      <ThirdColumnConcertina
        sections={[
          ...(showWorkbenchDetailSection && selectedItem
            ? [
                {
                  id: "details" as const,
                  title: detailsSectionTitle,
                  isExpanded: expandedSection === "details",
                  onToggle: () => setExpandedSection((s) => (s === "details" ? null : "details")),
                  children:
                    selectedItem.type === "task" ? (
                      <TaskDetailPanel
                        taskId={selectedItem.id}
                        onClose={handleClosePanel}
                        variant="column"
                      />
                    ) : selectedItem.type === "message" ? (
                      <MessageDetailPanel
                        messageId={selectedItem.id}
                        onClose={handleClosePanel}
                        variant="column"
                      />
                    ) : (
                      <SignalFeedDetailPanel
                        snapshot={selectedItem.snapshot}
                        onClose={handleClosePanel}
                        variant="column"
                        onOpenIntake={handleOpenIntake}
                      />
                    ),
                },
              ]
            : []),
          {
            id: "add-to-filla",
            title: "",
            variant: "static" as const,
            children: (
              <AddToFillaDropPanel onReviewClick={() => setShowAddToFilla(true)} />
            ),
          },
          {
            id: 'assistant',
            title: 'Filla AI',
            isExpanded: expandedSection === 'assistant',
            onToggle: () => {
              setExpandedSection((s) => {
                if (s === 'assistant') {
                  closeAssistant();
                  return null;
                }
                return 'assistant';
              });
            },
            children: (
              <AssistantPanelBody
                context={assistantContext}
                messages={messages}
                proposedAction={proposedAction}
                loading={loading}
                onSendMessage={onSendMessage}
                onConfirmAction={onConfirmAction}
                onRejectAction={onRejectAction}
                showContextHeader={true}
                className="min-h-[200px]"
              />
            ),
          },
        ]}
      />
    </div>
  ) : undefined;

  // Primary color for dashboard header (from design system: #8EC9CE); single-property filter uses that property's colour
  const primaryColor = "#8EC9CE";
  const headerAccentColor = useMemo(() => {
    const ids = properties.map((p) => p.id);
    if (
      properties.length <= 1 ||
      isAllPropertiesActive(selectedPropertyIds, ids) ||
      selectedPropertyIds.size !== 1
    ) {
      return primaryColor;
    }
    const onlyId = Array.from(selectedPropertyIds)[0];
    const p = properties.find((x) => x.id === onlyId) as
      | { icon_color_hex?: string | null }
      | undefined;
    const hex = p?.icon_color_hex?.trim();
    return hex || primaryColor;
  }, [properties, selectedPropertyIds, primaryColor]);

  const headerStyle = createGradientHeaderStyle(headerAccentColor);

  const defaultWorkbenchPropertyId = useMemo(() => {
    if (selectedPropertyIds.size === 1) return Array.from(selectedPropertyIds)[0];
    return "all";
  }, [selectedPropertyIds]);

  /** Property hub / ?property= scope — no assignee or due-date defaults (Anyone, any date). */
  const workbenchPropertyScopeId = useMemo(() => {
    const pid = searchParams.get("property");
    if (pid) return pid;
    if (properties.length === 1) return properties[0].id;
    if (
      selectedPropertyIds.size === 1 &&
      properties.length > 0 &&
      !isAllPropertiesActive(selectedPropertyIds, properties.map((p) => p.id))
    ) {
      return Array.from(selectedPropertyIds)[0];
    }
    return null;
  }, [searchParams, properties, selectedPropertyIds]);

  const useEmptyWorkbenchFilters =
    workbenchPanel === "home" || workbenchPropertyScopeId != null;

  const workbenchControlsKey =
    workbenchPanel === "home"
      ? "home"
      : `${workbenchPanel}-${workbenchPropertyScopeId ?? "org"}`;

  const handleAskFilla = useCallback(
    (query: string) => {
      openAssistant();
      if (isLargeScreen) {
        setExpandedSection("assistant");
        setIntakeMinimized(true);
      }
      if (query) onSendMessage(query);
    },
    [openAssistant, isLargeScreen, onSendMessage]
  );

  return (
    <WorkbenchControlsProvider
      key={workbenchControlsKey}
      defaultPropertyId={defaultWorkbenchPropertyId}
      initialFilters={useEmptyWorkbenchFilters ? new Set<string>() : undefined}
    >
      <WorkbenchFiltersSync
        filterIds={effectiveTaskListFiltersToApply}
        enabled={workbenchPanel !== "home"}
      />
      <div className="dashboard-workbench min-h-screen bg-background w-full max-w-full overflow-x-hidden">
        <DualPaneLayout
          header={
            <WorkbenchGradientHeader
              headerStyle={headerStyle}
              properties={properties}
              tasks={tasks}
              selectedPropertyIds={selectedPropertyIds}
              onPropertySelectionChange={handlePropertySelectionChange}
              onFilterClick={handleFilterClick}
              onAskFilla={handleAskFilla}
            />
          }
        leftColumn={
          <ErrorBoundary
            regionTitle="Today & sidebar"
            onRetryReset={() => {
              void queryClient.invalidateQueries();
            }}
          >
          <LeftColumn 
            tasks={tasks}
            properties={properties}
            tasksLoading={tasksLoading}
            propertiesLoading={propertiesLoading}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            tasksByDate={tasksByDate}
            onFilterClick={handleFilterClick}
            selectedPropertyIds={selectedPropertyIds}
            onPropertySelectionChange={handlePropertySelectionChange}
            onOpenIntake={handleOpenIntake}
          />
          </ErrorBoundary>
        }
        rightColumn={
          <ErrorBoundary
            regionTitle="Workbench"
            onRetryReset={() => {
              void queryClient.invalidateQueries();
            }}
          >
          <RightColumn 
            tasks={tasks}
            properties={properties}
            tasksLoading={tasksLoading}
            onTaskClick={handleTaskClick}
            onMessageClick={handleMessageClick}
            onAttentionItemSelect={handleAttentionItemSelect}
            selectedItem={selectedItem}
            activeTab={activeTab}
            onTabChange={handleWorkbenchTabChange}
            selectedDate={selectedDate}
            filterToApply={filterToApply}
            filtersToApply={effectiveTaskListFiltersToApply}
            issuesFilter={issuesFilter}
            onIssuesFilterChange={handleIssuesFilterChange}
            selectedPropertyIds={selectedPropertyIds}
            onOpenIntake={handleOpenIntake}
            recordsView={recordsView}
            onRecordsViewChange={handleRecordsViewChange}
            workbenchPanel={workbenchPanel}
          />
          </ErrorBoundary>
        }
        thirdColumn={
          thirdColumnContent ? (
            <ErrorBoundary
              regionTitle="Details & Filla AI"
              onRetryReset={() => {
                void queryClient.invalidateQueries();
              }}
            >
              {thirdColumnContent}
            </ErrorBoundary>
          ) : undefined
        }
      />
      
      {/* Universal Intake Modal - primary entry on smaller layouts */}
      <AddToFillaSheet
        open={showAddToFilla}
        onOpenChange={setShowAddToFilla}
        onTaskCreated={handleTaskCreated}
        defaultPropertyId={intakeScopedPropertyId}
      />

      {!isLargeScreen && (
        <button
          type="button"
          onClick={() => setShowAddToFilla(true)}
          className="fixed bottom-6 right-4 z-50 flex items-center gap-2 rounded-full bg-[#8EC9CE] px-4 py-3 text-sm font-semibold text-white shadow-lg active:scale-95"
          aria-label="Add to Filla"
        >
          <Inbox className="h-4 w-4" />
          Add to Filla
          {readyIntakeItems.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/90 px-1 text-[10px] font-bold text-[#5a9ea3]">
              {readyIntakeItems.length > 9 ? "9+" : readyIntakeItems.length}
            </span>
          )}
        </button>
      )}

      {showCreateTask && !isLargeScreen && (
        <IntakeModal
          open={showCreateTask}
          onOpenChange={handleCreateTaskOpenChange}
          onTaskCreated={handleTaskCreated}
          defaultPropertyId={intakeScopedPropertyId}
          initialIntakeMode={modalInitialIntakeMode}
        />
      )}

      {/* Detail Panel - Modal variant for smaller screens */}
      {selectedItem && !isLargeScreen && (
        selectedItem.type === "task" ? (
          <TaskDetailPanel taskId={selectedItem.id} onClose={handleClosePanel} variant="modal" />
        ) : selectedItem.type === "message" ? (
          <MessageDetailPanel messageId={selectedItem.id} onClose={handleClosePanel} variant="modal" />
        ) : (
          <SignalFeedDetailPanel
            snapshot={selectedItem.snapshot}
            onClose={handleClosePanel}
            variant="modal"
            onOpenIntake={handleOpenIntake}
          />
        )
      )}
      </div>
    </WorkbenchControlsProvider>
  );
}

