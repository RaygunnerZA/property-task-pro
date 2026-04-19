import {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  useCallback,
} from "react";
import type { MutableRefObject } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/animated-tabs";
import { TaskList } from "@/components/tasks/TaskList";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { OperationalStreamCard } from "@/components/dashboard/OperationalStreamCard";
import { IssuesScrollColumn } from "@/components/dashboard/issues/IssuesScrollColumn";
import { useMessages, type UseMessagesOptions } from "@/hooks/useMessages";
import { useCompliancePortfolioQuery } from "@/hooks/useCompliancePortfolioQuery";
import {
  CheckSquare,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertTriangle,
  HelpCircle,
  ShieldCheck,
  ClipboardList,
  Upload,
  FileText,
} from "lucide-react";
import { useSignalUiFixturesEnabled } from "@/hooks/useSignalUiFixtures";
import {
  SIGNAL_UI_FIXTURES_RECENT,
  SIGNAL_UI_FIXTURES_REVIEW,
  SIGNAL_UI_FIXTURES_URGENT,
  type SignalUiFixture,
} from "@/fixtures/signalUiSamples";
import type { SignalKind } from "@/types/workbenchSignals";
import { SIGNAL_KIND_FOOT_LABEL } from "@/types/workbenchSignals";
import { signalKindIcon } from "@/lib/signalKindIcons";
import { AnimatedIcon } from "@/components/ui/AnimatedIcon";
import { SegmentControl } from "@/components/filla/SegmentControl";
import { PropertyRecordsTab } from "@/components/records/PropertyRecordsTab";
import { cn } from "@/lib/utils";
import type { IntakeMode } from "@/types/intake";
import {
  intakeAddRecordButtonClassName,
  intakeAddRecordCompactClassName,
  intakeAddRecordIconClassName,
  intakeReportIssueButtonClassName,
  intakeReportIssueCompactClassName,
  intakeReportIssueIconClassName,
} from "@/lib/intake-action-buttons";
import { LAYOUT_BREAKPOINTS } from "@/lib/layoutBreakpoints";
import { addDays, format, isAfter, startOfDay, subDays } from "date-fns";
import type { RecordsView, WorkbenchIssuesFilter } from "@/lib/propertyRoutes";
import { buildRecentUnifiedSignalMetaLine } from "@/lib/recentSignalMetaLine";

interface TaskPanelProps {
  tasks?: any[];
  properties?: any[];
  tasksLoading?: boolean;
  onTaskClick?: (taskId: string) => void;
  onMessageClick?: (messageId: string) => void;
  selectedItem?: { type: "task" | "message"; id: string } | null;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  selectedDate?: Date | undefined;
  filterToApply?: string | null;
  filtersToApply?: string[] | null;
  /** Issues sub-filter (URL-backed on dashboard). */
  issuesFilter?: WorkbenchIssuesFilter;
  onIssuesFilterChange?: (filter: WorkbenchIssuesFilter) => void;
  selectedPropertyIds?: Set<string>;
  onOpenIntake?: (mode: IntakeMode) => void;
  recordsView?: RecordsView;
  onRecordsViewChange?: (view: RecordsView) => void;
}

type TabBarDensity = "comfortable" | "compact" | "iconOnly";

/** At this width and below, tab bar hides icons (compact) until overflow forces icon-only. */
const TASK_TAB_NARROW_VIEWPORT_PX = LAYOUT_BREAKPOINTS.maxPane;

/** Stacked workbench (narrow window): never use icon-only strip; comfortable ↔ compact only. */
const TASK_TAB_MOBILE_STACK_MAX_PX = 767;

/** Subpixel / rounding slack when comparing intrinsic tab row width to `TabsList` clientWidth. */
const TASK_TAB_MEASURE_TOLERANCE_PX = 4;

const TASK_TAB_MICROCOPY = {
  issues: "Urgent → Recent signals → Needs review → Open work. Each stage is different.",
  records: "What you have, what expires, and where it belongs",
  schedule: "What's coming up",
} as const;

const ISSUES_SLICE_FILTERS: { id: WorkbenchIssuesFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "urgent", label: "Urgent" },
  { id: "review", label: "Needs review" },
  { id: "open", label: "Open" },
  { id: "done", label: "Done" },
  { id: "recent", label: "Recent" },
];

type IssuesSignalCardProps = {
  item: AttentionItem;
  attentionCardRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  resolveAttentionItem: (id: string) => void;
  addAttentionItemToCompliance: (item: AttentionItem) => void;
  onOpenIntake?: (mode: IntakeMode) => void;
  onMessageClick?: (messageId: string) => void;
};

type RecentNeedsReviewColumnsProps = {
  recentItems: AttentionItem[];
  reviewItems: AttentionItem[];
  attentionCardRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  resolveAttentionItem: (id: string) => void;
  addAttentionItemToCompliance: (item: AttentionItem) => void;
  onOpenIntake?: (mode: IntakeMode) => void;
  onMessageClick?: (messageId: string) => void;
};

const SIGNAL_COLUMN_RECENT = {
  title: "Recent signals",
  subtitle: "What just entered the system — a timeline of events, not your task list.",
  emptyTitle: "Nothing new in the timeline",
  emptyDescription:
    "When photos, messages, uploads, or system events arrive, they show up here first. Open Tasks below when you are ready to execute work.",
} as const;

const SIGNAL_COLUMN_REVIEW = {
  title: "Needs review",
  subtitle:
    "Things Filla cannot safely classify or assign yet — your judgment before they become work or records.",
  emptyTitle: "Nothing in the decision queue",
  emptyDescription:
    "If this stays empty while a lot is happening, items may be auto-classified too aggressively. Surfacing uncertainty (e.g. a review_state in your pipeline) will fill this column when the system needs your judgment.",
} as const;

const SIGNAL_STACK_SECTIONS = [
  {
    key: "urgent",
    title: "Urgent",
    subtitle: "Time-sensitive signals — still not tasks until you act on them below.",
    itemsKey: "urgent" as const,
  },
  {
    key: "recent",
    title: SIGNAL_COLUMN_RECENT.title,
    subtitle: SIGNAL_COLUMN_RECENT.subtitle,
    itemsKey: "recent" as const,
  },
  {
    key: "review",
    title: SIGNAL_COLUMN_REVIEW.title,
    subtitle: SIGNAL_COLUMN_REVIEW.subtitle,
    itemsKey: "review" as const,
  },
] as const;

/** Two-column row: recent signals (left) and needs review (right). */
function RecentNeedsReviewColumns({
  recentItems,
  reviewItems,
  attentionCardRefs,
  resolveAttentionItem,
  addAttentionItemToCompliance,
  onOpenIntake,
  onMessageClick,
}: RecentNeedsReviewColumnsProps) {
  const renderSignal = (item: AttentionItem) => (
    <IssuesSignalCard
      item={item}
      attentionCardRefs={attentionCardRefs}
      resolveAttentionItem={resolveAttentionItem}
      addAttentionItemToCompliance={addAttentionItemToCompliance}
      onOpenIntake={onOpenIntake}
      onMessageClick={onMessageClick}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
      <IssuesScrollColumn
        title={SIGNAL_COLUMN_RECENT.title}
        subtitle={SIGNAL_COLUMN_RECENT.subtitle}
        items={recentItems}
        emptyTitle={SIGNAL_COLUMN_RECENT.emptyTitle}
        emptyDescription={SIGNAL_COLUMN_RECENT.emptyDescription}
        renderCard={renderSignal}
      />
      <IssuesScrollColumn
        title={SIGNAL_COLUMN_REVIEW.title}
        subtitle={SIGNAL_COLUMN_REVIEW.subtitle}
        items={reviewItems}
        emptyTitle={SIGNAL_COLUMN_REVIEW.emptyTitle}
        emptyDescription={SIGNAL_COLUMN_REVIEW.emptyDescription}
        renderCard={renderSignal}
      />
    </div>
  );
}

