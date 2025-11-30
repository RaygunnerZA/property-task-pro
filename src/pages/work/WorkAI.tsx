import { Surface, Heading, Text } from '@/components/filla';
import { Sparkles } from 'lucide-react';

export default function WorkAI() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Heading variant="l" className="mb-6">AI Suggestions</Heading>
      
      <Surface variant="neomorphic" className="p-12 text-center">
        <Sparkles className="w-16 h-16 mx-auto mb-4 text-primary opacity-60" />
        <Heading variant="m" className="mb-2">AI-powered insights</Heading>
        <Text variant="muted">
          Smart recommendations for task prioritization and property management
        </Text>
      </Surface>
    </div>
  );
}
