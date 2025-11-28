import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Surface, Button } from '@/components/filla';
import { BatchRewriteHeader } from '@/components/reviewer/BatchRewriteHeader';
import { BatchRewriteList } from '@/components/reviewer/BatchRewriteList';
import { useBatchRewrite } from '@/hooks/useBatchRewrite';
import { ArrowLeft } from 'lucide-react';

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
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </div>

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
    </div>
  );
}
