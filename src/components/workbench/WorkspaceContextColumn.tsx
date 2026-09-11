import { useMemo } from "react";
import { ChevronRight, MessageSquare, CalendarDays, FileText, CheckSquare } from "lucide-react";
import { formatDistanceToNow, isToday, isThisWeek, parseISO, isValid } from "date-fns";
import { FillaMiniCalendar } from "@/components/calendar/FillaMiniCalendar";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getTaskDueUrgency } from "@/lib/taskDueUrgency";
import { taskMatchesPropertyScope } from "@/utils/propertyFilter";
import {
  CENTRE_WORKBENCH_TAB_META,
  type CentreWorkbenchTab,
} from "@/lib/centreWorkbenchTabs";
import { useCountUp } from "@/hooks/useCountUp";

const TERMINAL = new Set(["completed", "archived", "done"]);

const statNumberClass =
  "self-start pl-1.5 pb-1 font-display text-[32px] font-medium tabular-nums leading-none text-primary-deep text-shadow-neu-pressed transition-colors group-hover:text-white sm:pb-[3px] sm:text-2xl";

const statWordClass =
  "font-mono text-caption font-semibold uppercase leading-tight tracking-[0.12px] text-foreground transition-colors group-hover:font-bold group-hover:text-white";

const statCellClass =
  "group hover-ink-noise flex min-w-0 w-full flex-col items-start justify-start self-start rounded-xl bg-background/55 px-2 pb-3 pt-3 text-left shadow-[inset_1px_2px_2px_0px_rgba(0,0,0,0.08),inset_-1px_-2px_2px_0px_rgba(255,255,255,0.7)] transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] sm:px-1.5 sm:pb-3";

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

