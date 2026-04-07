import { useState, useMemo, useEffect, useLayoutEffect, useRef, useSyncExternalStore, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/animated-tabs";
import { TaskList } from "@/components/tasks/TaskList";
import { DailyBriefingCard } from "@/components/dashboard/DailyBriefingCard";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { OperationalStreamCard } from "@/components/dashboard/OperationalStreamCard";
import { useMessages } from "@/hooks/useMessages";
import { useCompliancePortfolioQuery } from "@/hooks/useCompliancePortfolioQuery";
import {
  CheckSquare,
  Calendar,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertTriangle,
  ShieldCheck,
  Waves,
  Upload,
  FileText,
  ClipboardCheck,
  MessageSquare,
  Building2,
  Search,
} from "lucide-react";
import { AnimatedIcon } from "@/components/ui/AnimatedIcon";
import { FilterChip } from "@/components/chips/filter";
import { FilterBar, type FilterGroup, type FilterOption } from "@/components/ui/filters/FilterBar";
import { PanelSectionTitle } from "@/components/ui/panel-section-title";
import { cn } from "@/lib/utils";
import type { IntakeMode } from "@/types/intake";
import {
  intakeAddRecordButtonClassName,
  intakeAddRecordCompactClassName,
  intakeAddRecordIconClassName,
  intakeAddRecordMicroClassName,
  intakeReportIssueButtonClassName,
  intakeReportIssueCompactClassName,
  intakeReportIssueIconClassName,
  intakeReportIssueMicroClassName,
} from "@/lib/intake-action-buttons";
import { LAYOUT_BREAKPOINTS } from "@/lib/layoutBreakpoints";
import { addDays, format, isAfter, startOfDay, subDays } from "date-fns";

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
  selectedPropertyIds?: Set<string>;
  onOpenIntake?: (mode: IntakeMode) => void;
  /** When true, Daily Briefing + radials render inside Attention tab (single-property hub). */
  embedBriefingInAttention?: boolean;
}

type TabBarDensity = "comfortable" | "compact" | "iconOnly";

/** At this width and below, tab bar hides icons (compact) until overflow forces icon-only. */
const TASK_TAB_NARROW_VIEWPORT_PX = LAYOUT_BREAKPOINTS.maxPane;

/** Stacked workbench (narrow window): never use icon-only strip; comfortable ↔ compact only. */
const TASK_TAB_MOBILE_STACK_MAX_PX = 767;

/** Subpixel / rounding slack when comparing intrinsic tab row width to `TabsList` clientWidth. */
const TASK_TAB_MEASURE_TOLERANCE_PX = 4;

const TASK_TAB_MICROCOPY = {
  attention: "Things that need a decision",
  tasks: "Work in progress",
  compliance: "Records and requirements",
  schedule: "What's coming up",
} as const;

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
type ComplianceFilter = "all" | "expiring" | "overdue" | "missing";
type ExpiryRange = "all" | "30" | "90" | "365";

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
  description?: string;
  imageUrl?: string | null;
  messageId?: string;
  complianceSeed?: {
    title: string;
    propertyName: string;
    propertyId?: string | null;
    complianceType: string;
  };
}

