import React from 'react';
import { Text } from '@/components/filla';
import { cn } from '@/lib/utils';

interface TaskListSectionHeaderProps {
  title: string;
  count: number;
  variant?: 'default' | 'danger' | 'warning';
}

export const TaskListSectionHeader: React.FC<TaskListSectionHeaderProps> = ({ 
  title, 
  count,
  variant = 'default' 
}) => {
  const getTextColor = () => {
    switch (variant) {
      case 'danger': return 'text-red-600';
      case 'warning': return 'text-yellow-700';
      default: return 'text-primary-deep';
    }
  };

  return (
    <div className="flex items-center justify-between pb-2 border-b border-concrete/50">
      <Text variant="label" className={cn('uppercase tracking-wide', getTextColor())}>
        {title}
      </Text>
      <span className={cn(
        'text-xs font-mono font-medium px-2 py-1 rounded-full',
        variant === 'danger' ? 'bg-red-100 text-red-700' :
        variant === 'warning' ? 'bg-yellow-100 text-yellow-700' :
        'bg-card text-muted-foreground'
      )}>
        {count}
      </span>
    </div>
  );
};
