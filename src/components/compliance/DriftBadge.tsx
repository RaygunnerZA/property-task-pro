import { Badge } from '@/components/filla';

interface DriftBadgeProps {
  status: 'compliant' | 'pending' | 'outdated' | string;
}

export default function DriftBadge({ status }: DriftBadgeProps) {
  const variantMap: Record<string, 'success' | 'warning' | 'neutral'> = {
    compliant: 'success',
    pending: 'warning',
    outdated: 'warning',
  };

  const variant = variantMap[status] || 'neutral';

  return (
    <Badge variant={variant}>
      {status}
    </Badge>
  );
}
