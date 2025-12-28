/**
 * Standard TaskCard Component - matches Design Library specification
 * Uses card-flat styling with priority badge and hover effects
 */
import { Calendar, MapPin, User, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TaskCardProps {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  property?: string;
  dueDate?: string;
  assignee?: string;
  imageUrl?: string;
  showAlert?: boolean;
  onClick?: () => void;
}

const priorityConfig = {
  low: { label: 'Low', className: 'bg-muted text-muted-foreground' },
  medium: { label: 'Medium', className: 'bg-primary/20 text-primary' },
  high: { label: 'High', className: 'bg-accent/20 text-accent' },
  urgent: { label: 'Urgent', className: 'bg-destructive/20 text-destructive' },
};

export function TaskCard({
  title,
  description,
  priority = 'medium',
  property,
  dueDate,
  assignee,
  imageUrl,
  showAlert,
  onClick,
}: TaskCardProps) {
  const priorityStyle = priorityConfig[priority] || priorityConfig.medium;

  return (
    <div
      className={cn(
        'card-flat p-4 rounded-[5px] hover:shadow-e2 hover:translate-y-[-2px] transition-all cursor-pointer overflow-hidden flex gap-4',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      {/* Content */}
      <div className="flex-1 space-y-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider font-medium',
                priorityStyle.className
              )}
            >
              {priorityStyle.label}
            </span>
            <h4 className="font-semibold text-ink text-sm line-clamp-2">{title}</h4>
          </div>
          {showAlert && (
            <div className="w-10 h-10 rounded-lg bg-concrete/50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-accent" />
            </div>
          )}
        </div>

        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          {property && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate max-w-[100px]">{property}</span>
            </span>
          )}
          {dueDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {dueDate}
            </span>
          )}
          {assignee && (
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {assignee}
            </span>
          )}
        </div>
      </div>

      {/* Image Zone - anchored right */}
      {imageUrl && (
        <div className="w-20 sm:w-24 flex-shrink-0 -m-4 ml-0 relative">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
          {/* Neumorphic overlay - light inner shadow top/left, outer shadow right */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: 'inset 2px 2px 4px rgba(255, 255, 255, 0.6), inset -1px -1px 2px rgba(0, 0, 0, 0.1), 3px 0px 6px rgba(0, 0, 0, 0.15)'
            }}
          />
        </div>
      )}
    </div>
  );
}

export default TaskCard;
