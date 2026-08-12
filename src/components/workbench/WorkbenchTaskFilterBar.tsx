import { useCallback, useMemo, useState, type RefObject } from "react";
import {
  AlertTriangle,
  ArrowDown,
  Building2,
  Calendar,
  Minus,
  User,
  Users,
} from "lucide-react";
import { FilterBar, type FilterGroup, type FilterOption } from "@/components/ui/filters/FilterBar";
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

type WorkbenchTaskFilterBarProps = {
  tasks?: any[];
  properties?: any[];
  hidePrimaryUrgentChip?: boolean;
  /** Hide Due / Urgent / My Tasks quick chips (e.g. Tasks tab uses its own list tabs). */
  hidePrimaryQuickChips?: boolean;
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
  showSortBar = false,
  messagesMode = false,
  messageAuthors = [],
  selectedMessageAuthorKey = null,
  onSelectMessageAuthor,
  className,
  collapseInteractionRootRef,
}: WorkbenchTaskFilterBarProps) {
  const { selectedFilters, setSelectedFilters, sortBy, setSortBy } = useWorkbenchControls();
  const { members } = useOrgMembers();
  const { teams } = useTeams();
  const [filterExpanded, setFilterExpanded] = useState(false);

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
  }, [hidePrimaryUrgentChip, hidePrimaryQuickChips]);

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
        label: "Date Due",
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
        label: "Assigned To",
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
      setSelectedFilters((prev) => {
        const next = new Set(prev);
        if (selected) {
          next.add(filterId);
        } else {
          next.delete(filterId);
        }
        return next;
      });
    },
    [setSelectedFilters]
  );

  const midControls = messagesMode ? (
    <MessageAuthorAvatarStrip
      authors={messageAuthors}
      selectedAuthorKey={selectedMessageAuthorKey}
      onSelectAuthor={(key) => onSelectMessageAuthor?.(key)}
    />
  ) : (
    <StatusFilterIconStrip
      selectedFilters={selectedFilters}
      onFilterChange={handleFilterChange}
    />
  );

  return (
    <FilterBar
      primaryOptions={primaryOptions}
      secondaryGroups={secondaryGroups}
      selectedFilters={selectedFilters}
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
