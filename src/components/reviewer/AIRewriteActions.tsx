import React from 'react';
import { Button } from '@/components/filla';
import { Sparkles, Check, RefreshCw } from 'lucide-react';

interface AIRewriteActionsProps {
  onGenerate: () => void;
  onAccept: () => void;
  onRegenerate: () => void;
  loading?: boolean;
  hasSuggestion?: boolean;
}

export const AIRewriteActions: React.FC<AIRewriteActionsProps> = ({
  onGenerate,
  onAccept,
  onRegenerate,
  loading = false,
  hasSuggestion = false
}) => {
  return (
    <div className="flex gap-2">
      {!hasSuggestion ? (
        <Button 
          variant="primary" 
          size="sm" 
          onClick={onGenerate}
          disabled={loading}
        >
          <Sparkles className="w-3 h-3" />
          Generate
        </Button>
      ) : (
        <>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={onAccept}
            disabled={loading}
          >
            <Check className="w-3 h-3" />
            Accept
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={onRegenerate}
            disabled={loading}
          >
            <RefreshCw className="w-3 h-3" />
            Regenerate
          </Button>
        </>
      )}
    </div>
  );
};
