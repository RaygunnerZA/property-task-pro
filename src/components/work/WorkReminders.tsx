import { colors, shadows } from '@/components/filla';
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

  const getPriorityColors = (priority: string) => {
    switch (priority) {
      case 'high':
        return { bg: `${colors.danger}1a`, color: colors.danger };
      case 'medium':
        return { bg: `${colors.signal}1a`, color: colors.signal };
      case 'low':
        return { bg: colors.background, color: colors.textMuted };
      default:
        return { bg: colors.background, color: colors.textMuted };
    }
  };

  return (
    <div className="space-y-3">
      {reminders.map((reminder) => {
        const priorityColors = getPriorityColors(reminder.priority);
        
        return (
          <button
            key={reminder.id}
            className="w-full text-left rounded-lg p-4 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
            style={{
              backgroundColor: colors.surface,
              boxShadow: shadows.outset
            }}
          >
            <div className="flex items-start gap-3">
              <div 
                className="p-2 rounded-lg"
                style={{
                  backgroundColor: priorityColors.bg,
                }}
              >
                <Bell className="h-4 w-4" style={{ color: priorityColors.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 
                  className="text-base font-semibold mb-1"
                  style={{ color: colors.ink }}
                >
                  {reminder.title}
                </h3>
                <p 
                  className="text-xs mb-2"
                  style={{ color: colors.textMuted }}
                >
                  {reminder.property}
                </p>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" style={{ color: colors.textMuted }} />
                  <span 
                    className="text-xs"
                    style={{ color: colors.textMuted }}
                  >
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
          <Bell 
            className="h-12 w-12 mx-auto mb-3 opacity-50"
            style={{ color: colors.textMuted }}
          />
          <p style={{ color: colors.textMuted }}>
            No reminders set
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkReminders;
