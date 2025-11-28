import { useState } from 'react';
import { ClauseList } from './ClauseList';
import { ClausePane } from './ClausePane';
import { Button, Heading } from '@/components/filla';
import { useClauseDecisions } from '@/hooks/useClauseDecisions';
import { useSaveClauseDecision } from '@/hooks/useSaveClauseDecision';
import { usePublishVersion } from '@/hooks/usePublishVersion';

interface ReviewLayoutProps {
  review: any;
}

export function ReviewLayout({ review }: ReviewLayoutProps) {
  const [selectedClauseId, setSelectedClauseId] = useState<string>();
  const { decisions } = useClauseDecisions(review?.id);
  const { saveDecision } = useSaveClauseDecision();
  const { publish } = usePublishVersion();

  const clauses = review?.clauses || [];
  const selectedClause = clauses.find((c: any) => c.id === selectedClauseId);

  const handleApprove = () => {
    if (selectedClauseId) {
      saveDecision(selectedClauseId, 'approved');
    }
  };

  const handleReject = () => {
    if (selectedClauseId) {
      saveDecision(selectedClauseId, 'rejected');
    }
  };

  const handlePublish = () => {
    if (review?.id) {
      publish(review.id);
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="border-b border-concrete p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Heading variant="l">Review Workspace</Heading>
          <Button variant="primary" onClick={handlePublish}>
            Publish Version
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex gap-6 h-[calc(100vh-140px)]">
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
            />
          </div>
        </div>
      </div>
    </div>
  );
}
