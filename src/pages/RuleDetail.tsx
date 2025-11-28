import { useParams, useNavigate } from 'react-router-dom';
import { Surface, Heading, Text, Button } from '@/components/filla';
import { useRule } from '@/hooks/useRule';
import { useRuleVersions } from '@/hooks/useRuleVersions';
import RuleDetailHeader from '@/components/compliance/RuleDetailHeader';
import VersionList from '@/components/compliance/VersionList';

export default function RuleDetail() {
  const { ruleId } = useParams<{ ruleId: string }>();
  const navigate = useNavigate();
  const { data: rule, loading: loadingRule } = useRule(ruleId || '');
  const { data: versions, loading: loadingVersions } = useRuleVersions(ruleId || '');

  if (loadingRule || loadingVersions) {
    return (
      <div className="min-h-screen bg-paper p-6">
        <Text variant="muted">Loading…</Text>
      </div>
    );
  }

  if (!rule) {
    return (
      <div className="min-h-screen bg-paper p-6">
        <Text variant="muted">Rule not found.</Text>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <RuleDetailHeader rule={rule} />
        
        <Surface variant="neomorphic" className="p-6">
          <Heading variant="m" className="mb-4">Version History</Heading>
          <VersionList versions={versions ?? []} ruleId={ruleId || ''} />
        </Surface>

        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            onClick={() => navigate(`/compliance/rules/${ruleId}/versions`)}
          >
            View All Versions
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => navigate(`/compliance/rules/${ruleId}/properties`)}
          >
            View Properties
          </Button>
        </div>
      </div>
    </div>
  );
}
