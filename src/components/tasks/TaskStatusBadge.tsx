import React from 'react';
import { Badge } from '@/components/filla';

interface TaskStatusBadgeProps {
  status: 'pending' | 'in-progress' | 'completed';
}

export const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({ status }) => {
  const getStatusVariant = () => {
    switch (status) {
      case 'completed': return 'success';
      case 'in-progress': return 'ai';
      case 'pending': return 'neutral';
      default: return 'neutral';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'in-progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  return (
    <Badge variant={getStatusVariant()} size="standard">
      {getStatusLabel()}
    </Badge>
  );
};
