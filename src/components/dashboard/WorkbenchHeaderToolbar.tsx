import { useMemo, useState, type ReactNode } from "react";
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  useWorkbenchControls,
  type WorkbenchFilterDraft,
  type WorkbenchSortBy,
} from "@/contexts/WorkbenchControlsContext";

const Funnel = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("lucide lucide-funnel", className)}
    aria-hidden
  >
    <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />
  </svg>
);

const STATUS_OPTIONS = [
  { id: "filter-status-todo", label: "To-do" },
  { id: "filter-status-in-progress", label: "In progress" },
  { id: "filter-status-waiting-review", label: "Waiting review" },
  { id: "filter-status-blocked", label: "Blocked" },
  { id: "filter-status-done", label: "Done" },
] as const;

const PRIORITY_OPTIONS = [
  { id: "all", label: "All priorities" },
  { id: "filter-priority-urgent", label: "Urgent" },
  { id: "filter-priority-high", label: "High" },
  { id: "filter-priority-normal", label: "Normal" },
  { id: "filter-priority-low", label: "Low" },
] as const;

const SORT_OPTIONS: { id: WorkbenchSortBy; label: string }[] = [
  { id: "priority", label: "Priority" },
  { id: "due_date", label: "Due date" },
  { id: "updated", label: "Recently updated" },
];

