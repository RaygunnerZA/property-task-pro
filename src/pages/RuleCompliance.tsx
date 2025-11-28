import { useParams } from 'react-router-dom';
import { Surface, Heading, Text } from '@/components/filla';
import { useRuleCompliance } from '@/hooks/useRuleCompliance';

export default function RuleCompliance() {
  const { ruleId } = useParams<{ ruleId: string }>();
  const { compliance, loading } = useRuleCompliance(ruleId || '');

  return (
    <div className="min-h-screen bg-paper p-6">
      <div className="max-w-6xl mx-auto">
        <Heading variant="xl" className="mb-6">Rule Compliance</Heading>
        
        {loading ? (
          <Text variant="muted">Loading compliance data...</Text>
        ) : (
          <Surface variant="neomorphic" className="p-8">
            <Text variant="muted">Rule ID: {ruleId}</Text>
          </Surface>
        )}
      </div>
    </div>
  );
}