type SuggestedAction = {
  id: string;
  text: string;
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
      <span className={statNumberClass}>{displayValue}</span>
      <div className="flex w-full min-w-0 items-stretch gap-0.5">
        <div className="flex min-w-0 flex-1 flex-col items-start pl-1.5 text-left text-foreground">
          <span className={statWordClass}>{line1}</span>
          <span className={statWordClass}>{line2}</span>
        </div>
        {onActivate ? (
          <ChevronRight
            className="mt-0.5 h-3 w-3 shrink-0 self-start text-muted-foreground/60 transition-[color,transform] duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-white"
            aria-hidden
          />
        ) : null}
      </div>
      <div className="mt-1.5 flex w-[77px] items-center gap-0.5 tracking-[0.3px]">
        <span className={secondaryCountBoxClass[secondaryTone]}>{secondaryCount}</span>
        <span className={secondaryLabelClass[secondaryTone]}>{secondaryLabel}</span>
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
          secondaryCount: overdue.length,
          secondaryLabel: "LATE",
          secondaryTone: overdue.length > 0 ? "urgent" : "neutral",
          onActivate: () => onFilterClick?.("filter-date-overdue"),
        },
        {
          id: "unscheduled",
          value: unscheduled.length,
          line1: "no",
          line2: "date",
          secondaryCount: unscheduled.length,
          secondaryLabel: "OPEN",
          secondaryTone: "neutral",
          onActivate: () => onFilterClick?.("show-tasks"),
        },
      ];
    }

    if (section === "records") {
      const overdue = openTasks.filter((t) => getTaskDueUrgency(t) === "overdue");
      const dueSoon = openTasks.filter((t) => getTaskDueUrgency(t) === "due_soon");
      const reviewish = openTasks.filter((t) =>
        /cert|document|record|compliance|upload/i.test(String(t.title ?? ""))
      );
      return [
        {
          id: "expiring",
          value: dueSoon.length,
          line1: "due",
          line2: "soon",
          secondaryCount: dueSoon.length,
          secondaryLabel: "WATCH",
          secondaryTone: dueSoon.length > 0 ? "warning" : "neutral",
          onActivate: () => onFilterClick?.("show-records"),
        },
        {
          id: "overdue",
          value: overdue.length,
          line1: "overdue",
          line2: "items",
          secondaryCount: overdue.length,
          secondaryLabel: "LATE",
          secondaryTone: overdue.length > 0 ? "urgent" : "neutral",
          onActivate: () => onFilterClick?.("filter-date-overdue"),
        },
        {
          id: "organise",
          value: reviewish.length,
          line1: "to",
          line2: "organise",
          secondaryCount: reviewish.length,
          secondaryLabel: "FILE",
          secondaryTone: reviewish.length > 0 ? "warning" : "neutral",
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
    return [
      {
        id: "overdue",
        value: overdue.length,
        line1: "overdue",
        line2: "tasks",
        secondaryCount: overdue.length,
        secondaryLabel: "LATE",
        secondaryTone: overdue.length > 0 ? "urgent" : "neutral",
        onActivate: () => onFilterClick?.("filter-date-overdue"),
      },
      {
        id: "today",
        value: dueToday.length || dueSoon.length,
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
        secondaryCount: urgent.length,
        secondaryLabel: "HOT",
        secondaryTone: urgent.length > 0 ? "urgent" : "neutral",
        onActivate: () => onFilterClick?.("show-tasks-urgent"),
      },
    ];
  }, [section, openTasks, onFilterClick]);

  const suggested = useMemo((): SuggestedAction[] => {
    const lines: SuggestedAction[] = [];
    const overdue = openTasks.filter((t) => getTaskDueUrgency(t) === "overdue");
    const urgent = openTasks.filter((t) => (t.priority ?? "").toLowerCase() === "urgent");

    if (urgent.length > 0) {
      const first = urgent[0];
      lines.push({
        id: "urgent",
        text:
          urgent.length === 1
            ? `1 urgent task is open. Start with “${first?.title ?? "task"}”.`
            : `${urgent.length} urgent tasks are open. Start with “${first?.title ?? "task"}”.`,
        onActivate: first?.id ? () => onTaskClick?.(first.id!) : () => onFilterClick?.("show-tasks-urgent"),
      });
    }
    if (overdue.length > 0 && lines.length < 3) {
      lines.push({
        id: "overdue",
        text:
          overdue.length === 1
            ? "1 task is overdue — clear it before new work piles up."
            : `${overdue.length} tasks are overdue — clear the oldest first.`,
        onActivate: () => onFilterClick?.("filter-date-overdue"),
      });
    }
    if (section === "records" && lines.length < 3) {
      lines.push({
        id: "records-organise",
        text: "File new uploads so certificates stay visible before they expire.",
        onActivate: () => onFilterClick?.("show-records"),
      });
    }
    if (section === "calendar" && lines.length < 3) {
      lines.push({
        id: "calendar-plan",
        text: "Pick a day on the calendar to focus today’s schedule.",
      });
    }
    if (lines.length < 3 && onOpenIntake) {
      lines.push({
        id: "create",
        text: "Capture something new — create a task or add a record.",
        onActivate: onOpenIntake,
      });
    }
    if (lines.length === 0) {
      lines.push({
        id: "clear",
        text: "You’re clear for now. Check back when new work lands.",
      });
    }
    return lines.slice(0, 3);
  }, [openTasks, section, onFilterClick, onTaskClick, onOpenIntake]);

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
    <div className={cn("flex w-full min-w-0 flex-col gap-0 px-[3px] pb-4", className)}>
      {/* 160px title + description on image */}
      <div
        className="relative h-[160px] w-full overflow-hidden rounded-2xl"
        style={{
          backgroundImage: `linear-gradient(135deg, hsl(40 12% 92% / 0.92), hsl(40 10% 88% / 0.75)), url(${meta.illustrationSrc})`,
          backgroundSize: "cover, 140px",
          backgroundPosition: "center, right 12px bottom 8px",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="relative z-[1] flex h-full flex-col justify-end gap-1.5 p-4 pr-24">
          <h1 className="font-display text-2xl font-medium leading-tight tracking-tight text-foreground">
            {meta.label}
          </h1>
          <p className="text-xs leading-relaxed text-muted-foreground">{meta.description}</p>
        </div>
      </div>

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

      {/* Filla suggested — up to 3 */}
      <div className="grid grid-cols-[auto_1fr] items-start gap-2.5 px-1 py-3" aria-label="Filla suggestions">
        <div className="flex h-9 w-[21px] shrink-0 items-start justify-center rounded-2xl rounded-bl-sm" aria-hidden>
          <FillaIcon size={24} className="opacity-90" />
        </div>
        <div className="min-w-0 space-y-2 text-sm leading-snug text-foreground/85">
          <p className="font-mono text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Suggested
          </p>
          {suggested.map((line) =>
            line.onActivate ? (
              <button
                key={line.id}
                type="button"
                onClick={line.onActivate}
                className="block w-full text-left text-sm leading-snug text-foreground/85 transition-colors hover:text-foreground"
              >
                {line.text}
              </button>
            ) : (
              <p key={line.id} className="text-sm leading-snug text-foreground/85">
                {line.text}
              </p>
            )
          )}
        </div>
      </div>

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
