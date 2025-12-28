import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BatchRewriteHeader } from '@/components/reviewer/BatchRewriteHeader';
import { BatchRewriteList } from '@/components/reviewer/BatchRewriteList';
import { useBatchRewrite } from '@/hooks/useBatchRewrite';
import { StandardPageWithBack } from '@/components/design-system/StandardPageWithBack';
import { FileEdit } from 'lucide-react';

export default function BatchRewrite() {
  const { reviewId } = useParams<{ reviewId: string }>();
  const navigate = useNavigate();
  
  const {
    clauses,
    loading,
    acceptAll,
    rejectAll,
    regenerateAll,
    acceptOne,
    rejectOne,
    regenerateOne
  } = useBatchRewrite(reviewId || '');

  return (
    <StandardPageWithBack
      title="Batch Rewrite"
      backTo={`/compliance/reviews/${reviewId}`}
      icon={<FileEdit className="h-6 w-6" />}
      maxWidth="xl"
    >
      <div className="space-y-6">
        <BatchRewriteHeader
          reviewId={reviewId || ''}
          totalClauses={clauses.length}
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
          onRegenerateAll={regenerateAll}
          loading={loading}
        />

        <BatchRewriteList
          clauses={clauses}
          onAccept={acceptOne}
          onReject={rejectOne}
          onRegenerate={regenerateOne}
          loading={loading}
        />
      </div>
    </StandardPageWithBack>
  );
}
