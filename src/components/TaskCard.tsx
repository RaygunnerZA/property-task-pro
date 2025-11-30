import { Task, Property } from '@/types/task';
import { colors, shadows } from '@/components/filla';
import { Calendar, MapPin, AlertCircle } from 'lucide-react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';

interface TaskCardProps {
  task: Task;
  property: Property;
  onClick: () => void;
}

const getStatusColor = (status: Task['status']) => {
  switch (status) {
    case 'completed':
      return colors.success;
    case 'in-progress':
      return colors.signal;
    case 'pending':
      return colors.primary;
  }
};

const getPriorityColor = (priority: Task['priority']) => {
  switch (priority) {
    case 'high':
      return colors.danger;
    case 'medium':
      return colors.signal;
    case 'low':
      return colors.textMuted;
  }
};

const formatDueDate = (date: Date) => {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'MMM d, yyyy');
};

export const TaskCard = ({ task, property, onClick }: TaskCardProps) => {
  const isOverdue = isPast(task.dueDate) && task.status !== 'completed';

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg p-4 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
      style={{
        backgroundColor: colors.surface,
        boxShadow: shadows.outset
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 
          className="font-semibold text-base leading-tight flex-1"
          style={{ color: colors.ink }}
        >
          {task.title}
        </h3>
        <span
          className="px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0"
          style={{
            backgroundColor: `${getStatusColor(task.status)}33`,
            color: getStatusColor(task.status),
            border: `1px solid ${getStatusColor(task.status)}66`
          }}
        >
          {task.status.replace('-', ' ')}
        </span>
      </div>

      {/* Description */}
      <p 
        className="text-sm line-clamp-2 mb-3"
        style={{ color: colors.textMuted }}
      >
        {task.description}
      </p>

      {/* Property */}
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="h-4 w-4" style={{ color: colors.textLight }} />
        <span 
          className="text-sm truncate"
          style={{ color: colors.textMuted }}
        >
          {property.name}
        </span>
      </div>

      {/* Footer - Due date and Priority */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar 
            className="h-4 w-4" 
            style={{ color: isOverdue ? colors.danger : colors.textLight }} 
          />
          <span 
            className="text-sm"
            style={{ 
              color: isOverdue ? colors.danger : colors.textMuted,
              fontWeight: isOverdue ? 600 : 400
            }}
          >
            {formatDueDate(task.dueDate)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <AlertCircle 
            className="h-4 w-4" 
            style={{ color: getPriorityColor(task.priority) }} 
          />
          <span 
            className="text-sm capitalize font-medium"
            style={{ color: getPriorityColor(task.priority) }}
          >
            {task.priority}
          </span>
        </div>
      </div>
    </button>
  );
};
