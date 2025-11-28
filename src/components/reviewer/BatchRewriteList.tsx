import React from 'react';
import { Text } from '@/components/filla';
import { BatchRewriteItem } from './BatchRewriteItem';

interface Clause {
  id: string;
  original: string;
  rewrite?: string;
  status?: 'pending' | 'accepted' | 'rejected';
  confidence?: number;
}

interface BatchRewriteListProps {
  clauses: Clause[];
  onAccept: (clauseId: string) => void;
  onReject: (clauseId: string) => void;
  onRegenerate: (clauseId: string) => void;
  loading?: boolean;
}

export const BatchRewriteList: React.FC<BatchRewriteListProps> = ({
  clauses,
  onAccept,
  onReject,
  onRegenerate,
  loading = false
}) => {
  if (clauses.length === 0) {
    return (
      <div className="py-12 text-center">
        <Text variant="muted">No clauses available for batch rewrite</Text>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {clauses.map((clause) => (
        <BatchRewriteItem
          key={clause.id}
          clause={clause}
          onAccept={onAccept}
          onReject={onReject}
          onRegenerate={onRegenerate}
          loading={loading}
        />
      ))}
    </div>
  );
};
