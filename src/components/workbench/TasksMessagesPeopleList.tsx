import { useState } from "react";
import { UserAvatar } from "@/components/tasks/UserAvatar";
import { formatMessageDayLabel } from "@/lib/formatMessageDayLabel";
import { cn } from "@/lib/utils";
import type { PersonMessageThread } from "@/hooks/useTaskMessageActivity";

type TasksMessagesPeopleListProps = {
  threads: PersonMessageThread[];
  taskTitlesById: Record<string, string>;
  onSelectTask: (taskId: string) => void;
  className?: string;
};

/**
 * WhatsApp-like people list for the Tasks → Messages tab.
 * Avatar + name + latest preview; expand to indented per-task message rows.
 */
export function TasksMessagesPeopleList({
  threads,
  taskTitlesById,
  onSelectTask,
  className,
}: TasksMessagesPeopleListProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (threads.length === 0) {
    return (
      <p className={cn("px-1 py-4 text-sm text-muted-foreground", className)}>
        No conversations yet. Messages on tasks will show up here.
      </p>
    );
  }

  return (
    <div className={cn("min-w-0", className)} role="list" aria-label="Task conversations">
      {threads.map((thread, index) => {
        const expanded = expandedKey === thread.authorKey;
        return (
          <div key={thread.authorKey} role="listitem">
            {index > 0 ? (
              <div className="perforation-list mx-1 my-1" aria-hidden />
            ) : null}

            <button
              type="button"
              aria-expanded={expanded}
              onClick={() =>
                setExpandedKey((prev) =>
                  prev === thread.authorKey ? null : thread.authorKey
                )
              }
              className={cn(
                "flex w-full min-w-0 items-center gap-3 rounded-xl px-1.5 py-2.5 text-left",
                "transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              )}
            >
              <UserAvatar
                imageUrl={thread.authorAvatarUrl}
                name={thread.authorName}
                propertyColor={thread.accentColor}
                size={40}
                shape="circle"
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {thread.authorName}
                  </span>
                  <span className="shrink-0 font-mono text-2xs uppercase tracking-wide text-muted-foreground/70">
                    {formatMessageDayLabel(thread.latestCreatedAt, { includeToday: true })}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs leading-snug text-muted-foreground">
                  {thread.latestBody}
                </p>
              </div>
            </button>

            {expanded ? (
              <div className="mb-2 ml-[52px] space-y-3 border-l border-border/40 pl-3">
                {thread.taskPreviews.map((preview) => {
                  const title = taskTitlesById[preview.taskId] ?? "Task";
                  const day =
                    formatMessageDayLabel(preview.createdAt, { includeToday: true }) ??
                    "TODAY";
                  return (
                    <button
                      key={`${preview.taskId}-${preview.messageId}`}
                      type="button"
                      onClick={() => onSelectTask(preview.taskId)}
                      className={cn(
                        "block w-full min-w-0 rounded-lg px-1 py-1 text-left",
                        "transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      )}
                    >
                      <div className="flex min-w-0 items-baseline gap-2">
                        <span className="truncate text-2xs font-medium text-foreground/80">
                          {title}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/60">
                          {day}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                        {preview.body}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
