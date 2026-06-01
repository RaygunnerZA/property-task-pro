import type { ReactNode } from "react";
import { TaskDetailContextTabs } from "@/components/tasks/detail/TaskDetailContextTabs";
import type { TaskDetailContextId } from "@/components/tasks/detail/taskDetailContexts";

export type TaskDetailContentProps = {
  title: string;
  activeContext: TaskDetailContextId;
  onContextChange: (context: TaskDetailContextId) => void;
  overview: ReactNode;
  checklist: ReactNode;
  evidence: ReactNode;
  activity: ReactNode;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
};

/**
 * Shared task detail body: V2.1 contexts (Overview | Checklist | Evidence | Activity).
 * Used by TaskDetailPanel (modal/column) and full-route wrappers.
 */
export function TaskDetailContent({
  title,
  activeContext,
  onContextChange,
  overview,
  checklist,
  evidence,
  activity,
  scrollRef,
}: TaskDetailContentProps) {
  const tabBody =
    activeContext === "overview"
      ? overview
      : activeContext === "checklist"
        ? checklist
        : activeContext === "evidence"
          ? evidence
          : activity;

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 flex flex-col">
      <div className="sticky top-0 z-10 bg-background border-b border-border/10 px-4 pt-4 pb-3 space-y-3 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground leading-tight pr-2">{title}</h2>
        <TaskDetailContextTabs value={activeContext} onChange={onContextChange} className="w-full" />
      </div>
      <div className="flex-1 p-4 min-h-0">{tabBody}</div>
    </div>
  );
}
