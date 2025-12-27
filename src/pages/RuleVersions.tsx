import { useParams } from 'react-router-dom';
import { useRuleVersions } from '@/hooks/useRuleVersions';
import RuleVersionCard from '@/components/compliance/RuleVersionCard';
import { StandardPageWithBack } from '@/components/design-system/StandardPageWithBack';
import { LoadingState } from '@/components/design-system/LoadingState';
import { History } from 'lucide-react';

export default function RuleVersions() {
  const { ruleId } = useParams<{ ruleId: string }>();
  const { data, loading } = useRuleVersions(ruleId || '');

  return (
    <StandardPageWithBack
      title="Version History"
      backTo={`/compliance/rules/${ruleId}`}
      icon={<History className="h-6 w-6" />}
      maxWidth="lg"
    >
      {loading ? (
        <LoadingState message="Loading versions..." />
      ) : (
        <div className="space-y-4">
          {(data ?? []).map((v: any) => (
            <RuleVersionCard key={v.id} version={v} ruleId={ruleId || ''} />
          ))}
        </div>
      )}
    </StandardPageWithBack>
  );
}
