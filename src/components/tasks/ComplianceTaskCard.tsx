import React from 'react';
import { Surface, Text } from '@/components/filla';
import { TaskStatusBadge } from './TaskStatusBadge';
import { SLABadge } from './SLABadge';
import { AlertCircle, Building2, FileText, Calendar } from 'lucide-react';
import { formatTaskDate } from '@/utils/formatTaskDate';

interface ComplianceTask {
  id: string;
  title: string;
  description?: string;
  propertyName: string;
  ruleName: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: Date;
  assignedTo?: string;
  assignedTeam?: string;
  createdAt: Date;
  isOverdue: boolean;
  isDueToday: boolean;
  slaStatus: 'on-track' | 'at-risk' | 'breached';
}

interface ComplianceTaskCardProps {
  task: ComplianceTask;
  onClick: () => void;
}

export const ComplianceTaskCard: React.FC<ComplianceTaskCardProps> = ({ task, onClick }) => {
  return (
    <Surface
      variant="neomorphic"
      interactive
      onClick={onClick}
      className="p-4 border-t border-white/60"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-ink text-base mb-1 truncate">
            {task.title}
          </h3>
          {task.description && (
            <Text variant="caption" className="line-clamp-2 mb-2">
              {task.description}
            </Text>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <TaskStatusBadge status={task.status} />
          <SLABadge status={task.slaStatus} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Text variant="caption" className="truncate">{task.propertyName}</Text>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Text variant="caption" className="truncate">{task.ruleName}</Text>
        </div>

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
          <div className="pt-2 border-t border-concrete/30">
            <Text variant="caption">
              Assigned to: {task.assignedTo || task.assignedTeam}
            </Text>
          </div>
        )}
      </div>
    </Surface>
  );
};
