import { Surface, Text } from '@/components/filla';
import { RuleComplianceCard } from './RuleComplianceCard';

interface PropertyComplianceListProps {
  rules: any[];
  loading?: boolean;
}

export function PropertyComplianceList({ rules, loading }: PropertyComplianceListProps) {
  if (loading) {
    return <Text variant="muted">Loading compliance rules...</Text>;
  }

  if (rules.length === 0) {
    return (
      <Surface variant="neomorphic" className="p-8 text-center">
        <Text variant="muted">No compliance rules found</Text>
      </Surface>
    );
  }

  return (
    <div className="grid gap-4">
      {rules.map((rule) => (
        <RuleComplianceCard key={rule.id} rule={rule} />
      ))}
    </div>
  );
}
