import React from 'react';
import { Surface, Text, Button, Badge } from '@/components/filla';
import { Check, X, RefreshCw, Sparkles } from 'lucide-react';

interface BatchRewriteItemProps {
  clause: {
    id: string;
    original: string;
    rewrite?: string;
    status?: 'pending' | 'accepted' | 'rejected';
    confidence?: number;
  };
  onAccept: (clauseId: string) => void;
  onReject: (clauseId: string) => void;
  onRegenerate: (clauseId: string) => void;
  loading?: boolean;
}

export const BatchRewriteItem: React.FC<BatchRewriteItemProps> = ({
  clause,
  onAccept,
  onReject,
  onRegenerate,
  loading = false
}) => {
  const getStatusBadge = () => {
    switch (clause.status) {
      case 'accepted':
        return <Badge variant="success">Accepted</Badge>;
      case 'rejected':
        return <Badge variant="signal">Rejected</Badge>;
      default:
        return <Badge variant="neutral">Pending</Badge>;
    }
  };

  return (
    <Surface variant="neomorphic" className="p-4 border-t border-white/60">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <Text variant="label">Clause {clause.id}</Text>
        </div>
        {getStatusBadge()}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Text variant="label" className="mb-2 block text-muted-foreground">
            Original
          </Text>
          <Surface variant="engraved" className="p-3">
            <Text variant="body" className="text-sm leading-relaxed">
              {clause.original}
            </Text>
          </Surface>
        </div>
        <div>
          <Text variant="label" className="mb-2 block text-accent">
            AI Rewrite
          </Text>
          <Surface variant="engraved" className="p-3">
            <Text variant="body" className="text-sm leading-relaxed">
              {clause.rewrite || 'No rewrite generated yet'}
            </Text>
          </Surface>
        </div>
      </div>

      {clause.confidence && (
        <div className="mb-3">
          <Text variant="caption" className="text-muted-foreground">
            Confidence: {Math.round(clause.confidence * 100)}%
          </Text>
        </div>
      )}

      <div className="flex gap-2">
        <Button 
          variant="primary" 
          size="sm" 
          onClick={() => onAccept(clause.id)}
          disabled={loading || !clause.rewrite || clause.status === 'accepted'}
        >
          <Check className="w-3 h-3" />
          Accept
        </Button>
        <Button 
          variant="danger" 
          size="sm" 
          onClick={() => onReject(clause.id)}
          disabled={loading || clause.status === 'rejected'}
        >
          <X className="w-3 h-3" />
          Reject
        </Button>
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={() => onRegenerate(clause.id)}
          disabled={loading}
        >
          <RefreshCw className="w-3 h-3" />
          Regenerate
        </Button>
      </div>
    </Surface>
  );
};
