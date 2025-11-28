import { useParams } from 'react-router-dom';
import { Heading, Text } from '@/components/filla';
import { useRuleVersions } from '@/hooks/useRuleVersions';
import RuleVersionCard from '@/components/compliance/RuleVersionCard';

export default function RuleVersions() {
  const { ruleId } = useParams<{ ruleId: string }>();
  const { data, loading } = useRuleVersions(ruleId || '');

  if (loading) {
    return (
      <div className="min-h-screen bg-paper p-6">
        <Text variant="muted">Loading…</Text>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <Heading variant="xl" className="mb-6">Version History</Heading>
        {(data ?? []).map((v: any) => (
          <RuleVersionCard key={v.id} version={v} ruleId={ruleId || ''} />
        ))}
      </div>
    </div>
  );
}
