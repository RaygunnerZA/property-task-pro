import { useParams, useNavigate } from 'react-router-dom';
import { useRule } from '@/hooks/useRule';
import { useRuleVersions } from '@/hooks/useRuleVersions';
import RuleDetailHeader from '@/components/compliance/RuleDetailHeader';
import VersionList from '@/components/compliance/VersionList';
import { StandardPageWithBack } from '@/components/design-system/StandardPageWithBack';
import { LoadingState } from '@/components/design-system/LoadingState';
import { EmptyState } from '@/components/design-system/EmptyState';
import { Card } from '@/components/ui/card';
import { NeomorphicButton } from '@/components/design-system/NeomorphicButton';
import { FileText, History, Building2 } from 'lucide-react';

export default function RuleDetail() {
  const { ruleId } = useParams<{ ruleId: string }>();
  const navigate = useNavigate();
  const { data: rule, loading: loadingRule } = useRule(ruleId || '');
  const { data: versions, loading: loadingVersions } = useRuleVersions(ruleId || '');

  if (loadingRule || loadingVersions) {
    return (
      <StandardPageWithBack
        title="Rule Detail"
        backTo="/compliance"
        icon={<FileText className="h-6 w-6" />}
        maxWidth="lg"
      >
        <LoadingState message="Loading rule..." />
      </StandardPageWithBack>
    );
  }

  if (!rule) {
    return (
      <StandardPageWithBack
        title="Rule Detail"
        backTo="/compliance"
        icon={<FileText className="h-6 w-6" />}
        maxWidth="lg"
      >
        <EmptyState
          icon={FileText}
          title="Rule not found"
          description="The rule you're looking for doesn't exist"
        />
      </StandardPageWithBack>
    );
  }

  return (
    <StandardPageWithBack
      title="Rule Detail"
      backTo="/compliance"
      icon={<FileText className="h-6 w-6" />}
      maxWidth="lg"
    >
      <div className="space-y-6">
        <RuleDetailHeader rule={rule} />
        
        <Card className="p-6 shadow-e1">
          <h3 className="text-lg font-semibold mb-4">Version History</h3>
          <VersionList versions={versions ?? []} ruleId={ruleId || ''} />
        </Card>

        <div className="flex gap-3">
          <NeomorphicButton 
            variant="secondary" 
            onClick={() => navigate(`/compliance/rules/${ruleId}/versions`)}
          >
            <History className="h-4 w-4 mr-2" />
            View All Versions
          </NeomorphicButton>
          <NeomorphicButton 
            variant="secondary" 
            onClick={() => navigate(`/compliance/rules/${ruleId}/properties`)}
          >
            <Building2 className="h-4 w-4 mr-2" />
            View Properties
          </NeomorphicButton>
        </div>
      </div>
    </StandardPageWithBack>
  );
}