const STATUS_LABEL: Record<ComplianceStatus, string> = {
  healthy: "Healthy",
  expiring: "Expiring",
  overdue: "Overdue",
  missing: "Missing",
};

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
 * Desktop centre-column panel with 4 tabs:
 * - Attention: triage queue for incoming signals
 * - Tasks: full task list
 * - Compliance: status-driven compliance records
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
  selectedPropertyIds,
  onOpenIntake,
  embedBriefingInAttention = false,
}: TaskPanelProps = {}) {
  const navigate = useNavigate();
  const { messages } = useMessages();
  const { data: compliancePortfolio = [] } = useCompliancePortfolioQuery();

  const [internalActiveTab, setInternalActiveTab] = useState("attention");
  const [internalSelectedDate, setInternalSelectedDate] = useState<Date | undefined>(new Date());
  const [isDatePinned, setIsDatePinned] = useState(false);
  const [attentionFilter, setAttentionFilter] = useState<AttentionGroup | "all">("all");
  const [resolvedAttentionIds, setResolvedAttentionIds] = useState<Set<string>>(new Set());
  const [complianceSearch, setComplianceSearch] = useState("");
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>("all");
  const [compliancePropertyFilter, setCompliancePropertyFilter] = useState<string>("all");
  const [complianceTypeFilter, setComplianceTypeFilter] = useState<string>("all");
  const [complianceExpiryRange, setComplianceExpiryRange] = useState<ExpiryRange>("all");
  const [complianceSearchOpen, setComplianceSearchOpen] = useState(false);
  const [selectedComplianceId, setSelectedComplianceId] = useState<string | null>(null);
  const [attentionComplianceDrafts, setAttentionComplianceDrafts] = useState<ComplianceRecord[]>([]);
  const [tabBarDensity, setTabBarDensity] = useState<TabBarDensity>("comfortable");
  const narrowTaskTabViewport = useTaskTabNarrowViewport();
  const attentionCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tabsListRef = useRef<HTMLDivElement | null>(null);
  const measureTabComfortableRef = useRef<HTMLDivElement | null>(null);
  const measureTabCompactRef = useRef<HTMLDivElement | null>(null);
  const measureTabIconOnlyRef = useRef<HTMLDivElement | null>(null);
  const compliancePanelInteractionRef = useRef<HTMLDivElement | null>(null);

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
    const urgent: AttentionItem[] = complianceRecords
      .filter((record) => record.status === "overdue")
      .slice(0, 4)
      .map((record) => ({
        id: `urgent-${record.id}`,
        group: "urgent",
        title: `Possible ${record.complianceType.toLowerCase()} risk`,
        context: `${record.propertyName} • ${formatDueText(record.nextDueDate || record.expiryDate)}`,
        hint: "Urgent signal",
        description: `${record.title} is overdue and may need immediate attention.`,
      }));

    const review: AttentionItem[] = complianceRecords
      .filter((record) => record.status === "expiring" || record.status === "missing")
      .slice(0, 8)
      .map((record) => ({
        id: `review-${record.id}`,
        group: "review",
        title: `${record.complianceType} detected`,
        context: `${record.propertyName}`,
        hint:
          record.status === "missing"
            ? "Possible missing record"
            : `Possible expiry: ${formatDueText(record.nextDueDate || record.expiryDate)}`,
        description: "Filla suggests classifying this into compliance tracking.",
        complianceSeed: {
          title: record.title,
          propertyName: record.propertyName,
          propertyId: record.propertyId,
          complianceType: record.complianceType,
        },
      }));

    const recent: AttentionItem[] = messages.slice(0, 10).map((message: any) => {
      const authorName = formatAuthorDisplayName(message.author_name);
      return {
        id: `recent-msg-${message.id}`,
        group: "recent",
        messageId: message.id,
        title: "Incoming feed item",
        context: `${authorName} • ${format(new Date(message.created_at), "dd MMM, HH:mm")}`,
        hint: "New upload/message signal",
        description: message.body
          ? String(message.body).slice(0, 120)
          : "Incoming message requires triage.",
      };
    });

    if (urgent.length === 0 && review.length === 0 && recent.length === 0) {
      return [
        {
          id: "recent-empty-seed",
          group: "recent",
          title: "Photo uploaded",
          context: "Bird property • Today 09:14",
          hint: "Incoming feed item",
          description: "Use Attention to triage uploads into tasks or compliance.",
        },
      ];
    }

    return [...urgent, ...review, ...recent];
  }, [complianceRecords, messages]);

  const unresolvedAttentionItems = useMemo(() => {
    return attentionItems.filter((item) => !resolvedAttentionIds.has(item.id));
  }, [attentionItems, resolvedAttentionIds]);

  const filteredAttentionItems = useMemo(() => {
    return unresolvedAttentionItems.filter((item) => {
      if (attentionFilter !== "all" && item.group !== attentionFilter) return false;
      return true;
    });
  }, [attentionFilter, unresolvedAttentionItems]);

  const groupedAttentionItems = useMemo(() => {
    const urgent = filteredAttentionItems.filter((item) => item.group === "urgent");
    const review = filteredAttentionItems.filter((item) => item.group === "review");
    const recent = filteredAttentionItems.filter((item) => item.group === "recent");
    return { urgent, review, recent };
  }, [filteredAttentionItems]);

  const attentionSummary = useMemo(() => {
    const urgent = unresolvedAttentionItems.filter((item) => item.group === "urgent").length;
    const review = unresolvedAttentionItems.filter((item) => item.group === "review").length;
    const recent = unresolvedAttentionItems.filter((item) => item.group === "recent").length;
    return { urgent, review, recent };
  }, [unresolvedAttentionItems]);

  const riskSignals = useMemo(() => {
    return unresolvedAttentionItems.filter((item) => item.group === "urgent").slice(0, 5);
  }, [unresolvedAttentionItems]);

  const dominantAttentionProperty = useMemo(() => {
    const counts = new Map<string, number>();
    unresolvedAttentionItems.forEach((item) => {
      const property = item.context.split("•")[0]?.trim();
      if (!property) return;
      counts.set(property, (counts.get(property) || 0) + 1);
    });
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || "No dominant property";
  }, [unresolvedAttentionItems]);

  const filteredComplianceRecords = useMemo(() => {
    const query = complianceSearch.trim().toLowerCase();
    return complianceRecords.filter((record) => {
      if (
        query &&
        !`${record.title} ${record.propertyName} ${record.complianceType}`
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }

      if (complianceFilter !== "all") {
        if (complianceFilter === "expiring" && record.status !== "expiring") return false;
        if (complianceFilter === "overdue" && record.status !== "overdue") return false;
        if (complianceFilter === "missing" && record.status !== "missing") return false;
      }

      if (compliancePropertyFilter !== "all") {
        const opt = propertyOptions.find((p) => p.id === compliancePropertyFilter);
        if (!opt) return false;
        if (record.propertyId) {
          if (record.propertyId !== compliancePropertyFilter) return false;
        } else if (record.propertyName !== opt.name) {
          return false;
        }
      }
      if (complianceTypeFilter !== "all" && record.complianceType !== complianceTypeFilter)
        return false;

      if (complianceExpiryRange !== "all") {
        const due = daysUntil(record.nextDueDate || record.expiryDate);
        const max = Number(complianceExpiryRange);
        if (due === null || due < 0 || due > max) return false;
      }

      return true;
    });
  }, [
    complianceSearch,
    complianceRecords,
    complianceFilter,
    compliancePropertyFilter,
    complianceTypeFilter,
    complianceExpiryRange,
    propertyOptions,
  ]);

  const complianceTypeOptions = useMemo(() => {
    const typeSet = new Set<string>();
    complianceRecords.forEach((record) => {
      if (record.complianceType) typeSet.add(record.complianceType);
    });
    return Array.from(typeSet).sort((a, b) => a.localeCompare(b));
  }, [complianceRecords]);

  const compliancePrimaryOptions: FilterOption[] = useMemo(
    () => [
      { id: "cstat-all", label: "All", icon: <CheckSquare className="h-4 w-4" /> },
      { id: "cstat-expiring", label: "Expiring", icon: <CalendarClock className="h-4 w-4" /> },
      { id: "cstat-overdue", label: "Overdue", icon: <AlertTriangle className="h-4 w-4" />, color: "#EB6834" },
      { id: "cstat-missing", label: "Missing", icon: <FileText className="h-4 w-4" /> },
    ],
    []
  );

  const complianceSecondaryGroups: FilterGroup[] = useMemo(
    () => [
      {
        id: "compliance-property",
        label: "Property",
        options: propertyOptions.map((p) => ({
          id: `cprop-${p.id}`,
          label: p.name,
          icon: <Building2 className="h-4 w-4" />,
        })),
      },
      {
        id: "compliance-type",
        label: "Compliance Type",
        options: complianceTypeOptions.map((t) => ({
          id: `ctype-${encodeURIComponent(t)}`,
          label: t,
          icon: <ClipboardCheck className="h-4 w-4" />,
        })),
      },
      {
        id: "compliance-expiry",
        label: "Expiry Range",
        options: [
          { id: "cexp-30", label: "Within 30 days", icon: <Calendar className="h-4 w-4" /> },
          { id: "cexp-90", label: "Within 90 days", icon: <Calendar className="h-4 w-4" /> },
          { id: "cexp-365", label: "Within 1 year", icon: <Calendar className="h-4 w-4" /> },
        ],
      },
    ],
    [propertyOptions, complianceTypeOptions]
  );

  const complianceSelectedFilters = useMemo(() => {
    const s = new Set<string>();
    s.add(`cstat-${complianceFilter}`);
    if (compliancePropertyFilter !== "all") s.add(`cprop-${compliancePropertyFilter}`);
    if (complianceTypeFilter !== "all") s.add(`ctype-${encodeURIComponent(complianceTypeFilter)}`);
    if (complianceExpiryRange !== "all") s.add(`cexp-${complianceExpiryRange}`);
    return s;
  }, [complianceFilter, compliancePropertyFilter, complianceTypeFilter, complianceExpiryRange]);

  const handleComplianceFilterChange = useCallback(
    (filterId: string, selected: boolean) => {
      if (filterId.startsWith("cstat-")) {
        const key = filterId.slice(6) as ComplianceFilter;
        if (selected) setComplianceFilter(key);
        else if (complianceFilter === key) setComplianceFilter("all");
        return;
      }
      if (filterId.startsWith("cprop-")) {
        const id = filterId.slice(6);
        if (selected) setCompliancePropertyFilter(id);
        else setCompliancePropertyFilter("all");
        return;
      }
      if (filterId.startsWith("ctype-")) {
        const t = decodeURIComponent(filterId.slice(6));
        if (selected) setComplianceTypeFilter(t);
        else setComplianceTypeFilter("all");
        return;
      }
      if (filterId.startsWith("cexp-")) {
        const range = filterId.slice(5) as ExpiryRange;
        if (selected) setComplianceExpiryRange(range);
        else setComplianceExpiryRange("all");
        return;
      }
    },
    [complianceFilter]
  );

  const complianceHealth = useMemo(() => {
    return {
      healthy: complianceRecords.filter((record) => record.status === "healthy").length,
      expiring: complianceRecords.filter((record) => record.status === "expiring").length,
      overdue: complianceRecords.filter((record) => record.status === "overdue").length,
      missing: complianceRecords.filter((record) => record.status === "missing").length,
    };
  }, [complianceRecords]);

  const propertyComplianceStatus = useMemo(() => {
    const byProperty = new Map<
      string,
      { healthy: number; expiring: number; overdue: number; missing: number }
    >();
    complianceRecords.forEach((record) => {
      const key = record.propertyName || "Unassigned property";
      if (!byProperty.has(key)) byProperty.set(key, { healthy: 0, expiring: 0, overdue: 0, missing: 0 });
      byProperty.get(key)![record.status] += 1;
    });
    return Array.from(byProperty.entries())
      .map(([propertyName, counts]) => ({ propertyName, counts }))
      .sort((a, b) => b.counts.overdue + b.counts.expiring - (a.counts.overdue + a.counts.expiring))
      .slice(0, 6);
  }, [complianceRecords]);

  const upcomingExpiry = useMemo(() => {
    return complianceRecords
      .map((record) => ({
        ...record,
        dueIn: daysUntil(record.nextDueDate || record.expiryDate),
      }))
      .filter((record) => record.dueIn !== null && record.dueIn >= 0)
      .sort((a, b) => (a.dueIn as number) - (b.dueIn as number))
      .slice(0, 6);
  }, [complianceRecords]);

  const selectedComplianceRecord = useMemo(() => {
    if (!selectedComplianceId) return filteredComplianceRecords[0];
    return filteredComplianceRecords.find((record) => record.id === selectedComplianceId) || filteredComplianceRecords[0];
  }, [filteredComplianceRecords, selectedComplianceId]);

  useEffect(() => {
    if (!filteredComplianceRecords.length) {
      setSelectedComplianceId(null);
      return;
    }
    if (!selectedComplianceId || !filteredComplianceRecords.some((record) => record.id === selectedComplianceId)) {
      setSelectedComplianceId(filteredComplianceRecords[0].id);
    }
  }, [filteredComplianceRecords, selectedComplianceId]);

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
      inspectionHistory: ["Created from Attention tab"],
      linkedTasks: [],
      notes: "Promoted from Attention for compliance tracking.",
    };

    setAttentionComplianceDrafts((prev) => {
      if (prev.some((record) => record.id === newRecord.id)) return prev;
      return [newRecord, ...prev];
    });
    setSelectedComplianceId(newRecord.id);
  };

  const getComplianceStatusText = (record: ComplianceRecord): string => {
    const due = record.nextDueDate || record.expiryDate;
    const dayDelta = daysUntil(due);
    if (record.status === "missing") return "Status: Missing record";
    if (dayDelta === null) return `Status: ${STATUS_LABEL[record.status]}`;
    if (dayDelta < 0) return `Status: Overdue by ${Math.abs(dayDelta)} day${Math.abs(dayDelta) === 1 ? "" : "s"}`;
    if (dayDelta <= 30) return `Status: Expiring in ${dayDelta} day${dayDelta === 1 ? "" : "s"}`;
    return `Status: ${STATUS_LABEL[record.status]}`;
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
                      <AlertTriangle className="mr-1 h-4 w-4 shrink-0 text-[#FF6B6B] max-pane:mr-0.5" />
                      <span>Attention</span>
                    </span>
                  </div>
                  <div className={cn(taskTabShell, taskTabMeasurePad)}>
                    <span className="inline-flex min-w-0 items-center justify-center">
                      <CheckSquare className="mr-1 h-4 w-4 shrink-0 max-pane:mr-0.5" />
                      <span>Tasks</span>
                    </span>
                  </div>
                  <div className={cn(taskTabShell, taskTabMeasurePad)}>
                    <span className="inline-flex min-w-0 items-center justify-center">
                      <ShieldCheck className="mr-1 h-4 w-4 shrink-0 max-pane:mr-0.5" />
                      <span>Compliance</span>
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
                    <span className="inline-flex min-w-0 items-center justify-center">Attention</span>
                  </div>
                  <div className={cn(taskTabShell, taskTabMeasurePad)}>
                    <span className="inline-flex min-w-0 items-center justify-center">Tasks</span>
                  </div>
                  <div className={cn(taskTabShell, taskTabMeasurePad)}>
                    <span className="inline-flex min-w-0 items-center justify-center">Compliance</span>
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
                    <AlertTriangle className="h-4 w-4 text-[#FF6B6B]" />
                  </div>
                  <div
                    className={cn(
                      taskTabShell,
                      "inline-flex min-w-9 max-w-9 shrink-0 items-center justify-center px-0 text-sm font-medium"
                    )}
                  >
                    <CheckSquare className="h-4 w-4" />
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
                value="attention"
                title={tabTitle("Attention")}
                className={cn(taskTabShell, iconOnly ? taskTabIconOnly : taskTabPadLabeled)}
              >
                <span className="inline-flex max-w-full max-sm:w-full items-center justify-center min-w-0 max-sm:min-w-0">
                  {!compact && (
                    <AnimatedIcon
                      icon={AlertTriangle}
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
                  <span className={cn(iconOnly && taskTabLabelReveal, "max-sm:min-w-0 max-sm:truncate")}>Attention</span>
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="tasks"
                title={tabTitle("Tasks")}
                className={cn(taskTabShell, iconOnly ? taskTabIconOnly : taskTabPadLabeled)}
              >
                <span className="inline-flex max-w-full max-sm:w-full items-center justify-center min-w-0 max-sm:min-w-0">
                  {!compact && (
                    <CheckSquare
                      className={cn(
                        "shrink-0 h-4 w-4",
                        iconOnly
                          ? "mr-0 transition-[margin] duration-200 group-hover/task-tab:mr-1.5 group-focus-visible/task-tab:mr-1.5 group-data-[state=active]/task-tab:mr-1.5"
                          : "mr-1 max-pane:mr-0.5"
                      )}
                    />
                  )}
                  <span className={cn(iconOnly && taskTabLabelReveal, "max-sm:min-w-0 max-sm:truncate")}>Tasks</span>
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="compliance"
                title={tabTitle("Compliance")}
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
                  <span className={cn(iconOnly && taskTabLabelReveal, "max-sm:min-w-0 max-sm:truncate")}>Compliance</span>
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
            <div className="hidden min-w-0 layout:hidden sm:block lg:w-[139px] lg:shrink-0 lg:self-start">
              <div className={cn("w-full min-w-0", taskToolbarRecessedClass)}>
                <div
                  className={cn(
                    "grid h-12 min-h-12 w-full grid-cols-2 items-stretch gap-x-1.5 px-2 pt-[6px] pb-1.5",
                    "lg:h-auto lg:min-h-0 lg:flex lg:flex-col lg:gap-1.5",
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
            activeTab === "attention" && "h-[515px] shrink-0"
          )}
        >
          {activeTab === "attention" && (
            <div
              className="box-border h-[857px] max-h-full min-h-0 w-full overflow-y-auto px-[10px] max-sm:px-0 pt-[11px] pb-[11px] max-pane:px-2"
              style={{
                borderWidth: "0 0 10px",
                borderStyle: "none none solid",
                borderColor: "transparent transparent rgb(255, 255, 255)",
                borderImage:
                  "linear-gradient(90deg, rgba(255, 255, 255, 0.49) 0%, rgba(255, 255, 255, 0) 100%) 1 / 1 / 0 stretch",
              }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)] gap-3 items-start">
                <div className="space-y-3 min-w-0">
                  <div
                    className="rounded-xl px-0 py-0 ml-0 mr-0 flex flex-wrap gap-2 items-center"
                    style={{
                      boxShadow: "none",
                      background: "unset",
                      backgroundColor: "rgba(42, 41, 62, 0)",
                    }}
                  >
                    {(["all", "urgent", "review", "recent"] as const).map((filterKey) => (
                      <FilterChip
                        key={filterKey}
                        label={
                          filterKey === "all"
                          ? "All"
                          : filterKey === "urgent"
                          ? "Urgent"
                          : filterKey === "review"
                          ? "Needs Review"
                          : "Recent"
                        }
                        selected={attentionFilter === filterKey}
                        onSelect={() => setAttentionFilter(filterKey)}
                        className="h-[24px] gap-[9px]"
                      />
                    ))}

                  </div>

                  <div className="space-y-4">
                    {([
                      ["URGENT", groupedAttentionItems.urgent],
                      ["NEEDS REVIEW", groupedAttentionItems.review],
                      ["Recent", groupedAttentionItems.recent],
                    ] as const).map(([label, items]) =>
                      items.length > 0 ? (
                        <div key={label} className="space-y-2">
                          <p className="text-sm font-semibold tracking-wide text-[rgb(42,41,62)] px-1">{label}</p>
                          <div className="space-y-2">
                            {items.map((item) => (
                              <OperationalStreamCard
                                key={item.id}
                                id={`attention-card-${item.id}`}
                                cardRef={(node) => {
                                  attentionCardRefs.current[item.id] = node;
                                }}
                                icon={
                                  item.group === "urgent" ? (
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                  ) : item.group === "review" ? (
                                    <ShieldCheck className="h-4 w-4 text-teal-700" />
                                  ) : (
                                    <Upload className="h-4 w-4 text-muted-foreground" />
                                  )
                                }
                                title={item.title}
                                context={item.context}
                                hint={item.hint}
                                description={item.description}
                                imageUrl={item.imageUrl}
                                accent={item.group === "urgent" ? "red" : item.group === "review" ? "amber" : "slate"}
                                actions={
                                  item.group === "urgent"
                                    ? [
                                        {
                                          id: "report-issue",
                                          label: "Report Issue",
                                          onClick: () => {
                                            onOpenIntake?.("report_issue");
                                            resolveAttentionItem(item.id);
                                          },
                                        },
                                        {
                                          id: "ignore",
                                          label: "Ignore",
                                          onClick: () => resolveAttentionItem(item.id),
                                        },
                                      ]
                                    : item.group === "review"
                                    ? [
                                        {
                                          id: "add-compliance",
                                          label: "Add to Compliance",
                                          onClick: () => {
                                            addAttentionItemToCompliance(item);
                                            resolveAttentionItem(item.id);
                                          },
                                        },
                                        {
                                          id: "add-record",
                                          label: "Add Record",
                                          onClick: () => {
                                            onOpenIntake?.("add_record");
                                            resolveAttentionItem(item.id);
                                          },
                                        },
                                        {
                                          id: "report-issue",
                                          label: "Report Issue",
                                          onClick: () => {
                                            onOpenIntake?.("report_issue");
                                            resolveAttentionItem(item.id);
                                          },
                                        },
                                        {
                                          id: "save-document",
                                          label: "Save Document",
                                          onClick: () => resolveAttentionItem(item.id),
                                        },
                                      ]
                                    : [
                                        {
                                          id: "process",
                                          label: "Process",
                                          onClick: () => {
                                            if (item.messageId) onMessageClick?.(item.messageId);
                                            resolveAttentionItem(item.id);
                                          },
                                        },
                                        {
                                          id: "dismiss",
                                          label: "Dismiss",
                                          onClick: () => resolveAttentionItem(item.id),
                                        },
                                      ]
                                }
                              />
                            ))}
                          </div>
                        </div>
                      ) : null
                    )}
                  </div>

                  {filteredAttentionItems.length === 0 && (
                    <div className="rounded-xl bg-card/70 shadow-e1 p-4 text-sm text-muted-foreground">
                      No attention items match your current filters.
                    </div>
                  )}
                </div>

                <div className="lg:sticky lg:top-0 self-start align-top flex flex-wrap content-start items-start gap-3 [&>*]:w-full">
                  {embedBriefingInAttention && (
                    <DailyBriefingCard
                      tasks={tasks}
                      selectedPropertyIds={selectedPropertyIds}
                      properties={properties}
                      variant="sidebar"
                      showGreeting={false}
                    />
                  )}
                  <div
                    className="rounded-xl px-0 py-0"
                    style={{
                      color: "rgba(255, 107, 107, 1)",
                      marginLeft: 0,
                      marginRight: 0,
                      boxShadow: "none",
                      background: "unset",
                      backgroundColor: "rgba(42, 41, 62, 0)",
                      backgroundClip: "unset",
                      WebkitBackgroundClip: "unset",
                    }}
                  >
                    <div className="grid grid-cols-3 gap-2">
                      <div
                        className={cn(
                          "flex flex-col items-center justify-center text-center rounded-xl bg-transparent h-[98px] pt-[13px] pb-[18px]",
                          "shadow-[inset_2px_2px_5px_0px_rgba(0,0,0,0.1),inset_-2px_-2px_6px_0px_rgba(255,255,255,0.88)]"
                        )}
                      >
                        <p
                          className="inline-block bg-paper bg-paper-texture bg-clip-text leading-none text-shadow-neu"
                          style={{
                            width: 69,
                            fontSize: 46,
                            color: "rgba(235, 104, 52, 1)",
                            fontFamily: '"Inter Tight"',
                            fontWeight: 500,
                          }}
                        >
                          {attentionSummary.urgent}
                        </p>
                        <p className="mt-1 text-[12px] text-muted-foreground">Urgent</p>
                      </div>
                      <div
                        className={cn(
                          "flex flex-col items-center justify-center text-center rounded-xl bg-transparent h-[98px] pt-[13px] pb-[18px]",
                          "shadow-[inset_2px_2px_5px_0px_rgba(0,0,0,0.1),inset_-2px_-2px_6px_0px_rgba(255,255,255,0.88)]"
                        )}
                      >
                        <p
                          className="inline-block bg-paper bg-paper-texture bg-clip-text leading-none text-shadow-neu"
                          style={{
                            width: 69,
                            fontSize: 46,
                            color: "rgba(255, 184, 77, 1)",
                            fontFamily: '"Inter Tight"',
                            fontWeight: 500,
                          }}
                        >
                          {attentionSummary.review}
                        </p>
                        <p className="mt-1 text-[12px] text-muted-foreground">Needs review</p>
                      </div>
                      <div
                        className={cn(
                          "flex flex-col items-center justify-center text-center rounded-xl bg-transparent h-[98px] pt-[13px] pb-[18px]",
                          "shadow-[inset_2px_2px_5px_0px_rgba(0,0,0,0.1),inset_-2px_-2px_6px_0px_rgba(255,255,255,0.88)]"
                        )}
                      >
                        <p
                          className="inline-block bg-paper bg-paper-texture bg-clip-text leading-none text-shadow-neu"
                          style={{
                            width: 69,
                            fontSize: 46,
                            color: "rgba(133, 186, 188, 1)",
                            fontFamily: '"Inter Tight"',
                            fontWeight: 500,
                          }}
                        >
                          {attentionSummary.recent}
                        </p>
                        <p className="mt-1 w-[71px] text-[12px] leading-[14px] text-muted-foreground">
                          Recent signals
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-card/70 px-3 py-[15px]">
                    <PanelSectionTitle as="h3">Potential Risks</PanelSectionTitle>
                    <div className="space-y-1.5">
                      {riskSignals.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No critical risks detected.</p>
                      ) : (
                        riskSignals.map((signal) => (
                          <button
                            key={signal.id}
                            type="button"
                            onClick={() =>
                              attentionCardRefs.current[signal.id]?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              })
                            }
                            className="w-full flex text-left text-xs rounded-[8px] px-2 py-1 bg-background"
                          >
                            <span className="inline-flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                              {signal.title}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-card/70 px-3 py-[15px]">
                    <PanelSectionTitle as="h3">Quick Actions</PanelSectionTitle>
                    <div className="flex flex-row flex-nowrap items-start justify-start gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenIntake?.("add_record")}
                        className={intakeAddRecordCompactClassName}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-white" aria-hidden />
                        Add Record
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenIntake?.("report_issue")}
                        className={intakeReportIssueCompactClassName}
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0 text-white" aria-hidden />
                        Report Issue
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl bg-card/70 px-3 py-[15px]">
                    <PanelSectionTitle as="h3">Filla Insights</PanelSectionTitle>
                    <p className="text-xs text-foreground/90">
                      Most signals today relate to: <span className="font-medium">{dominantAttentionProperty}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {attentionSummary.urgent + attentionSummary.review} safety and compliance signals detected.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "tasks" && (
            <div className="h-full flex flex-col min-h-0 px-[10px] max-sm:px-0 pt-[8px] pb-0 max-pane:px-2">
              <TaskList
                tasks={tasks}
                properties={properties}
                tasksLoading={tasksLoading}
                onTaskClick={onTaskClick}
                selectedTaskId={selectedItem?.type === "task" ? selectedItem.id : undefined}
                filterToApply={filterToApply}
                filtersToApply={filtersToApply}
                selectedPropertyIds={selectedPropertyIds}
              />
            </div>
          )}

          {activeTab === "compliance" && (
            <div
              ref={compliancePanelInteractionRef}
              className="h-full min-h-0 flex flex-col px-[10px] max-sm:px-0 pt-[8px] pb-[11px] max-pane:px-2"
            >
              <div className="flex-shrink-0 mb-[18px]">
                <FilterBar
                  primaryOptions={compliancePrimaryOptions}
                  secondaryGroups={complianceSecondaryGroups}
                  selectedFilters={complianceSelectedFilters}
                  onFilterChange={handleComplianceFilterChange}
                  primaryOptionLimit={4}
                  clearPreservePrefixes={[]}
                  collapseFilterChipAfterMs={2000}
                  collapseInteractionRootRef={compliancePanelInteractionRef}
                  showClearButton={
                    complianceFilter !== "all" ||
                    compliancePropertyFilter !== "all" ||
                    complianceTypeFilter !== "all" ||
                    complianceExpiryRange !== "all" ||
                    complianceSearch.trim().length > 0
                  }
                  onClearAll={() => {
                    setComplianceFilter("all");
                    setCompliancePropertyFilter("all");
                    setComplianceTypeFilter("all");
                    setComplianceExpiryRange("all");
                    setComplianceSearch("");
                    setComplianceSearchOpen(false);
                  }}
                  primaryTrailing={
                    <FilterChip
                      label="Search"
                      icon={<Search className="h-4 w-4" />}
                      selected={
                        complianceSearchOpen || complianceSearch.trim().length > 0
                      }
                      onSelect={() => setComplianceSearchOpen((open) => !open)}
                      className="h-[24px]"
                    />
                  }
                />
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    complianceSearchOpen || complianceSearch.trim().length > 0
                      ? "grid-rows-[1fr]"
                      : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden min-h-0">
                    <input
                      type="search"
                      value={complianceSearch}
                      onChange={(event) => setComplianceSearch(event.target.value)}
                      placeholder="Search certificates or inspections"
                      className={cn(
                        "mt-2 w-full rounded-[10px] bg-background shadow-[inset_1px_2px_4px_rgba(0,0,0,0.12),inset_-1px_-1px_2px_rgba(255,255,255,0.6)]",
                        "px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                      )}
                      aria-label="Search compliance records"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)] gap-3 items-start">
                  <div className="space-y-3 min-w-0">
                    {filteredComplianceRecords.map((record) => (
                      <OperationalStreamCard
                        key={record.id}
                        id={`compliance-card-${record.id}`}
                        onClick={() => setSelectedComplianceId(record.id)}
                        icon={
                          record.status === "overdue" ? (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          ) : record.status === "expiring" ? (
                            <Waves className="h-4 w-4 text-amber-600" />
                          ) : record.status === "missing" ? (
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          )
                        }
                        title={record.title}
                        context={record.propertyName}
                        hint={`Expires: ${formatDueText(record.nextDueDate || record.expiryDate)}`}
                        statusText={getComplianceStatusText(record)}
                        accent={
                          record.status === "overdue"
                            ? "red"
                            : record.status === "expiring"
                            ? "amber"
                            : record.status === "healthy"
                            ? "green"
                            : "slate"
                        }
                        actions={[
                          {
                            id: "create-inspection-task",
                            label: "Create Inspection Task",
                            onClick: () => onOpenIntake?.("report_issue"),
                          },
                          {
                            id: "upload-certificate",
                            label: "Upload New Certificate",
                            onClick: () => navigate("/compliance"),
                          },
                          {
                            id: "view-record",
                            label: "View Record",
                            onClick: () => setSelectedComplianceId(record.id),
                          },
                        ]}
                        className={cn(selectedComplianceRecord?.id === record.id && "ring-1 ring-[#8EC9CE]")}
                      />
                    ))}

                    {filteredComplianceRecords.length === 0 && (
                      <div className="rounded-xl bg-card/70 shadow-e1 p-4 text-sm text-muted-foreground">
                        No compliance records match your current filters.
                      </div>
                    )}
                </div>

                <div className="lg:sticky lg:top-3 self-start space-y-3">
                  <div
                    className="rounded-xl px-0 py-0"
                    style={{
                      marginLeft: 0,
                      marginRight: 0,
                      boxShadow: "none",
                      background: "unset",
                      backgroundColor: "rgba(42, 41, 62, 0)",
                      backgroundClip: "unset",
                      WebkitBackgroundClip: "unset",
                    }}
                  >
                    <PanelSectionTitle as="h3" className="ml-2">
                      Compliance Health
                    </PanelSectionTitle>
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                      {(
                        [
                          {
                            label: "Healthy",
                            value: complianceHealth.healthy,
                            color: "rgba(16, 185, 129, 1)",
                          },
                          {
                            label: "Expiring",
                            value: complianceHealth.expiring,
                            color: "rgba(255, 184, 77, 1)",
                          },
                          {
                            label: "Overdue",
                            value: complianceHealth.overdue,
                            color: "rgba(235, 104, 52, 1)",
                          },
                          {
                            label: "Missing",
                            value: complianceHealth.missing,
                            color: "rgba(100, 116, 139, 1)",
                          },
                        ] as const
                      ).map((metric) => (
                        <div
                          key={metric.label}
                          className={cn(
                            "flex min-w-0 flex-col items-center justify-center text-center rounded-xl bg-transparent h-[98px] pt-[13px] pb-[18px] px-0.5",
                            "shadow-[inset_2px_2px_5px_0px_rgba(0,0,0,0.1),inset_-2px_-2px_6px_0px_rgba(255,255,255,0.88)]"
                          )}
                        >
                          <p
                            className="inline-block bg-paper bg-paper-texture bg-clip-text leading-none text-shadow-neu tabular-nums"
                            style={{
                              maxWidth: "100%",
                              fontSize: 34,
                              color: metric.color,
                              fontFamily: '"Inter Tight"',
                              fontWeight: 500,
                            }}
                          >
                            {metric.value}
                          </p>
                          <p className="mt-1 text-[11px] sm:text-[12px] text-muted-foreground leading-tight">
                            {metric.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-card/70 shadow-e1 p-3">
                    <PanelSectionTitle as="h3">Property Compliance Status</PanelSectionTitle>
                    <div className="space-y-1.5">
                      {propertyComplianceStatus.map((row) => {
                        const statusText =
                          row.counts.overdue > 0
                            ? `${row.counts.overdue} Overdue`
                            : row.counts.expiring > 0
                            ? `${row.counts.expiring} Expiring`
                            : row.counts.missing > 0
                            ? `${row.counts.missing} Missing`
                            : "Healthy";
                        return (
                          <p key={row.propertyName} className="text-xs text-foreground/90">
                            {row.propertyName} - {statusText}
                          </p>
                        );
                      })}
                      {propertyComplianceStatus.length === 0 && (
                        <p className="text-xs text-muted-foreground">No property compliance records yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-card/70 shadow-e1 p-3">
                    <PanelSectionTitle as="h3">Upcoming Expiry</PanelSectionTitle>
                    <div className="space-y-1.5">
                      {upcomingExpiry.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No upcoming expiries.</p>
                      ) : (
                        upcomingExpiry.slice(0, 3).map((record) => (
                          <p key={record.id} className="text-xs text-foreground/90">
                            {record.complianceType} - {record.dueIn} day{record.dueIn === 1 ? "" : "s"}
                          </p>
                        ))
                      )}
                    </div>
                  </div>

                  {selectedComplianceRecord && (
                    <div className="rounded-xl bg-card/70 shadow-e1 p-3">
                      <PanelSectionTitle as="h3">Compliance Record Detail</PanelSectionTitle>
                      <div className="space-y-1.5 text-xs">
                        <p>
                          <span className="text-muted-foreground">Compliance Type:</span>{" "}
                          {selectedComplianceRecord.complianceType}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Linked Property:</span>{" "}
                          {selectedComplianceRecord.propertyName}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Expiry Date:</span>{" "}
                          {formatDueText(
                            selectedComplianceRecord.nextDueDate || selectedComplianceRecord.expiryDate
                          )}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Linked Document:</span>{" "}
                          {selectedComplianceRecord.linkedDocument}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Inspection History:</span>{" "}
                          {selectedComplianceRecord.inspectionHistory.join(", ")}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Linked Tasks:</span>{" "}
                          {selectedComplianceRecord.linkedTasks.length || 0}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Notes:</span>{" "}
                          {selectedComplianceRecord.notes}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => onOpenIntake?.("add_record")} className={intakeAddRecordMicroClassName}>
                          <FileText className="h-3 w-3 shrink-0 text-white" aria-hidden />
                          Add Record
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenIntake?.("report_issue")}
                          className={intakeReportIssueMicroClassName}
                        >
                          <Plus className="h-3 w-3 shrink-0 text-white" aria-hidden />
                          Create Inspection Task
                        </button>
                        <button type="button" className="text-[11px] rounded-[8px] px-2 py-1 bg-background shadow-e1 hover:shadow-e2">
                          Update Expiry
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>
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
