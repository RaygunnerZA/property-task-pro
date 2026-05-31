import { IssuesScrollColumn } from "@/components/dashboard/issues/IssuesScrollColumn";
import { IssuesRecentSignalRow } from "@/components/dashboard/issues/IssuesSignalRowCards";
import type { WorkbenchDoneTaskPreview } from "@/lib/workbenchDoneTasks";

const DONE_COLUMN = {
  title: "Done",
  subtitle: "Recently completed work",
  emptyTitle: "Nothing completed yet",
  emptyDescription: "When you finish tasks, they appear here for a quick look back.",
} as const;

type IssuesDoneTasksColumnProps = {
  previews: WorkbenchDoneTaskPreview[];
  totalCount: number;
  onTaskClick?: (taskId: string) => void;
};

export function IssuesDoneTasksColumn({
  previews,
  totalCount,
  onTaskClick,
}: IssuesDoneTasksColumnProps) {
  if (totalCount === 0) return null;

  return (
    <IssuesScrollColumn
      title={DONE_COLUMN.title}
      subtitle={DONE_COLUMN.subtitle}
      countVariant="recent"
      items={previews}
      totalCount={totalCount}
      emptyTitle={DONE_COLUMN.emptyTitle}
      emptyDescription={DONE_COLUMN.emptyDescription}
      renderCard={(item) => (
        <IssuesRecentSignalRow
          id={`done-task-${item.id}`}
          thumbnailUrl={item.thumbnailUrl}
          title={item.title}
          subtitle={item.metaLine}
          viewAction={
            onTaskClick
              ? {
                  id: "view-task",
                  label: "View",
                  onClick: () => onTaskClick(item.id),
                }
              : undefined
          }
          onCardActivate={onTaskClick ? () => onTaskClick(item.id) : undefined}
        />
      )}
    />
  );
}
