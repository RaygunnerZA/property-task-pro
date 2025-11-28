import { useNavigate } from 'react-router-dom';
import { Surface, Text, Button } from '@/components/filla';

interface RuleVersionCardProps {
  version: any;
  ruleId: string;
}

export default function RuleVersionCard({ version, ruleId }: RuleVersionCardProps) {
  const navigate = useNavigate();

  return (
    <Surface 
      variant="neomorphic" 
      className="p-4 flex justify-between items-center"
    >
      <div>
        <Text variant="label">Version {version.version_number}</Text>
        <Text variant="caption" className="mt-1">
          Approved: {version.approved_at ?? '—'}
        </Text>
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={() => navigate(`/compliance/rules/${ruleId}/versions/${version.id}`)}
      >
        View
      </Button>
    </Surface>
  );
}
