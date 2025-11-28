import { Surface, Text } from '@/components/filla';
import DriftBadge from './DriftBadge';

interface PropertyDriftListProps {
  items: any[];
}

export default function PropertyDriftList({ items }: PropertyDriftListProps) {
  return (
    <div className="space-y-3">
      {(items ?? []).map((item: any) => (
        <Surface 
          key={item.property_id} 
          variant="neomorphic" 
          className="p-4 flex justify-between items-center"
        >
          <div>
            <Text variant="label">{item.property_name ?? 'Property'}</Text>
            <Text variant="caption" className="mt-1">
              Version: {item.rule_version_id}
            </Text>
          </div>
          <DriftBadge status={item.status} />
        </Surface>
      ))}
    </div>
  );
}
