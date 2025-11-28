import { Text } from '@/components/filla';
import ClauseDiffCard from './ClauseDiffCard';

interface VersionDiffViewProps {
  ruleId: string;
  versionId: string;
}

export default function VersionDiffView({ ruleId, versionId }: VersionDiffViewProps) {
  // Backend wiring will be added later
  return (
    <div className="space-y-4">
      <Text variant="muted">Diff view coming soon.</Text>
      <ClauseDiffCard />
    </div>
  );
}
