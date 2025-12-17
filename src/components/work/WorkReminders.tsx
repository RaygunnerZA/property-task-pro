import { Bell, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const WorkReminders = () => {
  const reminders = [
    {
      id: '1',
      title: 'Fire Safety Inspection Due',
      property: '123 Main Street',
      dueDate: 'Tomorrow',
      priority: 'high',
    },
    {
      id: '2',
      title: 'HVAC Maintenance Check',
      property: '456 Oak Avenue',
      dueDate: 'In 3 days',
      priority: 'medium',
    },
    {
      id: '3',
      title: 'Lease Renewal Review',
      property: '789 Pine Road',
      dueDate: 'Next week',
      priority: 'low',
    },
  ];

  const getPriorityClasses = (priority: string) => {
    switch (priority) {
      case 'high':
        return { bg: 'bg-destructive/10', text: 'text-destructive' };
      case 'medium':
        return { bg: 'bg-signal', text: 'text-signal-foreground' };
      case 'low':
        return { bg: 'bg-background', text: 'text-muted-foreground' };
      default:
        return { bg: 'bg-background', text: 'text-muted-foreground' };
    }
  };

  return (
    <div className="space-y-3">
      {reminders.map((reminder) => {
        const priorityClasses = getPriorityClasses(reminder.priority);
        
        return (
          <button
            key={reminder.id}
            className="w-full text-left rounded-lg p-4 bg-card shadow-e1 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="flex items-start gap-3">
              <div className={cn("p-2 rounded-lg", priorityClasses.bg)}>
                <Bell className={cn("h-4 w-4", priorityClasses.text)} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold mb-1 text-foreground">
                  {reminder.title}
                </h3>
                <p className="text-xs mb-2 text-muted-foreground">
                  {reminder.property}
                </p>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {reminder.dueDate}
                  </span>
                </div>
              </div>
            </div>
          </button>
        );
      })}

      {reminders.length === 0 && (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
          <p className="text-muted-foreground">No reminders set</p>
        </div>
      )}
    </div>
  );
};

export default WorkReminders;
