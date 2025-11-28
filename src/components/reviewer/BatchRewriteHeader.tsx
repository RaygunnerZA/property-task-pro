import React from 'react';
import { Surface, Heading, Text, Button } from '@/components/filla';
import { CheckCheck, XCircle, RefreshCw } from 'lucide-react';

interface BatchRewriteHeaderProps {
  reviewId: string;
  totalClauses?: number;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onRegenerateAll: () => void;
  loading?: boolean;
}

export const BatchRewriteHeader: React.FC<BatchRewriteHeaderProps> = ({
  reviewId,
  totalClauses = 0,
  onAcceptAll,
  onRejectAll,
  onRegenerateAll,
  loading = false
}) => {
  return (
    <Surface variant="neomorphic" className="p-4 border-t border-white/60">
      <div className="flex justify-between items-center">
        <div>
          <Heading variant="l">Batch Rewrite</Heading>
          <Text variant="caption" className="mt-1">
            Review ID: {reviewId} • {totalClauses} clauses
          </Text>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="primary" 
            size="sm" 
            onClick={onAcceptAll}
            disabled={loading || totalClauses === 0}
          >
            <CheckCheck className="w-3 h-3" />
            Accept All
          </Button>
          <Button 
            variant="danger" 
            size="sm" 
            onClick={onRejectAll}
            disabled={loading || totalClauses === 0}
          >
            <XCircle className="w-3 h-3" />
            Reject All
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={onRegenerateAll}
            disabled={loading || totalClauses === 0}
          >
            <RefreshCw className="w-3 h-3" />
            Regenerate All
          </Button>
        </div>
      </div>
    </Surface>
  );
};
