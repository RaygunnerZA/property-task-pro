import React, { useMemo } from "react";
import { format } from "date-fns";
import type { TaskTimelineEvent } from "@/hooks/useTaskTimeline";
import { cn } from "@/lib/utils";

export type { TaskTimelineEvent };

interface TaskTimelineProps {
  events: TaskTimelineEvent[];
  /** Lightweight feed without neomorphic card chrome. */
  variant?: "card" | "activity";
}

function dayKey(ts: Date): string {
  return format(ts, "yyyy-MM-dd");
}

/**
 * Task activity history.
 * Activity variant: small chronological lines with date on the first
 * item of each day only; times stay left-aligned across the list.
 */
export const TaskTimeline: React.FC<TaskTimelineProps> = ({
  events,
  variant = "card",
}) => {
  const rows = useMemo(() => {
    let prevDay: string | null = null;
    return events.map((event) => {
      const key = dayKey(event.timestamp);
      const showDate = key !== prevDay;
      prevDay = key;
      return {
        event,
        showDate,
        dateLabel: format(event.timestamp, "d MMM"),
        timeLabel: format(event.timestamp, "HH:mm"),
      };
    });
  }, [events]);

  if (events.length === 0) {
    return variant === "activity" ? null : (
      <p className="py-4 text-center text-sm text-muted-foreground">No history for this task yet</p>
    );
  }

  const listClass =
    variant === "activity" ? "space-y-1.5" : "space-y-3";
  const textClass =
    variant === "activity"
      ? "text-[11px] leading-snug text-muted-foreground"
      : "text-xs leading-relaxed text-muted-foreground";

  const list = (
    <ul className={listClass} aria-label="Task activity">
      {rows.map(({ event, showDate, dateLabel, timeLabel }) => {
        const rest = [event.description, event.author].filter(Boolean).join(" • ");
        return (
          <li
            key={event.id}
            aria-label={`${showDate ? `${dateLabel} ` : ""}${timeLabel} • ${rest}`}
            className={cn(
              "grid grid-cols-[4.5rem_2.75rem_minmax(0,1fr)] items-start gap-x-1 tabular-nums",
              textClass
            )}
          >
            <span
              className="truncate text-muted-foreground/80"
              aria-hidden={!showDate}
            >
              {showDate ? dateLabel : "\u00a0"}
            </span>
            <span className="text-muted-foreground/90">{timeLabel}</span>
            <span className="min-w-0 text-muted-foreground/90">
              <span aria-hidden>•</span> {rest}
            </span>
          </li>
        );
      })}
    </ul>
  );

  if (variant === "activity") return list;

  return <div className="rounded-[12px] bg-card/60 p-4 shadow-e1">{list}</div>;
};
