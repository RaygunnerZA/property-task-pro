import { useCallback, useMemo, useState, type RefObject } from "react";
import {
  AlertTriangle,
  ArrowDown,
  Building2,
  Calendar,
  Minus,
  SlidersHorizontal,
  User,
  Users,
} from "lucide-react";
import { FilterBar, type FilterGroup, type FilterOption } from "@/components/ui/filters/FilterBar";
import { FilterDimensionSheet } from "@/components/ui/filters/FilterDimensionSheet";
import { useIsBelowMd } from "@/hooks/use-mobile";
import { SortBar } from "@/components/ui/filters/SortBar";
import { StatusFilterIconStrip } from "@/components/ui/filters/StatusFilterIconStrip";
import {
  MessageAuthorAvatarStrip,
  type MessageAuthorFilterOption,
} from "@/components/ui/filters/MessageAuthorAvatarStrip";
import { useWorkbenchControls } from "@/contexts/WorkbenchControlsContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useTeams } from "@/hooks/useTeams";
import { TASK_STATUS_ORDER, TASK_STATUS_VISUALS } from "@/lib/taskStatus";
import { cn } from "@/lib/utils";

export type CalendarListScope = "all" | "urgent" | "mine";

const CALENDAR_SCOPE_FILTER_IDS: Record<CalendarListScope, string> = {
  all: "calendar-scope-all",
  urgent: "calendar-scope-urgent",
  mine: "calendar-scope-mine",
};

type WorkbenchTaskFilterBarProps = {
  tasks?: any[];
  properties?: any[];
  hidePrimaryUrgentChip?: boolean;
  /** Hide Due / Urgent / My Tasks quick chips (e.g. Tasks tab uses its own list tabs). */
  hidePrimaryQuickChips?: boolean;
  /**
   * Calendar tab: exclusive All / Urgent / My tasks chips before status icons
   * (replaces the default Due / Urgent / My Tasks quick chips).
   */
  calendarListScope?: {
    value: CalendarListScope;
    onChange: (value: CalendarListScope) => void;
  };
  /** Show SORT immediately to the right of FILTER (expands options inline). */
  showSortBar?: boolean;
  /**
   * Messages tab: status chips are replaced by recent-message author avatars.
   */
  messagesMode?: boolean;
  messageAuthors?: MessageAuthorFilterOption[];
  selectedMessageAuthorKey?: string | null;
  onSelectMessageAuthor?: (authorKey: string | null) => void;
  className?: string;
  collapseInteractionRootRef?: RefObject<HTMLElement | null>;
};

