import React from "react";
import { Clock, CheckCircle, AlertCircle, MessageSquare, User } from "lucide-react";
import { format } from "date-fns";
import type { TaskTimelineEvent, TaskTimelineEventType } from "@/hooks/useTaskTimeline";
import { cn } from "@/lib/utils";

export type { TaskTimelineEvent };

interface TaskTimelineProps {
  events: TaskTimelineEvent[];
  /** Lightweight feed without neomorphic card chrome. */
  variant?: "card" | "activity";
}

const getEventIcon = (type: TaskTimelineEventType) => {
  switch (type) {
    case "status_change":
      return CheckCircle;
    case "assignment":
      return User;
    case "comment":
      return MessageSquare;
    case "attachment":
      return AlertCircle;
    default:
      return Clock;
  }
};

export const TaskTimeline: React.FC<TaskTimelineProps> = ({
  events,
  variant = "card",
}) => {
  if (events.length === 0) {
    return variant === "activity" ? null : (
      <p className="py-4 text-center text-sm text-muted-foreground">No history for this task yet</p>
    );
  }

  const list = (
    <div className={cn(variant === "activity" ? "space-y-5" : "space-y-4")}>
      {events.map((event, index) => {
        const EventIcon = getEventIcon(event.type);
        const isLast = index === events.length - 1;

        if (variant === "activity") {
          return (
            <div key={event.id} className="flex gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground/70">
                <EventIcon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm leading-relaxed text-foreground/90">{event.description}</p>
                <p className="text-xs text-muted-foreground">
                  {[event.author, format(new Date(event.timestamp), "MMM d · HH:mm")]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
          );
        }

        return (
          <div key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-concrete bg-background shadow-sm">
                <EventIcon className="h-4 w-4 text-primary" />
              </div>
              {!isLast && <div className="my-1 w-0.5 flex-1 bg-concrete/50" />}
            </div>

            <div className="flex-1 pb-4">
              <p className="mb-1 text-sm text-foreground">{event.description}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {event.author ? <span>{event.author}</span> : null}
                <span>{format(new Date(event.timestamp), "MMM d, h:mm a")}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (variant === "activity") return list;

  return <div className="rounded-[12px] bg-card/60 p-4 shadow-e1">{list}</div>;
};
