import React from 'react';
import { Surface, Text } from '@/components/filla';
import { Clock, CheckCircle, AlertCircle, MessageSquare, User } from 'lucide-react';
import { format } from 'date-fns';

interface TimelineEvent {
  id: string;
  type: 'status_change' | 'assignment' | 'comment' | 'attachment';
  description: string;
  author?: string;
  timestamp: Date;
}

interface TaskTimelineProps {
  events: TimelineEvent[];
}

const getEventIcon = (type: TimelineEvent['type']) => {
  switch (type) {
    case 'status_change': return CheckCircle;
    case 'assignment': return User;
    case 'comment': return MessageSquare;
    case 'attachment': return AlertCircle;
    default: return Clock;
  }
};

export const TaskTimeline: React.FC<TaskTimelineProps> = ({ events }) => {
  return (
    <Surface variant="neomorphic" className="p-4 border-t border-white/60">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <Text variant="label">Activity Timeline</Text>
      </div>

      {events.length === 0 ? (
        <Text variant="caption" className="text-center py-4">
          No activity yet
        </Text>
      ) : (
        <div className="space-y-4">
          {events.map((event, index) => {
            const EventIcon = getEventIcon(event.type);
            const isLast = index === events.length - 1;

            return (
              <div key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-background border border-concrete flex items-center justify-center flex-shrink-0">
                    <EventIcon className="w-4 h-4 text-primary" />
                  </div>
                  {!isLast && (
                    <div className="w-0.5 flex-1 bg-concrete/50 my-1" />
                  )}
                </div>

                <div className="flex-1 pb-4">
                  <Text variant="body" className="text-sm mb-1">
                    {event.description}
                  </Text>
                  <div className="flex items-center gap-2">
                    {event.author && (
                      <Text variant="caption">{event.author}</Text>
                    )}
                    <Text variant="caption">
                      {format(new Date(event.timestamp), 'MMM d, h:mm a')}
                    </Text>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Surface>
  );
};
