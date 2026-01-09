import React from 'react';
import { Surface, Text, Badge } from '@/components/filla';
import { TaskStatusBadge } from './TaskStatusBadge';
import { Calendar, User, AlertCircle } from 'lucide-react';
import { formatTaskDate } from '@/utils/formatTaskDate';

interface PropertyTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: Date;
  assignedTo?: string;
  assignedTeam?: string;
  createdAt: Date;
  isOverdue?: boolean;
}

interface PropertyTaskCardProps {
  task: PropertyTask;
  onClick: () => void;
}

const getPriorityColor = (priority: PropertyTask['priority']) => {
  switch (priority) {
    case 'high': return 'signal';
    case 'medium': return 'warning';
    case 'low': return 'neutral';
    default: return 'neutral';
  }
};

export const PropertyTaskCard: React.FC<PropertyTaskCardProps> = ({ task, onClick }) => {
  return (
    <Surface
      variant="neomorphic"
      interactive
      onClick={onClick}
      className="p-4 border-t border-white/60"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-ink text-base truncate">
              {task.title}
            </h3>
            <Badge variant={getPriorityColor(task.priority)} size="standard">
              {task.priority}
            </Badge>
          </div>
          {task.description && (
            <Text variant="caption" className="line-clamp-2">
              {task.description}
            </Text>
          )}
        </div>
        <TaskStatusBadge status={task.status} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Text variant="caption">
            {formatTaskDate(task.dueDate instanceof Date ? task.dueDate.toISOString() : task.dueDate)}
          </Text>
          {task.isOverdue && (
            <span className="flex items-center gap-1 text-red-600">
              <AlertCircle className="w-3 h-3" />
              <span className="text-xs font-medium">Overdue</span>
            </span>
          )}
        </div>

        {(task.assignedTo || task.assignedTeam) && (
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Text variant="caption">
              {task.assignedTo || task.assignedTeam}
            </Text>
          </div>
        )}
      </div>
    </Surface>
  );
};