function runFixtureAction(
  actionId: string,
  item: AttentionItem,
  ctx: {
    resolveAttentionItem: (id: string) => void;
    addAttentionItemToCompliance: (item: AttentionItem) => void;
    onOpenIntake?: (mode: IntakeMode) => void;
    onMessageClick?: (messageId: string) => void;
  }
) {
  const { resolveAttentionItem, addAttentionItemToCompliance, onOpenIntake, onMessageClick } = ctx;
  switch (actionId) {
    case "report-issue":
      onOpenIntake?.("report_issue");
      resolveAttentionItem(item.id);
      break;
    case "ignore":
    case "dismiss":
      resolveAttentionItem(item.id);
      break;
    case "signal-open":
      if (item.messageId) onMessageClick?.(item.messageId);
      resolveAttentionItem(item.id);
      break;
    case "signal-review":
      onOpenIntake?.("add_record");
      resolveAttentionItem(item.id);
      break;
    case "signal-assign":
      onOpenIntake?.("report_issue");
      resolveAttentionItem(item.id);
      break;
    case "signal-convert":
      if (item.complianceSeed) addAttentionItemToCompliance(item);
      else onOpenIntake?.("add_record");
      resolveAttentionItem(item.id);
      break;
    default:
      resolveAttentionItem(item.id);
  }
}

function IssuesSignalCard({
  item,
  attentionCardRefs,
  resolveAttentionItem,
  addAttentionItemToCompliance,
  onOpenIntake,
  onMessageClick,
}: IssuesSignalCardProps) {
  const ctx = {
    resolveAttentionItem,
    addAttentionItemToCompliance,
    onOpenIntake,
    onMessageClick,
  };

  if (item.group === "urgent") {
    const icon = item.signalKind
      ? signalKindIcon(item.signalKind, "text-amber-700")
      : <AlertTriangle className="h-4 w-4 text-amber-600" />;
    const actionsList =
      item.fixtureActions != null
        ? [
            {
              id: item.fixtureActions.primary.id,
              label: item.fixtureActions.primary.label,
              onClick: () => runFixtureAction(item.fixtureActions!.primary.id, item, ctx),
            },
            ...(item.fixtureActions.secondary ?? []).map((a) => ({
              id: a.id,
              label: a.label,
              onClick: () => runFixtureAction(a.id, item, ctx),
            })),
          ]
        : [
            {
              id: "report-issue",
              label: "Report issue",
              onClick: () => runFixtureAction("report-issue", item, ctx),
            },
            {
              id: "ignore",
              label: "Ignore",
              onClick: () => runFixtureAction("ignore", item, ctx),
            },
          ];
    const minor = actionsList.find((a) => a.id === "ignore" || a.id === "dismiss");
    const primaryOnly = actionsList.filter((a) => a.id !== "ignore" && a.id !== "dismiss");
    const primaryAction = primaryOnly[0];
    const minorFromExtras = !minor && primaryOnly.length > 1 ? primaryOnly[1] : undefined;

    return (
      <OperationalStreamCard
        id={`issues-signal-${item.id}`}
        issuesStreamKind="urgent"
        cardRef={(node) => {
          attentionCardRefs.current[item.id] = node;
        }}
        icon={icon}
        title={item.title}
        context={item.context}
        description={item.description}
        imageUrl={item.imageUrl}
        accent="red"
        emphasis="standard"
        actions={primaryAction ? [primaryAction] : actionsList.slice(0, 1)}
        minorLinkAction={minor ?? minorFromExtras}
      />
    );
  }

  if (item.group === "review") {
    const icon = item.signalKind
      ? signalKindIcon(item.signalKind, "text-teal-800")
      : <HelpCircle className="h-4 w-4 text-teal-800" />;
    const actionsList =
      item.fixtureActions != null
        ? [
            {
              id: item.fixtureActions.primary.id,
              label: item.fixtureActions.primary.label,
              onClick: () => runFixtureAction(item.fixtureActions!.primary.id, item, ctx),
            },
            ...(item.fixtureActions.secondary ?? []).map((a) => ({
              id: a.id,
              label: a.label,
              onClick: () => runFixtureAction(a.id, item, ctx),
            })),
          ]
        : [
            {
              id: "signal-review",
              label: "Classify",
              onClick: () => runFixtureAction("signal-review", item, ctx),
            },
            {
              id: "signal-assign",
              label: "Assign",
              onClick: () => runFixtureAction("signal-assign", item, ctx),
            },
            {
              id: "signal-convert",
              label: "Convert",
              onClick: () => runFixtureAction("signal-convert", item, ctx),
            },
          ];

    const reviewShortReason =
      item.whyHere?.trim() || item.context?.trim() || item.description?.trim() || undefined;

    return (
      <OperationalStreamCard
        id={`issues-signal-${item.id}`}
        issuesStreamKind="review"
        cardRef={(node) => {
          attentionCardRefs.current[item.id] = node;
        }}
        reviewShortReason={reviewShortReason}
        icon={icon}
        title={item.title}
        context={item.context}
        whyHere={item.whyHere}
        accent="teal"
        emphasis="elevated"
        actions={actionsList}
        dismissAction={{
          id: "dismiss",
          label: "Dismiss",
          onClick: () => runFixtureAction("dismiss", item, ctx),
        }}
      />
    );
  }

  // Recent = raw timeline signals (not tasks)
  const icon = item.signalKind
    ? signalKindIcon(item.signalKind)
    : <Upload className="h-4 w-4 text-muted-foreground" />;
  const actionsList =
    item.fixtureActions != null
      ? [
          {
            id: item.fixtureActions.primary.id,
            label: item.fixtureActions.primary.label,
            onClick: () => runFixtureAction(item.fixtureActions!.primary.id, item, ctx),
          },
          ...(item.fixtureActions.secondary ?? []).map((a) => ({
            id: a.id,
            label: a.label,
            onClick: () => runFixtureAction(a.id, item, ctx),
          })),
        ]
      : [
          {
            id: "signal-open",
            label: "View",
            onClick: () => runFixtureAction("signal-open", item, ctx),
          },
          {
            id: "dismiss",
            label: "Dismiss",
            onClick: () => runFixtureAction("dismiss", item, ctx),
          },
        ];

  const viewAction = actionsList.find((a) => a.id === "signal-open") ?? actionsList[0];
  const dismissAction = actionsList.find((a) => a.id === "dismiss" || a.id === "ignore");

  const recentSignalMetaLine = buildRecentUnifiedSignalMetaLine({
    kind: item.signalKind,
    context: item.context,
    footChipLabel: item.footChipLabel,
  });

  return (
    <OperationalStreamCard
      id={`issues-signal-${item.id}`}
      issuesStreamKind="recent"
      cardRef={(node) => {
        attentionCardRefs.current[item.id] = node;
      }}
      recentSignalMetaLine={recentSignalMetaLine}
      icon={icon}
      title={item.title}
      context={item.context}
      description={item.description}
      imageUrl={item.imageUrl}
      accent="slate"
      emphasis="minimal"
      actions={viewAction ? [viewAction, ...(dismissAction ? [dismissAction] : [])] : actionsList}
    />
  );
}

