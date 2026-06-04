import type { MutableRefObject } from "react";
import { IssuesDoneTasksColumn } from "@/components/dashboard/issues/IssuesDoneTasksColumn";
import { IssuesRecentNeedsReviewStack } from "@/components/dashboard/issues/IssuesRecentNeedsReviewStack";
import type { AttentionItem } from "@/components/dashboard/issues/issuesAttentionItem";
import type { WorkbenchAttentionSelectPayload } from "@/components/dashboard/SignalFeedDetailPanel";
import type { WorkbenchDoneTaskPreview } from "@/lib/workbenchDoneTasks";
import type { IntakeMode } from "@/types/intake";

export type IssuesAllFilterFeedProps = {
  groupedAttention: {
    recent: AttentionItem[];
    review: AttentionItem[];
  };
  doneWorkbenchTasks: {
    previews: WorkbenchDoneTaskPreview[];
    totalCount: number;
  };
  attentionCardRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  resolveAttentionItem: (id: string) => void;
  handleSignalAction?: (actionId: string, item: AttentionItem) => Promise<boolean>;
  addAttentionItemToCompliance: (item: AttentionItem) => void;
  onOpenIntake?: (mode: IntakeMode) => void;
  onMessageClick?: (messageId: string) => void;
  onAttentionItemSelect?: (payload: WorkbenchAttentionSelectPayload) => void;
  onTaskClick?: (taskId: string) => void;
};

/**
 * Issues “All” slice: Needs review + Recent (row lists) + Done (row list).
 */
export function IssuesAllFilterFeed({
  groupedAttention,
  doneWorkbenchTasks,
  attentionCardRefs,
  resolveAttentionItem,
  handleSignalAction,
  addAttentionItemToCompliance,
  onOpenIntake,
  onMessageClick,
  onAttentionItemSelect,
  onTaskClick,
}: IssuesAllFilterFeedProps) {
  return (
    <>
      <IssuesRecentNeedsReviewStack
        recentItems={groupedAttention.recent}
        reviewItems={groupedAttention.review}
        attentionCardRefs={attentionCardRefs}
        resolveAttentionItem={resolveAttentionItem}
        handleSignalAction={handleSignalAction}
        addAttentionItemToCompliance={addAttentionItemToCompliance}
        onOpenIntake={onOpenIntake}
        onMessageClick={onMessageClick}
        onAttentionItemSelect={onAttentionItemSelect}
      />
      <IssuesDoneTasksColumn
        previews={doneWorkbenchTasks.previews}
        totalCount={doneWorkbenchTasks.totalCount}
        onTaskClick={onTaskClick}
      />
    </>
  );
}
