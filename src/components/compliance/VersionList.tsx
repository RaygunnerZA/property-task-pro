import { useNavigate } from 'react-router-dom';
import { Surface, Text } from '@/components/filla';

interface VersionListProps {
  versions: any[];
  ruleId: string;
}

export default function VersionList({ versions, ruleId }: VersionListProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      {(versions ?? []).map((v: any) => (
        <Surface
          key={v.id}
          variant="neomorphic"
          interactive
          onClick={() => navigate(`/compliance/rules/${ruleId}/versions/${v.id}`)}
          className="p-4"
        >
          <Text variant="label">Version {v.version_number}</Text>
          <Text variant="caption" className="mt-1">
            {v.approved_at ?? '—'}
          </Text>
        </Surface>
      ))}
    </div>
  );
}
