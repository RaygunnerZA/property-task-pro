import React from 'react';
import { Surface, Text } from '@/components/filla';
import { MessageSquare } from 'lucide-react';

interface AIRewriteReasoningProps {
  reasoning?: string;
}

export const AIRewriteReasoning: React.FC<AIRewriteReasoningProps> = ({ reasoning }) => {
  if (!reasoning) return null;

  return (
    <Surface variant="engraved" className="p-3">
      <div className="flex items-start gap-2 mb-2">
        <MessageSquare className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
        <Text variant="label" className="text-accent">AI Reasoning</Text>
      </div>
      <Text variant="caption" className="leading-relaxed">
        {reasoning}
      </Text>
    </Surface>
  );
};
