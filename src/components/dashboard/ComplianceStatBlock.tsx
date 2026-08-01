import { Surface, Heading, Text } from '@/components/filla';
import { LucideIcon } from 'lucide-react';

interface ComplianceStatBlockProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const variantStyles = {
  default: 'text-primary',
  success: 'text-success-foreground',
  warning: 'text-warning-foreground',
  danger: 'text-destructive',
};

export default function ComplianceStatBlock({ 
  label, 
  value, 
  icon: Icon,
  trend,
  variant = 'default' 
}: ComplianceStatBlockProps) {
  return (
    <Surface variant="neomorphic" className="p-6 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-white/60" />
      
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Text variant="caption" className="text-muted-foreground">
            {label}
          </Text>
          <Heading variant="l" className={variantStyles[variant]}>
            {value}
          </Heading>
          
          {trend && (
            <div className="flex items-center gap-1">
              <Text 
                variant="caption" 
                className={trend.direction === 'up' ? 'text-success-foreground' : 'text-destructive'}
              >
                {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
              </Text>
            </div>
          )}
        </div>
        
        {Icon && (
          <div className="p-2 rounded-lg bg-paper/50">
            <Icon className="w-5 h-5 text-neutral-400" />
          </div>
        )}
      </div>
    </Surface>
  );
}
