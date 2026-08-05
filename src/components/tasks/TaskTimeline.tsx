import React from "react";
import type { TaskTimelineEvent } from "@/hooks/useTaskTimeline";
import { cn } from "@/lib/utils";

export type { TaskTimelineEvent };

interface TaskTimelineProps {
  events: TaskTimelineEvent[];
  /** Lightweight feed without neomorphic card chrome. */
  variant?: "card" | "activity";
}

/**
 * Task activity history.
 * Activity variant: small chronological lines —
 * `2 Dec 12:30 • Due Date changed to 4th July • Justin`
 */
export const TaskTimeline: React.FC<TaskTimelineProps> = ({
  events,
  variant = "card",
}) => {
  if (events.length === 0) {
    return variant === "activity" ? null : (
      <p className="py-4 text-center text-sm text-muted-foreground">No history for this task yet</p>
    );
  }

  if (variant === "activity") {
    return (
      <ul className="space-y-1.5" aria-label="Task activity">
        {events.map((event) => (
          <li
            key={event.id}
            className="text-[11px] leading-snug text-muted-foreground tabular-nums"
          >
            <span className="text-muted-foreground/90">{event.line}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="rounded-[12px] bg-card/60 p-4 shadow-e1">
      <div className="space-y-3">
        {events.map((event) => (
          <div
            key={event.id}
            className={cn("text-xs leading-relaxed text-muted-foreground")}
          >
            {event.line}
          </div>
        ))}
      </div>
    </div>
  );
};