type WorkbenchHeaderToolbarProps = {
  className?: string;
  /** On dashboard gradient header: no outer chrome — controls float on the strip. */
  variant?: "default" | "gradient";
  properties?: { id: string; name?: string | null; nickname?: string | null; address?: string | null }[];
  onAskFilla?: (query: string) => void;
};

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function StatusMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const label =
    value.length === 0
      ? "All statuses"
      : value.length === 1
        ? STATUS_OPTIONS.find((o) => o.id === value[0])?.label ?? "1 selected"
        : `${value.length} selected`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="space-y-1">
          {STATUS_OPTIONS.map((option) => {
            const checked = value.includes(option.id);
            return (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    onChange(
                      checked
                        ? value.filter((id) => id !== option.id)
                        : [...value, option.id]
                    );
                  }}
                  className="rounded border-border"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function WorkbenchHeaderToolbar({
  className,
  variant = "default",
  properties = [],
  onAskFilla,
}: WorkbenchHeaderToolbarProps) {
  const {
    searchQuery,
    setSearchQuery,
    filterDraft,
    setFilterDraft,
    applyFilterDraft,
    clearAllFilters,
    sortBy,
    setSortBy,
    activeFilterCount,
  } = useWorkbenchControls();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const propertyOptions = useMemo(
    () =>
      properties
        .map((p) => ({
          id: p.id,
          label: p.nickname || p.name || p.address || "Property",
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [properties]
  );

  const sortLabel = SORT_OPTIONS.find((o) => o.id === sortBy)?.label ?? "Priority";

  const patchDraft = (patch: Partial<WorkbenchFilterDraft>) => {
    setFilterDraft({ ...filterDraft, ...patch });
  };

  const handleAskFilla = () => {
    onAskFilla?.(searchQuery.trim());
  };

  return (
    <div
      className={cn(
        variant === "gradient"
          ? "flex min-w-0 items-stretch gap-2 border-0 bg-transparent py-0.5 px-0 shadow-none"
          : "flex min-w-0 items-stretch gap-2 rounded-xl border-0 bg-white py-0.5 px-1 shadow-none",
        className
      )}
    >
      {/* Search + Ask Filla */}
      <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-lg border border-border/40 bg-input">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search signals, tasks, records, properties…"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/70"
            aria-label="Search workbench"
          />
        </div>
        <div className="w-px self-stretch bg-border/50" aria-hidden />
        <button
          type="button"
          onClick={handleAskFilla}
          className="inline-flex shrink-0 items-center gap-1.5 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
        >
          <FillaIcon size={14} />
          <span className="hidden sm:inline">Ask Filla</span>
        </button>
      </div>

      {/* Filters */}
      <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/40 bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/30",
              filtersOpen && "bg-muted/40"
            )}
          >
            <Funnel className="h-4 w-4 text-muted-foreground" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1 text-[11px] font-semibold text-primary">
                {activeFilterCount}
              </span>
            ) : null}
            {filtersOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-[min(92vw,380px)] p-0">
          <div className="border-b border-border/50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Filters</h3>
              <button
                type="button"
                onClick={() => {
                  clearAllFilters();
                  setFiltersOpen(false);
                }}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear all
              </button>
            </div>
          </div>

          <div className="space-y-3 px-4 py-3">
            <FilterRow label="Property">
              <Select
                value={filterDraft.propertyId}
                onValueChange={(value) => patchDraft({ propertyId: value })}
              >
                <SelectTrigger className="h-9 rounded-lg border-border/60 shadow-sm">
                  <SelectValue placeholder="All properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All properties</SelectItem>
                  {propertyOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterRow>

            <FilterRow label="Status">
              <StatusMultiSelect
                value={filterDraft.statusIds}
                onChange={(statusIds) => patchDraft({ statusIds })}
              />
            </FilterRow>

            <FilterRow label="Priority">
              <Select
                value={filterDraft.priorityId}
                onValueChange={(value) => patchDraft({ priorityId: value })}
              >
                <SelectTrigger className="h-9 rounded-lg border-border/60 shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterRow>

            <FilterRow label="Type">
              <Select value="all" disabled>
                <SelectTrigger className="h-9 rounded-lg border-border/60 shadow-sm">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
              </Select>
            </FilterRow>

            <FilterRow label="Assignee">
              <Select
                value={filterDraft.assigneeMode}
                onValueChange={(value: WorkbenchFilterDraft["assigneeMode"]) =>
                  patchDraft({
                    assigneeMode: value,
                    showMyTasksOnly: value !== "all",
                  })
                }
              >
                <SelectTrigger className="h-9 rounded-lg border-border/60 shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me-or-teams">Me or my teams</SelectItem>
                  <SelectItem value="me">Assigned to me</SelectItem>
                  <SelectItem value="all">Anyone</SelectItem>
                </SelectContent>
              </Select>
            </FilterRow>

            <FilterRow label="Due date">
              <Select
                value={filterDraft.dueDateMode}
                onValueChange={(value: WorkbenchFilterDraft["dueDateMode"]) =>
                  patchDraft({ dueDateMode: value })
                }
              >
                <SelectTrigger className="h-9 rounded-lg border-border/60 shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any due date</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="next-30">Next 30 days</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </FilterRow>

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs font-medium text-muted-foreground">Show my tasks only</span>
              <Switch
                checked={filterDraft.showMyTasksOnly}
                onCheckedChange={(checked) =>
                  patchDraft({
                    showMyTasksOnly: checked,
                    assigneeMode: checked ? "me-or-teams" : filterDraft.assigneeMode,
                  })
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/50 px-4 py-3">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
              disabled
              title="Coming soon"
            >
              <Bookmark className="h-3.5 w-3.5" />
              Save view
            </button>
            <Button
              type="button"
              size="sm"
              className="rounded-lg bg-[#2A293E] px-4 text-white hover:bg-[#2A293E]/90"
              onClick={() => {
                applyFilterDraft();
                setFiltersOpen(false);
              }}
            >
              Apply filters
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Sort */}
      <Popover open={sortOpen} onOpenChange={setSortOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/40 bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/30",
              sortOpen && "bg-muted/40"
            )}
          >
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <span className="hidden md:inline">Sort:</span>
            <span>{sortLabel}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 p-1">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setSortBy(option.id);
                setSortOpen(false);
              }}
              className={cn(
                "flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/60",
                sortBy === option.id && "bg-primary/10 font-medium text-primary"
              )}
            >
              {option.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
