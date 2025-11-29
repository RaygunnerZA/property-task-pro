import { Surface, Text, Heading } from '@/components/filla';
import { Bell, Clock } from 'lucide-react';

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

  const priorityColors = {
    high: 'bg-destructive/10 text-destructive',
    medium: 'bg-signal/10 text-signal',
    low: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-3">
      {reminders.map((reminder) => (
        <Surface
          key={reminder.id}
          variant="neomorphic"
          interactive
          className="p-4"
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${priorityColors[reminder.priority as keyof typeof priorityColors]}`}>
              <Bell className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <Heading variant="m" className="mb-1">
                {reminder.title}
              </Heading>
              <Text variant="caption" className="text-muted-foreground mb-2">
                {reminder.property}
              </Text>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <Text variant="caption">{reminder.dueDate}</Text>
              </div>
            </div>
          </div>
        </Surface>
      ))}

      {reminders.length === 0 && (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <Text variant="body" className="text-muted-foreground">
            No reminders set
          </Text>
        </div>
      )}
    </div>
  );
};

export default WorkReminders;
