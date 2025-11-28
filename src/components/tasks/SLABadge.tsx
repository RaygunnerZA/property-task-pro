import React from 'react';
import { Badge } from '@/components/filla';
import { Clock } from 'lucide-react';

interface SLABadgeProps {
  status: 'on-track' | 'at-risk' | 'breached';
}

export const SLABadge: React.FC<SLABadgeProps> = ({ status }) => {
  const getVariant = () => {
    switch (status) {
      case 'on-track': return 'success';
      case 'at-risk': return 'warning';
      case 'breached': return 'signal';
      default: return 'neutral';
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'on-track': return 'On Track';
      case 'at-risk': return 'At Risk';
      case 'breached': return 'Breached';
      default: return status;
    }
  };

  return (
    <Badge variant={getVariant()} size="standard" className="flex items-center gap-1">
      <Clock className="w-3 h-3" />
      {getLabel()}
    </Badge>
  );
};
