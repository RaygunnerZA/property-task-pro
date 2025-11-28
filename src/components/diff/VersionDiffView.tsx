import { Heading, Text } from '@/components/filla';
import ClauseDiffCard from './ClauseDiffCard';

interface VersionDiffViewProps {
  ruleId: string;
  versionId: string;
}

export default function VersionDiffView({ ruleId, versionId }: VersionDiffViewProps) {
  // Placeholder logic — backend will be wired later
  const oldVersionClauses: any[] = [];
  const newVersionClauses: any[] = [];

  return (
    <div className="space-y-4">
      <Heading variant="l" className="mb-4">Version Diff</Heading>
      <Text variant="muted" className="mb-4">Side-by-side comparison of changes.</Text>

      {(newVersionClauses ?? []).map((clause: any, idx: number) => (
        <ClauseDiffCard
          key={idx}
          oldClause={oldVersionClauses[idx]}
          newClause={clause}
        />
      ))}
      
      {newVersionClauses.length === 0 && (
        <Text variant="muted">No clauses to compare yet.</Text>
      )}
    </div>
  );
}
