import React from 'react';
import { Surface, Text } from '@/components/filla';
import { Clock, AlertCircle } from 'lucide-react';

interface SLAIndicatorProps {
  due_at?: string;
}

export const SLAIndicator: React.FC<SLAIndicatorProps> = ({ due_at }) => {
  if (!due_at) return null;

  const dueDate = new Date(due_at);
  const now = new Date();
  const hoursRemaining = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60));
  const isUrgent = hoursRemaining < 24;

  return (
    <Surface variant="neomorphic" className="p-4">
      <div className="flex items-center gap-3">
        {isUrgent ? (
          <AlertCircle className="w-5 h-5 text-danger" />
        ) : (
          <Clock className="w-5 h-5 text-muted-foreground" />
        )}
        <div className="flex-1">
          <Text variant="label" className={isUrgent ? 'text-danger' : ''}>
            SLA Due
          </Text>
          <Text variant="caption" className="mt-1">
            {dueDate.toLocaleDateString()} at {dueDate.toLocaleTimeString()}
          </Text>
          {hoursRemaining > 0 && (
            <Text variant="caption" className={isUrgent ? 'text-danger' : 'text-muted-foreground'}>
              {hoursRemaining} hours remaining
            </Text>
          )}
        </div>
      </div>
    </Surface>
  );
};
