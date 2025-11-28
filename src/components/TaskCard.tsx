import { Task, Property } from '@/types/task';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
      return 'bg-success text-success-foreground';
    case 'in-progress':
      return 'bg-warning text-warning-foreground';
    case 'pending':
      return 'bg-primary text-primary-foreground';
  }
};

const getPriorityColor = (priority: Task['priority']) => {
  switch (priority) {
    case 'high':
      return 'text-destructive';
    case 'medium':
      return 'text-warning';
    case 'low':
      return 'text-muted-foreground';
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
    <Card 
      className="cursor-pointer transition-all hover:shadow-md active:scale-[0.98]" 
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-base leading-tight flex-1">{task.title}</h3>
          <Badge className={getStatusColor(task.status)} variant="secondary">
            {task.status.replace('-', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span className="truncate">{property.name}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 text-sm ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            <Calendar className="h-4 w-4" />
            <span>{formatDueDate(task.dueDate)}</span>
          </div>
          
          <div className={`flex items-center gap-1.5 ${getPriorityColor(task.priority)}`}>
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm capitalize font-medium">{task.priority}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
