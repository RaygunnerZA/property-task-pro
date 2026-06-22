import { useCallback, useMemo, type RefObject } from "react";
import {
  AlertTriangle,
  ArrowDown,
  Building2,
  Calendar,
  CheckSquare,
  Clock,
  Eye,
  Minus,
  User,
  Users,
} from "lucide-react";
import { FilterBar, type FilterGroup, type FilterOption } from "@/components/ui/filters/FilterBar";
import { useWorkbenchControls } from "@/contexts/WorkbenchControlsContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useTeams } from "@/hooks/useTeams";
import { cn } from "@/lib/utils";

type WorkbenchTaskFilterBarProps = {
  tasks?: any[];
  properties?: any[];
  hidePrimaryUrgentChip?: boolean;
  className?: string;
  collapseInteractionRootRef?: RefObject<HTMLElement | null>;
};

export function WorkbenchTaskFilterBar({
  tasks = [],
  properties = [],
  hidePrimaryUrgentChip = false,
  className,
  collapseInteractionRootRef,
}: WorkbenchTaskFilterBarProps) {
  const { selectedFilters, setSelectedFilters } = useWorkbenchControls();
  const { members } = useOrgMembers();
  const { teams } = useTeams();

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
        label: "My Tasks",
        icon: <User className="h-4 w-4" />,
      },
    ];
    if (hidePrimaryUrgentChip) {
      return opts.filter((o) => o.id !== "filter-urgent");
    }
    return opts;
  }, [hidePrimaryUrgentChip]);

  const secondaryGroups: FilterGroup[] = useMemo(
    () => [
      {
        id: "status",
        label: "Status",
        options: [
          {
            id: "filter-status-todo",
            label: "To-Do",
            icon: <CheckSquare className="h-4 w-4" />,
          },
          {
            id: "filter-status-in-progress",
            label: "In Progress",
            icon: <Clock className="h-4 w-4" />,
          },
          {
            id: "filter-status-waiting-review",
            label: "Waiting review",
            icon: <Eye className="h-4 w-4" />,
          },
          {
            id: "filter-status-blocked",
            label: "Blocked",
            icon: <AlertTriangle className="h-4 w-4" />,
          },
          {
            id: "filter-status-done",
            label: "Done",
            icon: <CheckSquare className="h-4 w-4" />,
          },
        ],
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

  return (
    <FilterBar
      primaryOptions={primaryOptions}
      secondaryGroups={secondaryGroups}
      selectedFilters={selectedFilters}
      onFilterChange={handleFilterChange}
      className={cn(className)}
      collapseFilterChipAfterMs={2000}
      collapseInteractionRootRef={collapseInteractionRootRef}
    />
  );
}
