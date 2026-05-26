import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type WorkbenchSortBy = "priority" | "due_date" | "updated";

export type WorkbenchFilterDraft = {
  propertyId: string;
  statusIds: string[];
  priorityId: string;
  assigneeMode: "all" | "me-or-teams" | "me";
  dueDateMode: "all" | "today" | "next-30" | "overdue";
  showMyTasksOnly: boolean;
};

const STATUS_FILTER_IDS = [
  "filter-status-todo",
  "filter-status-in-progress",
  "filter-status-waiting-review",
  "filter-status-blocked",
  "filter-status-done",
] as const;

/** No task filters applied — used on Home and when the user clears filters. */
export const EMPTY_FILTER_DRAFT: WorkbenchFilterDraft = {
  propertyId: "all",
  statusIds: [],
  priorityId: "all",
  assigneeMode: "all",
  dueDateMode: "all",
  showMyTasksOnly: false,
};

/** Default when opening Issues / Records / Agenda workbench pages. */
export const DEFAULT_FILTER_DRAFT: WorkbenchFilterDraft = {
  propertyId: "all",
  statusIds: [],
  priorityId: "all",
  assigneeMode: "me-or-teams",
  dueDateMode: "next-30",
  showMyTasksOnly: true,
};

export function draftToFilterIds(draft: WorkbenchFilterDraft): Set<string> {
  const ids = new Set<string>();

  if (draft.propertyId !== "all") {
    ids.add(`filter-property-${draft.propertyId}`);
  }

  draft.statusIds.forEach((id) => ids.add(id));

  if (draft.priorityId !== "all") {
    ids.add(draft.priorityId);
  }

  if (draft.showMyTasksOnly || draft.assigneeMode === "me" || draft.assigneeMode === "me-or-teams") {
    ids.add("filter-assigned-me");
  }

  if (draft.dueDateMode === "today") ids.add("filter-date-today");
  if (draft.dueDateMode === "overdue") ids.add("filter-date-overdue");
  if (draft.dueDateMode === "next-30") ids.add("filter-date-this-week");

  return ids;
}

export function filterIdsToDraft(
  filters: Set<string>,
  defaultPropertyId: string
): WorkbenchFilterDraft {
  const statusIds = STATUS_FILTER_IDS.filter((id) => filters.has(id));
  const propertyFilter = Array.from(filters).find((id) => id.startsWith("filter-property-"));
  const priorityFilter = Array.from(filters).find((id) => id.startsWith("filter-priority-"));

  let dueDateMode: WorkbenchFilterDraft["dueDateMode"] = "all";
  if (filters.has("filter-date-today")) dueDateMode = "today";
  else if (filters.has("filter-date-overdue")) dueDateMode = "overdue";
  else if (filters.has("filter-date-this-week")) dueDateMode = "next-30";

  return {
    propertyId: propertyFilter ? propertyFilter.replace("filter-property-", "") : "all",
    statusIds,
    priorityId: priorityFilter ?? "all",
    assigneeMode: filters.has("filter-assigned-me") ? "me-or-teams" : "all",
    dueDateMode,
    showMyTasksOnly: filters.has("filter-assigned-me"),
  };
}

type WorkbenchControlsContextValue = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedFilters: Set<string>;
  setSelectedFilters: (filters: Set<string>) => void;
  filterDraft: WorkbenchFilterDraft;
  setFilterDraft: (draft: WorkbenchFilterDraft) => void;
  applyFilterDraft: () => void;
  clearAllFilters: () => void;
  sortBy: WorkbenchSortBy;
  setSortBy: (sort: WorkbenchSortBy) => void;
  activeFilterCount: number;
};

const WorkbenchControlsContext = createContext<WorkbenchControlsContextValue | null>(null);

type WorkbenchControlsProviderProps = {
  children: ReactNode;
  defaultPropertyId?: string;
  /** When provided (including an empty set), skips DEFAULT_FILTER_DRAFT pre-applied filters. */
  initialFilters?: Set<string>;
};

export function WorkbenchControlsProvider({
  children,
  defaultPropertyId = "all",
  initialFilters,
}: WorkbenchControlsProviderProps) {
  const hasExplicitInitialFilters = initialFilters !== undefined;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(() =>
    hasExplicitInitialFilters
      ? new Set(initialFilters)
      : draftToFilterIds({ ...DEFAULT_FILTER_DRAFT, propertyId: defaultPropertyId })
  );
  const [filterDraft, setFilterDraft] = useState<WorkbenchFilterDraft>(() => {
    if (hasExplicitInitialFilters) {
      return initialFilters.size === 0
        ? { ...EMPTY_FILTER_DRAFT }
        : filterIdsToDraft(initialFilters, defaultPropertyId);
    }
    return { ...DEFAULT_FILTER_DRAFT, propertyId: defaultPropertyId };
  });
  const [sortBy, setSortBy] = useState<WorkbenchSortBy>("priority");

  const applyFilterDraft = useCallback(() => {
    setSelectedFilters(draftToFilterIds(filterDraft));
  }, [filterDraft]);

  const clearAllFilters = useCallback(() => {
    setFilterDraft({ ...EMPTY_FILTER_DRAFT });
    setSelectedFilters(new Set());
  }, []);

  const activeFilterCount = selectedFilters.size;

  const value = useMemo(
    () => ({
      searchQuery,
      setSearchQuery,
      selectedFilters,
      setSelectedFilters,
      filterDraft,
      setFilterDraft,
      applyFilterDraft,
      clearAllFilters,
      sortBy,
      setSortBy,
      activeFilterCount,
    }),
    [
      searchQuery,
      selectedFilters,
      filterDraft,
      applyFilterDraft,
      clearAllFilters,
      sortBy,
      activeFilterCount,
    ]
  );

  return (
    <WorkbenchControlsContext.Provider value={value}>{children}</WorkbenchControlsContext.Provider>
  );
}

export function useWorkbenchControls() {
  const ctx = useContext(WorkbenchControlsContext);
  if (!ctx) {
    throw new Error("useWorkbenchControls must be used within WorkbenchControlsProvider");
  }
  return ctx;
}

export function useOptionalWorkbenchControls() {
  return useContext(WorkbenchControlsContext);
}
