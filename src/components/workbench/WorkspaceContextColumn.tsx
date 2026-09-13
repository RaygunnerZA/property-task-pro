import { useMemo } from "react";
import { MessageSquare, CalendarDays, FileText, CheckSquare } from "lucide-react";
import { formatDistanceToNow, isToday, isThisWeek, parseISO, isValid } from "date-fns";
import { FillaMiniCalendar } from "@/components/calendar/FillaMiniCalendar";
import { FillaRecommends } from "@/components/filla/FillaRecommends";
import { useActionableSuggestions } from "@/hooks/useActionableSuggestions";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkbenchSectionHero } from "@/components/workbench/WorkbenchSectionHero";
import {
  healthStatCellClass,
  healthStatNumberClass,
} from "@/components/property-workspace/WorkspaceHealthGrid";
import { cn } from "@/lib/utils";
import { getTaskDueUrgency } from "@/lib/taskDueUrgency";
import { taskMatchesPropertyScope } from "@/utils/propertyFilter";
import {
  CENTRE_WORKBENCH_TAB_META,
  type CentreWorkbenchTab,
} from "@/lib/centreWorkbenchTabs";
import { useCountUp } from "@/hooks/useCountUp";

const TERMINAL = new Set(["completed", "archived", "done"]);

const statWordClass =
  "block font-mono text-caption font-semibold uppercase leading-snug tracking-[0.12px] text-foreground transition-colors group-hover:font-bold group-hover:text-white";

const statCellClass = cn(healthStatCellClass, "px-1.5 pb-2.5 pt-2.5 sm:px-1.5 sm:pb-2.5");

type SecondaryTone = "urgent" | "warning" | "neutral";

const secondaryCountBoxClass: Record<SecondaryTone, string> = {
  urgent:
    "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-card bg-white px-1 text-2xs font-bold tabular-nums leading-none text-destructive",
  warning:
    "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-card bg-white px-1 text-2xs font-bold tabular-nums leading-none text-warning-foreground",
  neutral:
    "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-card bg-white px-1 text-2xs font-bold tabular-nums leading-none text-muted-foreground",
};

const secondaryLabelClass: Record<SecondaryTone, string> = {
  urgent:
    "font-mono text-2xs font-bold uppercase tracking-[0.04em] text-destructive transition-colors group-hover:text-accent",
  warning:
    "font-mono text-2xs font-bold uppercase tracking-[0.04em] text-warning-foreground transition-colors group-hover:text-amber-300",
  neutral:
    "font-mono text-2xs font-bold uppercase tracking-[0.04em] text-muted-foreground transition-colors group-hover:text-white/90",
};

type HealthStat = {
  id: string;
  value: number;
  line1: string;
  line2: string;
  secondaryCount: number;
  secondaryLabel: string;
  secondaryTone: SecondaryTone;
  onActivate?: () => void;
};

type RecentItem = {
  id: string;
  kind: "task" | "message" | "event" | "record";
  title: string;
  at: string;
  onActivate?: () => void;
};

type TaskLike = {
  id?: string;
  title?: string | null;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
  due_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  property_id?: string | null;
};

export type WorkspaceContextColumnProps = {
  section: CentreWorkbenchTab;
  tasks?: TaskLike[];
  properties?: { id: string }[];
  tasksLoading?: boolean;
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
  selectedPropertyIds?: Set<string>;
  onFilterClick?: (filterId: string) => void;
  onTaskClick?: (taskId: string) => void;
  onOpenIntake?: () => void;
  className?: string;
};

function isOpen(task: TaskLike) {
  return !TERMINAL.has((task.status ?? "").toLowerCase());
}

function parseTaskDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = parseISO(raw.length <= 10 ? `${raw}T12:00:00` : raw);
  return isValid(d) ? d : null;
}