function useTaskTabNarrowViewport() {
  const query = `(max-width: ${TASK_TAB_NARROW_VIEWPORT_PX}px)`;
  return useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

type AttentionGroup = "urgent" | "review" | "recent";
type ComplianceStatus = "healthy" | "expiring" | "overdue" | "missing";
interface ComplianceRecord {
  id: string;
  title: string;
  propertyName: string;
  propertyId?: string | null;
  complianceType: string;
  expiryDate?: string | null;
  nextDueDate?: string | null;
  status: ComplianceStatus;
  linkedDocument: string;
  inspectionHistory: string[];
  linkedTasks: string[];
  notes: string;
}

interface AttentionItem {
  id: string;
  group: AttentionGroup;
  title: string;
  context: string;
  hint?: string;
  /** Triage chips for the decision queue (from existing signal data only — no invented DB fields). */
  signalLabels?: string[];
  description?: string;
  imageUrl?: string | null;
  messageId?: string;
  complianceSeed?: {
    title: string;
    propertyName: string;
    propertyId?: string | null;
    complianceType: string;
  };
  /** UI taxonomy fixtures / future typed ingestion */
  signalKind?: SignalKind;
  /** @deprecated Prefer footChipLabel for feed-layout cards */
  typeChipLabel?: string;
  /** Bottom chip on feed cards (e.g. UPLOADED PHOTO) — not duplicate of title */
  footChipLabel?: string;
  reviewBanner?: string;
  whyHere?: string;
  isUiFixture?: boolean;
  fixtureActions?: {
    primary: { id: string; label: string };
    secondary?: { id: string; label: string }[];
  };
}

function mapSignalFixtureToAttentionItem(f: SignalUiFixture): AttentionItem {
  const group: AttentionGroup =
    f.disposition === "needs_review" ? "review" : f.disposition === "urgent" ? "urgent" : "recent";
  return {
    id: f.id,
    group,
    title: f.title,
    context: f.contextLine,
    description: f.explanation,
    whyHere: f.whyHere,
    footChipLabel: group === "review" ? undefined : SIGNAL_KIND_FOOT_LABEL[f.kind],
    reviewBanner: undefined,
    signalKind: f.kind,
    isUiFixture: true,
    fixtureActions: {
      primary: f.primaryAction,
      secondary: f.secondaryActions,
    },
    hint: undefined,
  };
}

function normalizeStatus(rawState?: string | null): ComplianceStatus {
  const state = String(rawState || "").toLowerCase();
  if (state.includes("overdue") || state.includes("expired")) return "overdue";
  if (state.includes("missing") || state.includes("none")) return "missing";
  if (state.includes("expiring") || state.includes("due_soon")) return "expiring";
  if (state.includes("valid") || state.includes("healthy")) return "healthy";
  return "healthy";
}

function daysUntil(dateString?: string | null): number | null {
  if (!dateString) return null;
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = startOfDay(new Date());
  const due = startOfDay(parsed);
  const diff = due.getTime() - now.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function formatDueText(dateString?: string | null): string {
  if (!dateString) return "No expiry date";
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return "No expiry date";
  return format(parsed, "dd MMM yyyy");
}

function formatAuthorDisplayName(rawAuthor?: string | null): string {
  const author = String(rawAuthor || "").trim();
  if (!author) return "Unknown";
  if (!author.includes("@")) return author;

  // Some message sources persist an email in author_name.
  // Convert it into a readable label for dashboard meta text.
  const localPart = author.split("@")[0] || "";
  const base = localPart.split("+")[0] || localPart;
  const tokens = base
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return "Unknown";

  return tokens
    .map((token) =>
      token.length <= 2
        ? token.toUpperCase()
        : `${token.charAt(0).toUpperCase()}${token.slice(1).toLowerCase()}`
    )
    .join(" ");
}

/**
 * Task Panel Component
 *
 * Desktop centre-column panel with 3 tabs:
 * - Issues: operational feed (signals + tasks)
 * - Records: compliance / evidence portfolio
 * - Schedule: upcoming agenda
 */
export function TaskPanel({
  tasks = [],
  properties = [],
  tasksLoading = false,
  onTaskClick,
  onMessageClick,
  selectedItem,
  activeTab: externalActiveTab,
  onTabChange,
  selectedDate: selectedDateProp,
  filterToApply,
  filtersToApply,
  issuesFilter: issuesFilterProp,
  onIssuesFilterChange,
  selectedPropertyIds,
  onOpenIntake,
  recordsView: recordsViewProp,
  onRecordsViewChange,
}: TaskPanelProps = {}) {

  const messagesOptions = useMemo<UseMessagesOptions | undefined>(() => {
    const n = properties.length;
    if (n === 0) return undefined;
    if (
      !selectedPropertyIds ||
      selectedPropertyIds.size === 0 ||
      selectedPropertyIds.size >= n
    ) {
      return undefined;
    }
    return {
      propertyScope: {
        selectedIds: Array.from(selectedPropertyIds),
        totalPropertyCount: n,
      },
    };
  }, [properties.length, selectedPropertyIds]);

  const { messages } = useMessages(messagesOptions);
  const signalUiFixturesEnabled = useSignalUiFixturesEnabled();
  const { data: compliancePortfolio = [] } = useCompliancePortfolioQuery();

  const [internalActiveTab, setInternalActiveTab] = useState("issues");
  const [internalSelectedDate, setInternalSelectedDate] = useState<Date | undefined>(new Date());
  const [isDatePinned, setIsDatePinned] = useState(false);
  const [internalIssuesFilter, setInternalIssuesFilter] = useState<WorkbenchIssuesFilter>("all");
  const issuesFilter = issuesFilterProp ?? internalIssuesFilter;
  const setIssuesFilter = (next: WorkbenchIssuesFilter) => {
    onIssuesFilterChange?.(next);
    if (onIssuesFilterChange == null) setInternalIssuesFilter(next);
  };
  const [resolvedAttentionIds, setResolvedAttentionIds] = useState<Set<string>>(new Set());
  const [attentionComplianceDrafts, setAttentionComplianceDrafts] = useState<ComplianceRecord[]>([]);
  const [tabBarDensity, setTabBarDensity] = useState<TabBarDensity>("comfortable");
  const narrowTaskTabViewport = useTaskTabNarrowViewport();
  const attentionCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tabsListRef = useRef<HTMLDivElement | null>(null);
  const measureTabComfortableRef = useRef<HTMLDivElement | null>(null);
  const measureTabCompactRef = useRef<HTMLDivElement | null>(null);
  const measureTabIconOnlyRef = useRef<HTMLDivElement | null>(null);

  const selectedDate = selectedDateProp ?? internalSelectedDate;

  const prevSelectedDatePropRef = useRef<Date | undefined>(selectedDateProp);
  useEffect(() => {
    if (selectedDateProp === undefined) return;
    const prevTime = prevSelectedDatePropRef.current?.getTime();
    const newTime = selectedDateProp.getTime();
    if (prevTime !== newTime) {
      setInternalSelectedDate(selectedDateProp);
      setIsDatePinned(true);
      prevSelectedDatePropRef.current = selectedDateProp;
    }
  }, [selectedDateProp]);

  const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;
  const setActiveTab = onTabChange || setInternalActiveTab;

  const propertyMap = useMemo(() => {
    return new Map(properties.map((p) => [p.id, p]));
  }, [properties]);

  const propertyOptions = useMemo(() => {
    return properties
      .map((property: any) => ({
        id: property.id as string,
        name: (property.name || property.nickname || property.address || "Property") as string,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [properties]);

  const tasksForView = useMemo(() => {
    if (
      !selectedPropertyIds ||
      selectedPropertyIds.size === 0 ||
      selectedPropertyIds.size === properties.length
    ) {
      return tasks;
    }
    return tasks.filter((t) => t.property_id && selectedPropertyIds.has(t.property_id));
  }, [tasks, selectedPropertyIds, properties.length]);

  const unscheduledTasks = useMemo(() => {
    return tasksForView.filter((task) => {
      if (!task.due_date && !task.due_at) {
        if (task.status === "completed" || task.status === "archived") return false;
        return true;
      }
      return false;
    });
  }, [tasksForView]);

  const scheduleStats = useMemo(() => {
    const active = tasksForView.filter(
      (t) => t.status !== "completed" && t.status !== "archived"
    );
    const withDueDate = active.filter((t) => !!(t.due_date || t.due_at));
    const withId = active.filter((t) => !!t.id);
    return {
      total: tasks.length,
      active: active.length,
      withDueDate: withDueDate.length,
      withoutDueDate: active.length - withDueDate.length,
      withoutId: active.length - withId.length,
    };
  }, [tasksForView, tasks.length]);

  const complianceRecords = useMemo<ComplianceRecord[]>(() => {
    const recordsFromView = (compliancePortfolio as any[]).map((row) => {
      const title = row.title || row.document_type || "Compliance Record";
      const propertyName = row.property_name || "Unassigned property";
      const dueOrExpiry = row.next_due_date || row.expiry_date;
      const computedStatus = normalizeStatus(row.expiry_state || row.status);
      const dayDelta = daysUntil(dueOrExpiry);

      let status = computedStatus;
      if (status === "healthy" && dayDelta !== null && dayDelta <= 30 && dayDelta >= 0) {
        status = "expiring";
      }
      if (status === "healthy" && dayDelta !== null && dayDelta < 0) {
        status = "overdue";
      }

      return {
        id: String(row.id || `compliance-${Math.random().toString(36).slice(2, 10)}`),
        title,
        propertyName,
        propertyId: row.property_id,
        complianceType: row.document_type || "General",
        expiryDate: row.expiry_date,
        nextDueDate: row.next_due_date,
        status,
        linkedDocument: row.title || row.document_type || "Document",
        inspectionHistory: row.next_due_date
          ? [`Next due ${formatDueText(row.next_due_date)}`]
          : ["No inspection history yet"],
        linkedTasks: [],
        notes:
          row.hazards?.length > 0
            ? `Potential hazards: ${row.hazards.join(", ")}`
            : "No hazards flagged.",
      } as ComplianceRecord;
    });

    const merged = [...attentionComplianceDrafts, ...recordsFromView];
    const byId = new Map<string, ComplianceRecord>();
    merged.forEach((record) => {
      if (!byId.has(record.id)) byId.set(record.id, record);
    });
    return Array.from(byId.values());
  }, [attentionComplianceDrafts, compliancePortfolio]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const fixtureUrgent = signalUiFixturesEnabled
      ? SIGNAL_UI_FIXTURES_URGENT.map(mapSignalFixtureToAttentionItem)
      : [];
    const fixtureReview = signalUiFixturesEnabled
      ? SIGNAL_UI_FIXTURES_REVIEW.map(mapSignalFixtureToAttentionItem)
      : [];
    const fixtureRecent = signalUiFixturesEnabled
      ? SIGNAL_UI_FIXTURES_RECENT.map(mapSignalFixtureToAttentionItem)
      : [];

    const urgentFromData: AttentionItem[] = complianceRecords
      .filter((record) => record.status === "overdue")
      .slice(0, 4)
      .map((record) => ({
        id: `urgent-${record.id}`,
        group: "urgent" as const,
        title: `Possible ${record.complianceType.toLowerCase()} risk`,
        context: `${record.propertyName} • ${formatDueText(record.nextDueDate || record.expiryDate)}`,
        footChipLabel: "COMPLIANCE RISK",
        description: `${record.title} is overdue and may need immediate attention.`,
      }));

    const reviewFromData: AttentionItem[] = complianceRecords
      .filter((record) => record.status === "expiring" || record.status === "missing")
      .slice(0, 8)
      .map((record) => {
        const whyHere =
          record.status === "missing"
            ? "Not sure this belongs in compliance tracking yet."
            : "Expiry or renewal timing needs confirmation.";
        return {
          id: `review-${record.id}`,
          group: "review" as const,
          title: `${record.complianceType} — needs a decision`,
          context: record.propertyName,
          whyHere,
          description:
            record.status === "missing"
              ? "The system is not sure this belongs in compliance tracking yet. Classify it, assign an owner, or convert it into a stored record."
              : `Expiry or renewal timing may need confirmation before it becomes a tracked obligation. Decide how Filla should treat it.`,
          complianceSeed: {
            title: record.title,
            propertyName: record.propertyName,
            propertyId: record.propertyId,
            complianceType: record.complianceType,
          },
        };
      });

    const recentFromData: AttentionItem[] = messages.slice(0, 10).map((message: any) => {
      const authorName = formatAuthorDisplayName(message.author_name);
      const body = message.body ? String(message.body).replace(/\s+/g, " ").trim() : "";
      const titleFromBody =
        body.length > 0
          ? body.slice(0, 72) + (body.length > 72 ? "…" : "")
          : `Message from ${authorName}`;
      return {
        id: `recent-msg-${message.id}`,
        group: "recent" as const,
        signalKind: "message" as const,
        messageId: message.id,
        footChipLabel: "TENANT MESSAGE",
        title: titleFromBody,
        context: `${authorName} • ${format(new Date(message.created_at), "dd MMM, HH:mm")}`,
        description:
          body.length > 120 ? `${body.slice(0, 120)}…` : body || "Something new arrived — open it when you are ready to triage.",
      };
    });

    const urgent = [...fixtureUrgent, ...urgentFromData];
    const review = [...fixtureReview, ...reviewFromData];
    const recent = [...fixtureRecent, ...recentFromData];

    if (urgent.length === 0 && review.length === 0 && recent.length === 0) {
      return [
        {
          id: "recent-empty-seed",
          group: "recent" as const,
          title: "No signals in your timeline yet",
          context: "This is your inbox of “something happened”",
          footChipLabel: "GETTING STARTED",
          description:
            "Uploads, messages, documents, and system events will appear here as a raw feed — before they become tasks or records. Use Report Issue or Add Record when you want to log something manually.",
        },
      ];
    }

    return [...urgent, ...review, ...recent];
  }, [complianceRecords, messages, signalUiFixturesEnabled]);

  const unresolvedAttentionItems = useMemo(() => {
    return attentionItems.filter((item) => !resolvedAttentionIds.has(item.id));
  }, [attentionItems, resolvedAttentionIds]);

  const showSignalFeed =
    issuesFilter === "all" ||
    issuesFilter === "urgent" ||
    issuesFilter === "review" ||
    issuesFilter === "recent";

  const showTaskList =
    issuesFilter === "all" || issuesFilter === "open" || issuesFilter === "done";

  const filteredAttentionItems = useMemo(() => {
    if (!showSignalFeed) return [];
    return unresolvedAttentionItems.filter((item) => {
      if (issuesFilter === "all") return true;
      if (issuesFilter === "recent") {
        return item.group === "recent" || item.group === "review";
      }
      if (issuesFilter === "urgent" || issuesFilter === "review") {
        return item.group === issuesFilter;
      }
      return false;
    });
  }, [issuesFilter, unresolvedAttentionItems, showSignalFeed]);

  const groupedAttentionItems = useMemo(() => {
    const urgent = filteredAttentionItems.filter((item) => item.group === "urgent");
    const review = filteredAttentionItems.filter((item) => item.group === "review");
    const recent = filteredAttentionItems.filter((item) => item.group === "recent");
    return { urgent, review, recent };
  }, [filteredAttentionItems]);

  const resolveAttentionItem = (itemId: string) => {
    setResolvedAttentionIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
  };

  const addAttentionItemToCompliance = (item: AttentionItem) => {
    if (!item.complianceSeed) return;
    const newRecord: ComplianceRecord = {
      id: `attention-${item.id}`,
      title: item.complianceSeed.title,
      propertyName: item.complianceSeed.propertyName,
      propertyId: item.complianceSeed.propertyId,
      complianceType: item.complianceSeed.complianceType,
      expiryDate: null,
      nextDueDate: null,
      status: "missing",
      linkedDocument: "Pending document",
      inspectionHistory: ["Created from Issues"],
      linkedTasks: [],
      notes: "Promoted from Issues for compliance tracking.",
    };

    setAttentionComplianceDrafts((prev) => {
      if (prev.some((record) => record.id === newRecord.id)) return prev;
      return [newRecord, ...prev];
    });
    setActiveTab("records");
    onRecordsViewChange?.("missing");
  };

  const scheduleTasks = useMemo(() => {
    if (selectedDate && isDatePinned) {
      const selectedDateNormalized = startOfDay(selectedDate);
      const selectedDateStr = format(selectedDateNormalized, "yyyy-MM-dd");

      const parseMilestones = (task: any): Array<{ id: string; dateTime: string; label?: string }> => {
        if (!task.milestones) return [];
        if (Array.isArray(task.milestones)) return task.milestones;
        if (typeof task.milestones === "string") {
          try {
            return JSON.parse(task.milestones);
          } catch {
            return [];
          }
        }
        return [];
      };

      return tasksForView
        .flatMap((task) => {
          if (!task.id) return [];
          if (task.status === "completed" || task.status === "archived") return [];

          const dueValue = task.due_date || task.due_at;
          let matchesDue = false;
          if (dueValue) {
            try {
              matchesDue = format(startOfDay(new Date(dueValue)), "yyyy-MM-dd") === selectedDateStr;
            } catch {
              // No-op
            }
          }

          if (matchesDue) return [task];

          const milestones = parseMilestones(task);
          const hit = milestones.find((m) => {
            if (!m?.dateTime) return false;
            try {
              return format(startOfDay(new Date(m.dateTime)), "yyyy-MM-dd") === selectedDateStr;
            } catch {
              return false;
            }
          });

          if (hit) {
            return [{ ...task, _milestoneLabel: hit.label?.trim() || "Milestone", due_date: hit.dateTime, due_at: hit.dateTime }];
          }

          return [];
        })
        .sort((a, b) => {
          const aValue = a.due_date || a.due_at;
          const bValue = b.due_date || b.due_at;
          const aTime = aValue ? new Date(aValue).getTime() : 0;
          const bTime = bValue ? new Date(bValue).getTime() : 0;
          return aTime - bTime;
        });
    }

    const today = startOfDay(new Date());
    return tasksForView
      .filter((task) => {
        const dueValue = task.due_date || task.due_at;
        if (!dueValue) return false;
        if (!task.id) return false;
        if (task.status === "completed" || task.status === "archived") return false;
        try {
          const dueDate = startOfDay(new Date(dueValue));
          return isAfter(dueDate, today) || dueDate.getTime() === today.getTime();
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        const aValue = a.due_date || a.due_at;
        const bValue = b.due_date || b.due_at;
        if (!aValue || !bValue) return 0;
        return new Date(aValue).getTime() - new Date(bValue).getTime();
      })
      .slice(0, 25);
  }, [tasksForView, selectedDate, isDatePinned]);

  const effectiveTabBarDensity: TabBarDensity =
    narrowTaskTabViewport && tabBarDensity === "comfortable" ? "compact" : tabBarDensity;
  const compact = effectiveTabBarDensity === "compact";
  const iconOnly = effectiveTabBarDensity === "iconOnly";
  const tabTitle = (label: string) =>
    effectiveTabBarDensity === "comfortable" ? undefined : label;

  /** Inset track shared by tab strip + intake CTAs (neumorphic well). */
  const taskToolbarRecessedClass =
    "rounded-[15px] bg-background overflow-visible " +
    "shadow-[-1px_-1px_1px_0px_rgba(0,0,0,0.1),1px_1px_1px_0px_rgba(255,255,255,0.8),inset_2px_12.9px_11px_-5.2px_rgba(0,0,0,0.3),inset_0px_-5.7px_5.9px_0px_rgba(255,255,255,0)]";

  const taskTabShell =
    "rounded-[8px] transition-all text-sm font-medium min-w-0 group/task-tab inline-flex items-center justify-center " +
    "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)] " +
    "data-[state=active]:bg-card data-[state=inactive]:bg-transparent data-[state=active]:text-[rgb(20,184,166)]";

  const selectedTabMicrocopy =
    activeTab in TASK_TAB_MICROCOPY
      ? TASK_TAB_MICROCOPY[activeTab as keyof typeof TASK_TAB_MICROCOPY]
      : null;

  const taskTabIconOnly =
    "shrink-0 min-w-9 max-w-9 px-0 overflow-hidden transition-[max-width,min-width,padding] duration-200 ease-out " +
    "hover:z-20 hover:max-w-[min(220px,85vw)] hover:min-w-0 hover:px-3 " +
    "focus-visible:z-20 focus-visible:max-w-[min(220px,85vw)] focus-visible:min-w-0 focus-visible:px-3 " +
    "data-[state=active]:z-10 data-[state=active]:max-w-none data-[state=active]:min-w-0 data-[state=active]:px-3";

  const taskTabLabelReveal =
    "max-w-0 overflow-hidden opacity-0 transition-[max-width,opacity] duration-200 ease-out whitespace-nowrap " +
    "group-hover/task-tab:max-w-[12rem] group-hover/task-tab:opacity-100 " +
    "group-focus-visible/task-tab:max-w-[12rem] group-focus-visible/task-tab:opacity-100 " +
    "group-data-[state=active]/task-tab:max-w-[12rem] group-data-[state=active]/task-tab:opacity-100";

  /** Content-width tabs (comfortable / compact); icon-only uses flex row + scroll instead */
  const taskTabPadLabeled =
    "w-auto min-w-min shrink-0 px-1.5 sm:px-2 lg:px-2.5 max-pane:px-1 max-sm:flex-1 max-sm:basis-0 max-sm:min-w-0 max-sm:justify-center";

  /** Same horizontal padding as labeled tabs, without `max-sm:flex-1` so intrinsic width sums match desktop strip. */
  const taskTabMeasurePad =
    "w-auto min-w-min shrink-0 px-1.5 sm:px-2 lg:px-2.5 max-pane:px-1 inline-flex items-center justify-center";

  useLayoutEffect(() => {
    const tabsListEl = tabsListRef.current;
    const mComfort = measureTabComfortableRef.current;
    const mCompact = measureTabCompactRef.current;
    const mIcon = measureTabIconOnlyRef.current;
    if (!tabsListEl || !mComfort || !mCompact || !mIcon) return;

    let frameId: number | null = null;
    const run = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        const available = tabsListEl.clientWidth;
        const wComfort = mComfort.getBoundingClientRect().width;
        const wCompact = mCompact.getBoundingClientRect().width;
        const mobileStack = window.matchMedia(
          `(max-width: ${TASK_TAB_MOBILE_STACK_MAX_PX}px)`
        ).matches;

        let next: TabBarDensity;
        if (wComfort <= available + TASK_TAB_MEASURE_TOLERANCE_PX) {
          next = "comfortable";
        } else if (wCompact <= available + TASK_TAB_MEASURE_TOLERANCE_PX) {
          next = "compact";
        } else if (mobileStack) {
          next = "compact";
        } else {
          next = "iconOnly";
        }

        setTabBarDensity((prev) => (prev === next ? prev : next));
      });
    };

    run();
    const ro = new ResizeObserver(run);
    ro.observe(tabsListEl);
    window.addEventListener("resize", run);
    const mqMobile = window.matchMedia(`(max-width: ${TASK_TAB_MOBILE_STACK_MAX_PX}px)`);
    const mqMaxPane = window.matchMedia(`(max-width: ${TASK_TAB_NARROW_VIEWPORT_PX}px)`);
    mqMobile.addEventListener("change", run);
    mqMaxPane.addEventListener("change", run);

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      ro.disconnect();
      window.removeEventListener("resize", run);
      mqMobile.removeEventListener("change", run);
      mqMaxPane.removeEventListener("change", run);
    };
  }, [activeTab]);

  return (
    <div className="h-full flex flex-col bg-transparent">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col pt-[8px] pb-[3px]">
        <div
          className={cn(
            "sticky top-0 z-10 bg-transparent flex min-w-0 w-full max-w-full overflow-x-hidden",
            /* Below lg the centre column is narrow (sidebar + ~652px cap): stack so intake actions stay in-flow */
            "flex-col items-stretch gap-2 md:gap-2.5 lg:flex-row lg:items-start lg:justify-start lg:gap-3",
            "px-[10px] max-sm:px-0",
            // Match TASK_TAB_NARROW_VIEWPORT_PX — reclaim horizontal space when the strip is squeezed
            "max-pane:px-2 max-pane:gap-1"
          )}
        >
          <div className="flex w-full min-w-0 flex-1 flex-col gap-1 lg:min-w-0">
            <div
              className={cn(
                taskToolbarRecessedClass,
                "min-w-0 max-w-[417px] max-sm:max-w-none",
                /* Hug tab content so horizontal padding matches left/right; full width only when icon strip scrolls */
                iconOnly ? "w-full" : "w-max self-start",
                "max-sm:w-full max-sm:self-auto"
              )}
            >
              {/* Intrinsic-width probes: pick the least compressed density that fits (avoids icon-only when the track is actually wide). */}
              <div
                aria-hidden
                className="pointer-events-none fixed -left-[10000px] top-0 z-[-1] flex flex-col gap-0"
              >
                <div
                  ref={measureTabComfortableRef}
                  className="flex w-max shrink-0 flex-nowrap items-center gap-x-1.5 px-2 text-sm font-medium max-pane:pl-1 max-pane:pr-1"
                >
                  <div className={cn(taskTabShell, taskTabMeasurePad)}>
                    <span className="inline-flex min-w-0 items-center justify-center">
                      <ClipboardList className="mr-1 h-4 w-4 shrink-0 text-[#FF6B6B] max-pane:mr-0.5" />
                      <span>Issues</span>
                    </span>
                  </div>
                  <div className={cn(taskTabShell, taskTabMeasurePad)}>
                    <span className="inline-flex min-w-0 items-center justify-center">
                      <ShieldCheck className="mr-1 h-4 w-4 shrink-0 max-pane:mr-0.5" />
                      <span>Records</span>
                    </span>
                  </div>
                  <div className={cn(taskTabShell, taskTabMeasurePad)}>
                    <span className="inline-flex min-w-0 items-center justify-center">
                      <Calendar className="mr-1 h-4 w-4 shrink-0 max-pane:mr-0.5" />
                      <span>Schedule</span>
                    </span>
                  </div>
                </div>
                <div
                  ref={measureTabCompactRef}
                  className="flex w-max shrink-0 flex-nowrap items-center gap-x-1.5 px-2 text-sm font-medium max-pane:pl-1 max-pane:pr-1"
                >
                  <div className={cn(taskTabShell, taskTabMeasurePad)}>
                    <span className="inline-flex min-w-0 items-center justify-center">Issues</span>
                  </div>
                  <div className={cn(taskTabShell, taskTabMeasurePad)}>
                    <span className="inline-flex min-w-0 items-center justify-center">Records</span>
                  </div>
                  <div className={cn(taskTabShell, taskTabMeasurePad)}>
                    <span className="inline-flex min-w-0 items-center justify-center">Schedule</span>
                  </div>
                </div>
                <div
                  ref={measureTabIconOnlyRef}
                  className="flex w-max shrink-0 flex-nowrap items-center gap-x-[7px] px-2 max-pane:gap-x-1 max-pane:pl-1 max-pane:pr-1"
                >
                  <div
                    className={cn(
                      taskTabShell,
                      "inline-flex min-w-9 max-w-9 shrink-0 items-center justify-center px-0 text-sm font-medium"
                    )}
                  >
                    <ClipboardList className="h-4 w-4 text-[#FF6B6B]" />
                  </div>
                  <div
                    className={cn(
                      taskTabShell,
                      "inline-flex min-w-9 max-w-9 shrink-0 items-center justify-center px-0 text-sm font-medium"
                    )}
                  >
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div
                    className={cn(
                      taskTabShell,
                      "inline-flex min-w-9 max-w-9 shrink-0 items-center justify-center px-0 text-sm font-medium"
                    )}
                  >
                    <Calendar className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <TabsList
                ref={tabsListRef}
                className={cn(
                  "h-12 min-w-0 p-0 pt-[6px] pb-1.5 px-2 rounded-none bg-transparent overflow-y-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  iconOnly ? "w-full" : "w-max max-w-full",
                  iconOnly
                    ? "flex flex-nowrap items-center justify-start gap-x-[7px] overflow-x-auto"
                    : "flex flex-nowrap items-center justify-start gap-x-1.5 overflow-x-auto max-sm:w-full max-sm:justify-between max-sm:gap-1 max-sm:overflow-x-hidden",
                  "max-pane:pl-1 max-pane:pr-1",
                  iconOnly && "max-pane:gap-x-1"
                )}
              >
              <TabsTrigger
                value="issues"
                title={tabTitle("Issues")}
                className={cn(taskTabShell, iconOnly ? taskTabIconOnly : taskTabPadLabeled)}
              >
                <span className="inline-flex max-w-full max-sm:w-full items-center justify-center min-w-0 max-sm:min-w-0">
                  {!compact && (
                    <AnimatedIcon
                      icon={ClipboardList}
                      size={16}
                      animateOnHover
                      animation="shake"
                      className={cn(
                        "shrink-0 h-4 w-4 text-[#FF6B6B]",
                        iconOnly
                          ? "mr-0 transition-[margin] duration-200 group-hover/task-tab:mr-1.5 group-focus-visible/task-tab:mr-1.5 group-data-[state=active]/task-tab:mr-1.5"
                          : "mr-1 max-pane:mr-0.5"
                      )}
                    />
                  )}
                  <span className={cn(iconOnly && taskTabLabelReveal, "max-sm:min-w-0 max-sm:truncate")}>Issues</span>
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="records"
                title={tabTitle("Records")}
                className={cn(taskTabShell, iconOnly ? taskTabIconOnly : taskTabPadLabeled)}
              >
                <span className="inline-flex max-w-full max-sm:w-full items-center justify-center min-w-0 max-sm:min-w-0">
                  {!compact && (
                    <ShieldCheck
                      className={cn(
                        "shrink-0 h-4 w-4",
                        iconOnly
                          ? "mr-0 transition-[margin] duration-200 group-hover/task-tab:mr-1.5 group-focus-visible/task-tab:mr-1.5 group-data-[state=active]/task-tab:mr-1.5"
                          : "mr-1 max-pane:mr-0.5"
                      )}
                    />
                  )}
                  <span className={cn(iconOnly && taskTabLabelReveal, "max-sm:min-w-0 max-sm:truncate")}>Records</span>
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="schedule"
                title={tabTitle("Schedule")}
                className={cn(taskTabShell, iconOnly ? taskTabIconOnly : taskTabPadLabeled)}
              >
                <span className="inline-flex max-w-full max-sm:w-full items-center justify-center min-w-0 max-sm:min-w-0">
                  {!compact && (
                    <AnimatedIcon
                      icon={Calendar}
                      size={16}
                      animateOnHover
                      animation="pointing"
                      className={cn(
                        "shrink-0 h-4 w-4",
                        iconOnly
                          ? "mr-0 transition-[margin] duration-200 group-hover/task-tab:mr-1.5 group-focus-visible/task-tab:mr-1.5 group-data-[state=active]/task-tab:mr-1.5"
                          : "mr-1 max-pane:mr-0.5"
                      )}
                    />
                  )}
                  <span className={cn(iconOnly && taskTabLabelReveal, "max-sm:min-w-0 max-sm:truncate")}>Schedule</span>
                </span>
              </TabsTrigger>
              </TabsList>
            </div>
            {!iconOnly && selectedTabMicrocopy != null && (
              <p
                className="flex flex-col justify-center items-start text-center text-base leading-tight text-[rgb(42,41,62)] px-2 pt-8 pb-2 max-pane:px-1"
                aria-live="polite"
              >
                {selectedTabMicrocopy}
              </p>
            )}
          </div>

          {onOpenIntake && (
            <div className="hidden min-w-0 layout:hidden sm:block lg:w-[255px] lg:shrink-0 lg:self-start lg:h-12 lg:min-h-12">
              <div className={cn("w-full min-w-0 lg:h-12 lg:min-h-12", taskToolbarRecessedClass)}>
                <div
                  className={cn(
                    "grid h-12 min-h-12 w-full grid-cols-2 items-stretch gap-x-1.5 px-2 pt-[6px] pb-1.5",
                    "lg:h-12 lg:min-h-12 lg:flex lg:flex-row lg:items-center lg:justify-center lg:gap-1.5 lg:px-2 lg:py-1.5",
                    "max-pane:px-1"
                  )}
                >
                  <button type="button" onClick={() => onOpenIntake("add_record")} className={intakeAddRecordButtonClassName}>
                    <FileText className={intakeAddRecordIconClassName} />
                    Add Record
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenIntake("report_issue")}
                    className={intakeReportIssueButtonClassName}
                  >
                    <Plus className={intakeReportIssueIconClassName} />
                    Report Issue
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          className={cn(
            "flex-1 min-h-0 overflow-hidden",
            activeTab === "issues" && "h-[515px] shrink-0"
          )}
        >
          {activeTab === "issues" && (
            <div
              className="box-border max-h-full min-h-0 w-full max-w-[660px] overflow-y-auto px-[10px] max-sm:px-0 pt-[11px] pb-[11px] max-pane:px-2"
              style={{
                borderWidth: "0 0 10px",
                borderStyle: "none none solid",
                borderColor: "transparent transparent rgb(255, 255, 255)",
                borderImage:
                  "linear-gradient(90deg, rgba(255, 255, 255, 0.49) 0%, rgba(255, 255, 255, 0) 100%) 1 / 1 / 0 stretch",
              }}
            >
              <div className="min-w-0 space-y-3">
                <div className="min-w-0 px-0.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                    View
                  </p>
                  <SegmentControl
                    compact
                    className="w-full min-w-0"
                    options={ISSUES_SLICE_FILTERS.map(({ id, label }) => ({ id, label }))}
                    selectedId={issuesFilter}
                    onChange={(id) => setIssuesFilter(id as WorkbenchIssuesFilter)}
                  />
                </div>

                {showSignalFeed && (
                  <div className="space-y-4">
                    {issuesFilter === "recent" || issuesFilter === "all" ? (
                      <>
                        {issuesFilter === "all" && groupedAttentionItems.urgent.length > 0 && (
                          <div className="space-y-2">
                            <div className="space-y-0.5 px-1">
                              <p className="text-sm font-semibold tracking-wide text-[rgb(42,41,62)]">Urgent</p>
                              <p className="text-[11px] leading-snug text-muted-foreground">
                                Time-sensitive signals — still not tasks until you act on them below.
                              </p>
                            </div>
                            <div className="space-y-2">
                              {groupedAttentionItems.urgent.map((item) => (
                                <IssuesSignalCard
                                  key={item.id}
                                  item={item}
                                  attentionCardRefs={attentionCardRefs}
                                  resolveAttentionItem={resolveAttentionItem}
                                  addAttentionItemToCompliance={addAttentionItemToCompliance}
                                  onOpenIntake={onOpenIntake}
                                  onMessageClick={onMessageClick}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        <RecentNeedsReviewColumns
                          recentItems={groupedAttentionItems.recent}
                          reviewItems={groupedAttentionItems.review}
                          attentionCardRefs={attentionCardRefs}
                          resolveAttentionItem={resolveAttentionItem}
                          addAttentionItemToCompliance={addAttentionItemToCompliance}
                          onOpenIntake={onOpenIntake}
                          onMessageClick={onMessageClick}
                        />
                      </>
                    ) : (
                      <>
                        {SIGNAL_STACK_SECTIONS.map(({ key, title, subtitle, itemsKey }) => {
                          const items = groupedAttentionItems[itemsKey];
                          return items.length > 0 ? (
                            <div key={key} className="space-y-2">
                              <div className="space-y-0.5 px-1">
                                <p className="text-sm font-semibold tracking-wide text-[rgb(42,41,62)]">{title}</p>
                                <p className="text-[11px] leading-snug text-muted-foreground">{subtitle}</p>
                              </div>
                              <div className="space-y-2">
                                {items.map((item) => (
                                  <IssuesSignalCard
                                    key={item.id}
                                    item={item}
                                    attentionCardRefs={attentionCardRefs}
                                    resolveAttentionItem={resolveAttentionItem}
                                    addAttentionItemToCompliance={addAttentionItemToCompliance}
                                    onOpenIntake={onOpenIntake}
                                    onMessageClick={onMessageClick}
                                  />
                                ))}
                              </div>
                            </div>
                          ) : null;
                        })}
                        {filteredAttentionItems.length === 0 && (
                          <div className="rounded-xl bg-card/70 shadow-e1 p-4 text-sm text-muted-foreground">
                            No signals match this slice. Try All or Recent to see the timeline, or Open for tasks.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {showTaskList && (
                  <div
                    className={cn(
                      "min-h-0",
                      showSignalFeed && "mt-6 border-t border-border/50 pt-4"
                    )}
                  >
                    {issuesFilter === "all" && (
                      <div className="mb-2 px-1">
                        <p className="text-sm font-semibold tracking-wide text-[rgb(42,41,62)]">Open work</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Approved, actionable issues and tasks — not the raw signal feed above.
                        </p>
                      </div>
                    )}
                    <div className="h-full flex flex-col min-h-0 rounded-xl bg-muted/20 p-2 shadow-sm">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground px-1 mb-1.5">
                        Filter tasks
                      </p>
                      <TaskList
                        key={`issues-tasklist-${issuesFilter}`}
                        tasks={tasks}
                        properties={properties}
                        tasksLoading={tasksLoading}
                        onTaskClick={onTaskClick}
                        selectedTaskId={selectedItem?.type === "task" ? selectedItem.id : undefined}
                        filterToApply={filterToApply}
                        filtersToApply={filtersToApply}
                        selectedPropertyIds={selectedPropertyIds}
                        hidePrimaryUrgentChip
                        embeddedInIssuesWorkbench
                        compactTaskMeta
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "records" && (
            <PropertyRecordsTab
              properties={properties}
              selectedPropertyIds={selectedPropertyIds}
              recordsView={recordsViewProp ?? "all"}
              onRecordsViewChange={onRecordsViewChange ?? (() => {})}
              onOpenIntake={onOpenIntake}
              extraComplianceRecords={attentionComplianceDrafts}
            />
          )}

          {activeTab === "schedule" && (
            <div className="h-full min-h-0 overflow-hidden">
              {tasksLoading ? (
                <div className="px-[10px] max-sm:px-0 py-4 space-y-3 max-pane:px-2">
                  <div className="h-20 bg-muted/50 rounded-xl animate-pulse" />
                  <div className="h-20 bg-muted/50 rounded-xl animate-pulse" />
                  <div className="h-20 bg-muted/50 rounded-xl animate-pulse" />
                </div>
              ) : (
                <div className="h-full flex flex-col min-h-0">
                  <div className="px-[10px] max-sm:px-0 pt-4 pb-3 border-b border-border/50 bg-background/95 backdrop-blur-sm sticky top-0 z-10 max-pane:px-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const today = new Date();
                            setInternalSelectedDate(today);
                            setIsDatePinned(true);
                            setActiveTab("schedule");
                          }}
                          className={cn(
                            "px-3 h-9 rounded-[12px] text-sm font-medium",
                            "bg-card border border-border/50",
                            "shadow-none hover:shadow-none"
                          )}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          aria-label="Previous day"
                          onClick={() => {
                            if (!selectedDate) return;
                            const newDate = subDays(selectedDate, 1);
                            setInternalSelectedDate(newDate);
                            setIsDatePinned(true);
                            setActiveTab("schedule");
                          }}
                          className={cn(
                            "h-9 w-9 rounded-[12px] grid place-items-center",
                            "bg-card border border-border/50",
                            "shadow-none hover:shadow-none"
                          )}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Next day"
                          onClick={() => {
                            if (!selectedDate) return;
                            const newDate = addDays(selectedDate, 1);
                            setInternalSelectedDate(newDate);
                            setIsDatePinned(true);
                            setActiveTab("schedule");
                          }}
                          className={cn(
                            "h-9 w-9 rounded-[12px] grid place-items-center",
                            "bg-card border border-border/50",
                            "shadow-none hover:shadow-none"
                          )}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-hidden">
                    {scheduleTasks.length > 0 ? (
                      <div className="h-full min-h-0">
                        <ScheduleView
                          tasks={scheduleTasks}
                          properties={properties}
                          selectedDate={isDatePinned ? selectedDate : undefined}
                          onTaskClick={onTaskClick}
                          selectedTaskId={selectedItem?.type === "task" ? selectedItem.id : undefined}
                          showDateHeaders={false}
                        />
                      </div>
                    ) : (
                      <div className="px-[10px] max-sm:px-0 py-4 flex flex-col items-center justify-center h-full min-h-[200px] text-center max-pane:px-2">
                        <Calendar className="h-12 w-12 text-muted-foreground/50 mb-3" />
                        <p className="text-sm font-medium text-foreground mb-1">
                          {selectedDate && isDatePinned
                            ? `No tasks scheduled for ${format(selectedDate, "EEEE, MMMM d")}`
                            : "No upcoming tasks"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedDate && isDatePinned
                            ? "Try selecting a different date or create a new task with a due date"
                            : "Create a task with a due date to see it here"}
                        </p>
                        <div className="mt-3 text-[11px] text-muted-foreground/80">
                          {scheduleStats.withDueDate === 0 ? (
                            <span>
                              You currently have 0 active tasks with a due date/time. ({scheduleStats.withoutDueDate} unscheduled)
                            </span>
                          ) : (
                            <span>
                              Active: {scheduleStats.active} • With due date: {scheduleStats.withDueDate} • Unscheduled: {scheduleStats.withoutDueDate}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {unscheduledTasks.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <div className="px-[10px] max-sm:px-0 mb-3 max-pane:px-2">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Unscheduled ({unscheduledTasks.length})
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Tasks without a due date
                        </p>
                      </div>
                      <div className="space-y-2 px-[10px] max-sm:px-0 pb-4 max-pane:px-2">
                        {unscheduledTasks.slice(0, 5).map((task) => {
                          const property = task.property_id ? propertyMap.get(task.property_id) : undefined;
                          return (
                            <div
                              key={task.id}
                              onClick={() => onTaskClick?.(task.id)}
                              className="p-3 rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-border/50"
                            >
                              <p className="text-sm font-medium text-foreground mb-1 line-clamp-2">
                                {task.title}
                              </p>
                              {property && (
                                <p className="text-xs text-muted-foreground">
                                  {property.name || property.address}
                                </p>
                              )}
                            </div>
                          );
                        })}
                        {unscheduledTasks.length > 5 && (
                          <p className="text-xs text-muted-foreground text-center pt-2">
                            +{unscheduledTasks.length - 5} more unscheduled tasks
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}
