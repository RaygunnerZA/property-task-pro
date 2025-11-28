import React from 'react';
import { Surface, Text } from '@/components/filla';
import { AIRewriteActions } from './AIRewriteActions';
import { AIRewriteReasoning } from './AIRewriteReasoning';
import { Sparkles } from 'lucide-react';

interface AIRewritePanelProps {
  suggestion?: string;
  reasoning?: string;
  loading?: boolean;
  onGenerate: () => void;
  onAccept: () => void;
  onRegenerate: () => void;
}

export const AIRewritePanel: React.FC<AIRewritePanelProps> = ({
  suggestion,
  reasoning,
  loading = false,
  onGenerate,
  onAccept,
  onRegenerate
}) => {
  return (
    <Surface variant="neomorphic" className="p-4 border-t border-white/60 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-accent" />
        <Text variant="label" className="text-accent">AI Rewrite</Text>
      </div>

      {loading ? (
        <div className="py-4 text-center">
          <Text variant="caption" className="text-muted-foreground">
            Generating suggestion...
          </Text>
        </div>
      ) : suggestion ? (
        <Surface variant="engraved" className="p-3">
          <Text variant="body" className="leading-relaxed">
            {suggestion}
          </Text>
        </Surface>
      ) : (
        <Text variant="caption" className="text-muted-foreground">
          Click Generate to get an AI-powered rewrite suggestion for this clause.
        </Text>
      )}

      <AIRewriteActions
        onGenerate={onGenerate}
        onAccept={onAccept}
        onRegenerate={onRegenerate}
        loading={loading}
        hasSuggestion={!!suggestion}
      />

      <AIRewriteReasoning reasoning={reasoning} />
    </Surface>
  );
};
