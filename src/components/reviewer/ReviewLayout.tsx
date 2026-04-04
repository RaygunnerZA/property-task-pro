import { useState } from "react";
import { ClauseList } from "./ClauseList";
import { ClausePane } from "./ClausePane";
import { Button, Heading } from "@/components/filla";
import { useSaveClauseDecision } from "@/hooks/useSaveClauseDecision";
import { usePublishVersion } from "@/hooks/usePublishVersion";

interface ReviewLayoutProps {
  review: any;
}

export function ReviewLayout({ review }: ReviewLayoutProps) {
  const [selectedClauseId, setSelectedClauseId] = useState<string>();
  const { saveDecision, saving } = useSaveClauseDecision();
  const { publish, publishing } = usePublishVersion();

  const clauses = review?.clauses || [];
  const selectedClause = clauses.find((c: any) => c.id === selectedClauseId);

  const handleApprove = () => {
    if (selectedClauseId) {
      void saveDecision({
        clauseId: selectedClauseId,
        decision: "approved",
      });
    }
  };

  const handleReject = () => {
    if (selectedClauseId) {
      void saveDecision({
        clauseId: selectedClauseId,
        decision: "rejected",
      });
    }
  };

  const handlePublish = () => {
    if (review?.id) {
      void publish(review.id);
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="border-b border-concrete p-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Heading variant="l">Review Workspace</Heading>
          <Button
            variant="primary"
            onClick={handlePublish}
            disabled={publishing}
          >
            {publishing ? "Publishing…" : "Publish Version"}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-6">
        <div className="flex h-[calc(100vh-140px)] gap-6">
          <div className="w-80 flex-shrink-0">
            <ClauseList
              clauses={clauses}
              selectedId={selectedClauseId}
              onSelect={setSelectedClauseId}
            />
          </div>
          <div className="flex-1">
            <ClausePane
              clause={selectedClause}
              onApprove={handleApprove}
              onReject={handleReject}
              actionsDisabled={saving}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
