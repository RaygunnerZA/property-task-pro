import { useParams } from 'react-router-dom';
import { Heading } from '@/components/filla';
import VersionDiffView from '@/components/diff/VersionDiffView';

export default function VersionDetail() {
  const { ruleId, versionId } = useParams<{ ruleId: string; versionId: string }>();

  return (
    <div className="min-h-screen bg-paper p-6">
      <div className="max-w-6xl mx-auto">
        <Heading variant="xl" className="mb-6">Version {versionId}</Heading>
        <VersionDiffView ruleId={ruleId || ''} versionId={versionId || ''} />
      </div>
    </div>
  );
}