function HealthStatCell({
  value,
  line1,
  line2,
  secondaryCount,
  secondaryLabel,
  secondaryTone,
  onActivate,
}: HealthStat) {
  const displayValue = Math.round(useCountUp(value));
  const inner = (
    <>
      <div className="flex w-full min-w-0 items-start gap-1 overflow-hidden pl-0.5">
        <span
          className={cn(
            "shrink-0 -translate-y-[6px] font-display font-medium tabular-nums leading-none text-primary-deep text-shadow-neu-pressed transition-colors group-hover:text-white",
            healthStatNumberClass(displayValue)
          )}
        >
          {displayValue}
        </span>
        <div className="min-w-0 flex-1 overflow-hidden pt-0.5 text-left [&>span+span]:-mt-[2px]">
          <span className={statWordClass}>{line1}</span>
          {line2 ? <span className={statWordClass}>{line2}</span> : null}
        </div>
      </div>
      <div className="mt-1.5 flex min-w-0 max-w-full items-center gap-0.5 overflow-hidden pl-0.5 tracking-[0.3px]">
        <span className={secondaryCountBoxClass[secondaryTone]}>{secondaryCount}</span>
        <span className={cn(secondaryLabelClass[secondaryTone], "truncate")}>
          {secondaryLabel}
        </span>
      </div>
    </>
  );

  if (!onActivate) {
    return <div className={statCellClass}>{inner}</div>;
  }

  return (
    <button type="button" onClick={onActivate} className={statCellClass}>
      {inner}
    </button>
  );
}

function kindIcon(kind: RecentItem["kind"]) {
  switch (kind) {
    case "message":
      return MessageSquare;
    case "event":
      return CalendarDays;
    case "record":
      return FileText;
    default:
      return CheckSquare;
  }
}

/**
 * Left rail for Tasks · Calendar · Records — title hero, section health (no radial),
 * suggested actions, expandable calendar, recent activity.
 */
