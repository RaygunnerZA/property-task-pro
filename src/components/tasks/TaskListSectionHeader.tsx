import React from 'react';
import { Text } from '@/components/filla';
import { cn } from '@/lib/utils';

interface TaskListSectionHeaderProps {
  title: string;
  count: number;
  variant?: "default" | "danger" | "warning" | "muted";
}

export const TaskListSectionHeader: React.FC<TaskListSectionHeaderProps> = ({ 
  title, 
  count,
  variant = 'default' 
}) => {
  const getTextColor = () => {
    switch (variant) {
      case "danger":
        return "text-destructive";
      case "warning":
        return "text-warning-foreground";
      case "muted":
        return "text-muted-foreground";
      default:
        return "text-primary-deep";
    }
  };

  return (
    <div className="flex items-center justify-between pb-2 border-b border-concrete/50">
      <Text variant="label" className={cn('uppercase tracking-wider', getTextColor())}>
        {title}
      </Text>
      <span className={cn(
        'text-xs font-mono font-medium px-2 py-1 rounded-full',
        variant === "danger"
          ? "bg-red-100 text-destructive"
          : variant === "warning"
            ? "bg-yellow-100 text-warning-foreground"
            : variant === "muted"
              ? "bg-muted/50 text-muted-foreground"
              : "bg-card text-muted-foreground"
      )}>
        {count}
      </span>
    </div>
  );
};
