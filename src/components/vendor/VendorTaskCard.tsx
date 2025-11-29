import React from 'react';
import { Surface, Text, Heading } from '@/components/filla';
import { VendorTaskStatusBadge } from './VendorTaskStatusBadge';
import { VendorTask } from '@/hooks/vendor/useVendorTasks';
import { Calendar, MapPin } from 'lucide-react';

interface VendorTaskCardProps {
  task: VendorTask;
  onClick?: () => void;
}

export const VendorTaskCard: React.FC<VendorTaskCardProps> = ({ task, onClick }) => {
  return (
    <Surface 
      variant="neomorphic" 
      className="p-4 space-y-3"
      interactive
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <Heading variant="m" className="flex-1">
          {task.title}
        </Heading>
        <VendorTaskStatusBadge status={task.status} />
      </div>

      {task.property_name && (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <Text variant="caption">{task.property_name}</Text>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <Text variant="caption">
          Due: {new Date(task.due_at).toLocaleDateString()}
        </Text>
      </div>
    </Surface>
  );
};
