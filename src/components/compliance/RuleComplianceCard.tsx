import { Surface, Text, Heading, Badge } from '@/components/filla';

interface RuleComplianceCardProps {
  rule: any;
  onClick?: () => void;
}

export function RuleComplianceCard({ rule, onClick }: RuleComplianceCardProps) {
  return (
    <Surface
      variant="neomorphic"
      className="p-6 cursor-pointer hover:shadow-e3 transition-shadow"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <Heading variant="m">{rule.obligation_text || 'Rule'}</Heading>
        <Badge variant="neutral">{rule.status || 'pending'}</Badge>
      </div>
      <Text variant="muted" className="text-sm">
        {rule.country} • {rule.domain}
      </Text>
    </Surface>
  );
}