export function WorkbenchTaskFilterBar({
  tasks = [],
  properties = [],
  hidePrimaryUrgentChip = false,
  hidePrimaryQuickChips = false,
  calendarListScope,
  showSortBar = false,
  messagesMode = false,
  messageAuthors = [],
  selectedMessageAuthorKey = null,
  onSelectMessageAuthor,
  className,
  collapseInteractionRootRef,
}: WorkbenchTaskFilterBarProps) {
  const { selectedFilters, setSelectedFilters, sortBy, setSortBy, searchQuery, setSearchQuery } =
    useWorkbenchControls();
  const { members } = useOrgMembers();
  const { teams } = useTeams();
  const belowMd = useIsBelowMd();
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const allSpaces = useMemo(() => {
    const spaceMap = new Map<string, { id: string; name: string; property_id: string }>();
    tasks.forEach((task: any) => {
      const spaces =
        typeof task.spaces === "string" ? JSON.parse(task.spaces) : task.spaces || [];
      if (Array.isArray(spaces)) {
        spaces.forEach((space: any) => {
          if (space.id && !spaceMap.has(space.id)) {
            spaceMap.set(space.id, {
              id: space.id,
              name: space.name || space.type || "Unknown",
              property_id: task.property_id,
            });
          }
        });
      }
    });
    return Array.from(spaceMap.values());
  }, [tasks]);

  const primaryOptions: FilterOption[] = useMemo(() => {
    if (calendarListScope) {
      return [
        { id: CALENDAR_SCOPE_FILTER_IDS.all, label: "All" },
        {
          id: CALENDAR_SCOPE_FILTER_IDS.urgent,
          label: "Urgent",
          icon: <AlertTriangle className="h-4 w-4" />,
          color: "#EB6834",
        },
        {
          id: CALENDAR_SCOPE_FILTER_IDS.mine,
          label: "My tasks",
          icon: <User className="h-4 w-4" />,
        },
      ];
    }
    if (hidePrimaryQuickChips) return [];
    const opts: FilterOption[] = [
      {
        id: "filter-due",
        label: "Due",
        icon: <Calendar className="h-4 w-4" />,
      },
      {
        id: "filter-urgent",
        label: "Urgent",
        icon: <AlertTriangle className="h-4 w-4" />,
        color: "#EB6834",
      },
      {
        id: "filter-assigned-me",
        label: "My tasks",
        icon: <User className="h-4 w-4" />,
      },
    ];
    if (hidePrimaryUrgentChip) {
      return opts.filter((o) => o.id !== "filter-urgent");
    }
    return opts;
  }, [calendarListScope, hidePrimaryUrgentChip, hidePrimaryQuickChips]);

  const effectiveSelectedFilters = useMemo(() => {
    if (!calendarListScope) return selectedFilters;
    const next = new Set(selectedFilters);
    Object.values(CALENDAR_SCOPE_FILTER_IDS).forEach((id) => next.delete(id));
    // "All" is the unfiltered default — keep it unselected so the chip and
    // FunnelX clear control stay inactive until Urgent / My tasks (or other filters) apply.
    if (calendarListScope.value !== "all") {
      next.add(CALENDAR_SCOPE_FILTER_IDS[calendarListScope.value]);
    }
    return next;
  }, [calendarListScope, selectedFilters]);

  const secondaryGroups: FilterGroup[] = useMemo(
    () => [
      {
        id: "status",
        label: "Status",
        options: TASK_STATUS_ORDER.map((status) => {
          const visual = TASK_STATUS_VISUALS[status];
          const Icon = visual.Icon;
          return {
            id: visual.filterId,
            label: visual.label,
            icon: <Icon className={cn("h-4 w-4", visual.filterIconClassName)} />,
          };
        }),
      },
      {
        id: "date-due",
        label: "Date due",
        options: [
          {
            id: "filter-date-today",
            label: "Today",
            icon: <Calendar className="h-4 w-4" />,
          },
          {
            id: "filter-date-tomorrow",
            label: "Tomorrow",
            icon: <Calendar className="h-4 w-4" />,
          },
          {
            id: "filter-date-this-week",
            label: "This Week",
            icon: <Calendar className="h-4 w-4" />,
          },
          {
            id: "filter-date-overdue",
            label: "Overdue",
            icon: <AlertTriangle className="h-4 w-4" />,
            color: "#EB6834",
          },
          {
            id: "filter-date-unscheduled",
            label: "No date",
            icon: <Calendar className="h-4 w-4" />,
          },
        ],
      },
      {
        id: "priority",
        label: "Priority",
        options: [
          {
            id: "filter-priority-low",
            label: "Low",
            icon: <ArrowDown className="h-4 w-4" />,
          },
          {
            id: "filter-priority-normal",
            label: "Normal",
            icon: <Minus className="h-4 w-4" />,
          },
          {
            id: "filter-priority-high",
            label: "High",
            icon: <AlertTriangle className="h-4 w-4" />,
          },
          {
            id: "filter-priority-urgent",
            label: "Urgent",
            icon: <AlertTriangle className="h-4 w-4" />,
            color: "#EB6834",
          },
        ],
      },
      {
        id: "assigned-to",
        label: "Assigned to",
        options: [
          ...members.map((member) => ({
            id: `filter-assigned-person-${member.user_id}`,
            label: member.display_name || member.email || "Unknown",
            icon: <User className="h-4 w-4" />,
          })),
          ...teams.map((team) => ({
            id: `filter-assigned-team-${team.id}`,
            label: team.name,
            icon: <Users className="h-4 w-4" />,
          })),
        ],
      },
      {
        id: "property",
        label: "Property",
        options: properties.map((property) => ({
          id: `filter-property-${property.id}`,
          label: property.name || property.address || "Unknown",
          icon: <Building2 className="h-4 w-4" />,
        })),
      },
      {
        id: "space",
        label: "Space",
        options: allSpaces.map((space) => ({
          id: `filter-space-${space.id}`,
          label: space.name,
          icon: <Building2 className="h-4 w-4" />,
        })),
      },
    ],
    [allSpaces, members, properties, teams]
  );

  const handleFilterChange = useCallback(
    (filterId: string, selected: boolean) => {
      if (calendarListScope) {
        const scopeEntry = (
          Object.entries(CALENDAR_SCOPE_FILTER_IDS) as Array<[CalendarListScope, string]>
        ).find(([, id]) => id === filterId);
        if (scopeEntry) {
          // Selecting a scope activates it; clearing / deselecting returns to default "all".
          calendarListScope.onChange(selected ? scopeEntry[0] : "all");
          return;
        }
      }
      const next = new Set(selectedFilters);
      if (selected) next.add(filterId);
      else next.delete(filterId);
      setSelectedFilters(next);
    },
    [calendarListScope, selectedFilters, setSelectedFilters]
  );

  const sheetGroups = useMemo(
    () =>
      secondaryGroups.map((group) => ({
        id: group.id,
        label: group.label,
        options: group.options.map((option) => ({ id: option.id, label: option.label })),
      })),
    [secondaryGroups]
  );

  const activeFilterCount = useMemo(() => {
    const sheetIds = new Set(sheetGroups.flatMap((group) => group.options.map((option) => option.id)));
    let count = 0;
    selectedFilters.forEach((id) => {
      if (sheetIds.has(id) || id === "filter-urgent" || id === "filter-due" || id === "filter-assigned-me") {
        count += 1;
      }
    });
    return count;
  }, [selectedFilters, sheetGroups]);

  const midControls = messagesMode ? (
    <MessageAuthorAvatarStrip
      authors={messageAuthors}
      selectedAuthorKey={selectedMessageAuthorKey}
      onSelectAuthor={(key) => onSelectMessageAuthor?.(key)}
    />
  ) : (
    <StatusFilterIconStrip
      selectedFilters={effectiveSelectedFilters}
      onFilterChange={handleFilterChange}
    />
  );

  if (belowMd) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {calendarListScope ? (
          <div
            role="tablist"
            aria-label="Calendar task scope"
            className="chip-row-scroll flex min-w-0 items-center gap-2"
          >
            {primaryOptions.map((option) => {
              const selected = effectiveSelectedFilters.has(option.id) ||
                (option.id === CALENDAR_SCOPE_FILTER_IDS.all && calendarListScope.value === "all");
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => handleFilterChange(option.id, !effectiveSelectedFilters.has(option.id))}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm shadow-sm",
                    selected ? "bg-primary/20 font-medium text-foreground" : "bg-card text-muted-foreground"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-card px-4 text-sm font-medium text-foreground shadow-sm"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
            {activeFilterCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/25 px-1 text-xs tabular-nums">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
          {messagesMode ? midControls : null}
          {showSortBar ? (
            <SortBar sortBy={sortBy} onSortChange={setSortBy} />
          ) : null}
        </div>
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search"
          aria-label="Search"
          className="h-11 w-full rounded-xl bg-card px-3 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground"
        />
        <FilterDimensionSheet
          open={filterSheetOpen}
          onOpenChange={setFilterSheetOpen}
          groups={sheetGroups}
          selectedIds={selectedFilters}
          onToggle={handleFilterChange}
        />
      </div>
    );
  }

  return (
    <FilterBar
      primaryOptions={primaryOptions}
      secondaryGroups={secondaryGroups}
      selectedFilters={effectiveSelectedFilters}
      onFilterChange={handleFilterChange}
      className={cn(className)}
      collapseFilterChipAfterMs={2000}
      collapseInteractionRootRef={collapseInteractionRootRef}
      onExpandedChange={showSortBar ? setFilterExpanded : undefined}
      afterFilterTrigger={
        <>
          {midControls}
          {showSortBar ? (
            <SortBar
              sortBy={sortBy}
              onSortChange={setSortBy}
              forceCollapsed={filterExpanded}
            />
          ) : null}
        </>
      }
    />
  );
}
