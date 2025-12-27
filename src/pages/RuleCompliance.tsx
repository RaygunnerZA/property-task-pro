import { useParams } from 'react-router-dom';
import { useRuleCompliance } from '@/hooks/useRuleCompliance';
import { StandardPageWithBack } from '@/components/design-system/StandardPageWithBack';
import { LoadingState } from '@/components/design-system/LoadingState';
import { Card } from '@/components/ui/card';
import { Shield } from 'lucide-react';

export default function RuleCompliance() {
  const { ruleId } = useParams<{ ruleId: string }>();
  const { compliance, loading } = useRuleCompliance(ruleId || '');

  return (
    <StandardPageWithBack
      title="Rule Compliance"
      backTo={`/compliance/rules/${ruleId}`}
      icon={<Shield className="h-6 w-6" />}
      maxWidth="lg"
    >
      {loading ? (
        <LoadingState message="Loading compliance data..." />
      ) : (
        <Card className="p-8 shadow-e1">
          <p className="text-muted-foreground">Rule ID: {ruleId}</p>
        </Card>
      )}
    </StandardPageWithBack>
  );
}
