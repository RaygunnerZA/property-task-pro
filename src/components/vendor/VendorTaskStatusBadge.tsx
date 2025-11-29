import React from 'react';
import { Badge } from '@/components/filla';

interface VendorTaskStatusBadgeProps {
  status: 'Assigned' | 'In Progress' | 'Completed' | 'Waiting Review';
}

export const VendorTaskStatusBadge: React.FC<VendorTaskStatusBadgeProps> = ({ status }) => {
  const getVariant = () => {
    switch (status) {
      case 'Completed':
        return 'success';
      case 'In Progress':
        return 'ai';
      case 'Waiting Review':
        return 'warning';
      case 'Assigned':
      default:
        return 'neutral';
    }
  };

  return (
    <Badge variant={getVariant()} size="standard">
      {status}
    </Badge>
  );
};
