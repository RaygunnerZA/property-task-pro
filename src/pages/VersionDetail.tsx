import { useParams } from 'react-router-dom';
import VersionDiffView from '@/components/diff/VersionDiffView';
import { StandardPageWithBack } from '@/components/design-system/StandardPageWithBack';
import { History } from 'lucide-react';

export default function VersionDetail() {
  const { ruleId, versionId } = useParams<{ ruleId: string; versionId: string }>();

  return (
    <StandardPageWithBack
      title={`Version ${versionId}`}
      backTo={`/compliance/rules/${ruleId}/versions`}
      icon={<History className="h-6 w-6" />}
      maxWidth="xl"
    >
      <VersionDiffView ruleId={ruleId || ''} versionId={versionId || ''} />
    </StandardPageWithBack>
  );
}