export function WorkspaceContextColumn({
  section,
  tasks = [],
  properties = [],
  tasksLoading = false,
  selectedDate,
  onDateSelect,
  selectedPropertyIds,
  onFilterClick,
  onTaskClick,
  onOpenIntake,
  className,
}: WorkspaceContextColumnProps) {
  const meta = CENTRE_WORKBENCH_TAB_META[section];
  const propertyIds = useMemo(() => properties.map((p) => p.id), [properties]);

  const scopedTasks = useMemo(
    () =>
      tasks.filter((task) =>
        taskMatchesPropertyScope(task, selectedPropertyIds, propertyIds)
      ),
    [tasks, selectedPropertyIds, propertyIds]
  );

  const openTasks = useMemo(() => scopedTasks.filter(isOpen), [scopedTasks]);

  const healthStats = useMemo((): HealthStat[] => {
    if (section === "calendar") {
      const withDue = openTasks.filter((t) => t.due_date || t.due_at);
      const thisWeek = withDue.filter((t) => {
        const d = parseTaskDate(t.due_date || t.due_at);
        return d ? isThisWeek(d, { weekStartsOn: 1 }) : false;
      });
      const overdue = openTasks.filter((t) => getTaskDueUrgency(t) === "overdue");
      const unscheduled = openTasks.filter((t) => !t.due_date && !t.due_at);
      const overdueUrgent = overdue.filter(
        (t) => (t.priority ?? "").toLowerCase() === "urgent"
      ).length;
      const unscheduledUrgent = unscheduled.filter(
        (t) => (t.priority ?? "").toLowerCase() === "urgent"
      ).length;
      return [
        {
          id: "week",
          value: thisWeek.length,
          line1: "this",
          line2: "week",
          secondaryCount: thisWeek.filter((t) => {
            const d = parseTaskDate(t.due_date || t.due_at);
            return d ? isToday(d) : false;
          }).length,
          secondaryLabel: "TODAY",
          secondaryTone: "warning",
          onActivate: () => onFilterClick?.("filter-date-this-week"),
        },
        {
          id: "overdue",
          value: overdue.length,
          line1: "overdue",
          line2: "events",
          secondaryCount: overdueUrgent,
          secondaryLabel: "HOT",
          secondaryTone: overdueUrgent > 0 ? "urgent" : "neutral",
          onActivate: () => onFilterClick?.("filter-date-overdue"),
        },
        {
          id: "unscheduled",
          value: unscheduled.length,
          line1: "no",
          line2: "date",
          secondaryCount: unscheduledUrgent,
          secondaryLabel: "HOT",
          secondaryTone: unscheduledUrgent > 0 ? "urgent" : "neutral",
          onActivate: () => onFilterClick?.("filter-date-unscheduled"),
        },
      ];
    }

    if (section === "records") {
      const overdue = openTasks.filter((t) => getTaskDueUrgency(t) === "overdue");
      const dueSoon = openTasks.filter((t) => getTaskDueUrgency(t) === "due_soon");
      const reviewish = openTasks.filter((t) =>
        /cert|document|record|compliance|upload/i.test(String(t.title ?? ""))
      );
      const dueSoonToday = dueSoon.filter((t) => {
        const d = parseTaskDate(t.due_date || t.due_at);
        return d ? isToday(d) : false;
      }).length;
      const reviewOverdue = reviewish.filter(
        (t) => getTaskDueUrgency(t) === "overdue"
      ).length;
      const overdueUrgent = overdue.filter(
        (t) => (t.priority ?? "").toLowerCase() === "urgent"
      ).length;
      return [
        {
          id: "expiring",
          value: dueSoon.length,
          line1: "due",
          line2: "soon",
          secondaryCount: dueSoonToday,
          secondaryLabel: "TODAY",
          secondaryTone: dueSoonToday > 0 ? "warning" : "neutral",
          onActivate: () => onFilterClick?.("filter-date-this-week"),
        },
        {
          id: "overdue",
          value: overdue.length,
          line1: "overdue",
          line2: "items",
          secondaryCount: overdueUrgent,
          secondaryLabel: "HOT",
          secondaryTone: overdueUrgent > 0 ? "urgent" : "neutral",
          onActivate: () => onFilterClick?.("filter-date-overdue"),
        },
        {
          id: "organise",
          value: reviewish.length,
          line1: "to",
          line2: "organise",
          secondaryCount: reviewOverdue,
          secondaryLabel: "LATE",
          secondaryTone: reviewOverdue > 0 ? "urgent" : "neutral",
          onActivate: () => onFilterClick?.("show-records"),
        },
      ];
    }

    // Tasks
    const overdue = openTasks.filter((t) => getTaskDueUrgency(t) === "overdue");
    const dueSoon = openTasks.filter((t) => getTaskDueUrgency(t) === "due_soon");
    const urgent = openTasks.filter((t) => (t.priority ?? "").toLowerCase() === "urgent");
    const dueToday = openTasks.filter((t) => {
      const d = parseTaskDate(t.due_date || t.due_at);
      return d ? isToday(d) : false;
    });
    const overdueUrgent = overdue.filter(
      (t) => (t.priority ?? "").toLowerCase() === "urgent"
    ).length;
    const urgentOverdue = urgent.filter((t) => getTaskDueUrgency(t) === "overdue").length;
    return [
      {
        id: "overdue",
        value: overdue.length,
        line1: "overdue",
        line2: "tasks",
        secondaryCount: overdueUrgent,
        secondaryLabel: "HOT",
        secondaryTone: overdueUrgent > 0 ? "urgent" : "neutral",
        onActivate: () => onFilterClick?.("filter-date-overdue"),
      },
      {
        id: "today",
        value: dueSoon.length,
        line1: "due",
        line2: "soon",
        secondaryCount: dueToday.length,
        secondaryLabel: "TODAY",
        secondaryTone: dueToday.length > 0 ? "warning" : "neutral",
        onActivate: () => onFilterClick?.("filter-date-this-week"),
      },
      {
        id: "urgent",
        value: urgent.length,
        line1: "urgent",
        line2: "open",
        secondaryCount: urgentOverdue,
        secondaryLabel: "LATE",
        secondaryTone: urgentOverdue > 0 ? "urgent" : "neutral",
        onActivate: () => onFilterClick?.("show-tasks-urgent"),
      },
    ];
  }, [section, openTasks, onFilterClick]);

  const scopedPropertyIds = useMemo(
    () => (selectedPropertyIds && selectedPropertyIds.size > 0 ? Array.from(selectedPropertyIds) : undefined),
    [selectedPropertyIds]
  );
  const { topSuggestion, dismissSuggestion, snoozeSuggestion, runPrimaryAction } =
    useActionableSuggestions({
      tasks: scopedTasks as Array<Record<string, unknown>>,
      propertyIds: scopedPropertyIds,
    });

  const recent = useMemo((): RecentItem[] => {
    const items: RecentItem[] = scopedTasks
      .map((task) => {
        const at = task.updated_at || task.created_at || task.due_at || task.due_date || "";
        return {
          id: `task-${task.id}`,
          kind: "task" as const,
          title: String(task.title ?? "Task").trim() || "Task",
          at,
          onActivate: task.id ? () => onTaskClick?.(task.id!) : undefined,
        };
      })
      .filter((item) => item.at)
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 8);

    return items;
  }, [scopedTasks, onTaskClick]);

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-0 px-1 pb-4", className)}>
      <WorkbenchSectionHero
        title={meta.label}
        description={meta.description}
        illustrationSrc={meta.illustrationSrc}
      />

      {/* Section health — three tabs, no radial / vertical counters */}
      <div
        className="mt-0 grid grid-cols-3 grid-rows-1 items-stretch gap-y-[5px] divide-x divide-border/30 border-b border-border/30 py-[10px]"
        role="navigation"
        aria-label={`${meta.label} health`}
      >
        {healthStats.map((stat) => (
          <HealthStatCell key={stat.id} {...stat} />
        ))}
      </div>

      <div className="perforation-section pointer-events-none my-1" aria-hidden />

      {/* Mini-calendar: Tasks & Records only, collapsed by default. Calendar centre owns the grid. */}
      {section !== "calendar" ? (
        <div className="mt-1 w-full max-w-full rounded-lg bg-transparent px-0 pt-1 pb-1 shadow-none">
          {tasksLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <FillaMiniCalendar
              tasks={scopedTasks as never[]}
              selectedDate={selectedDate}
              onDateSelect={onDateSelect}
              className="shadow-e1"
              defaultExpanded={false}
            />
          )}
        </div>
      ) : null}

      {topSuggestion ? (
        <div className="px-1 py-3">
              <FillaRecommends
            key={topSuggestion.id}
            suggestion={topSuggestion}
            variant="rail"
            onPrimaryAction={(item) => {
              if (item.action.kind === "open_task" && item.action.taskId && onTaskClick) {
                onTaskClick(item.action.taskId);
                return;
              }
              runPrimaryAction(item);
            }}
            onDismiss={dismissSuggestion}
            onSnooze={snoozeSuggestion}
          />
        </div>
      ) : null}

      {/* Recent */}
      <div className="mt-4 px-1">
        <p className="mb-2 font-mono text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
          Recent
        </p>
        {recent.length === 0 ? (
          <p className="text-caption text-muted-foreground">No recent activity yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {recent.map((item) => {
              const Icon = kindIcon(item.kind);
              const when = (() => {
                try {
                  const d = parseISO(item.at);
                  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : "";
                } catch {
                  return "";
                }
              })();
              const row = (
                <>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted/50 text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground/90">{item.title}</span>
                    {when ? (
                      <span className="block text-2xs text-muted-foreground/70">{when}</span>
                    ) : null}
                  </span>
                </>
              );
              return (
                <li key={item.id}>
                  {item.onActivate ? (
                    <button
                      type="button"
                      onClick={item.onActivate}
                      className="flex w-full items-center gap-2 rounded-xl px-1.5 py-1.5 text-left transition-colors hover:bg-muted/40"
                    >
                      {row}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl px-1.5 py-1.5">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
