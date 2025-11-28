import React from 'react';
import { Heading, Text, Button } from '@/components/filla';
import { TaskStatusBadge } from './TaskStatusBadge';
import { ArrowLeft, Edit, Trash2, MoreVertical } from 'lucide-react';

interface TaskDetailHeaderProps {
  title: string;
  status: 'pending' | 'in-progress' | 'completed';
  onBack: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const TaskDetailHeader: React.FC<TaskDetailHeaderProps> = ({
  title,
  status,
  onBack,
  onEdit,
  onDelete
}) => {
  return (
    <div className="border-b border-concrete/50 pb-4 mb-6">
      <div className="flex items-start gap-3 mb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        
        <div className="flex-1 min-w-0">
          <Heading variant="xl" className="mb-2 break-words">
            {title}
          </Heading>
          <TaskStatusBadge status={status} />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit className="w-4 h-4" />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="w-4 h-4 text-red-600" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
