import { Surface, Heading, Text } from '@/components/filla';
import { CheckCircle2, AlertTriangle, FileText, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityEvent {
  id: string;
  type: 'rule_approved' | 'drift_detected' | 'rule_created' | 'review_pending';
  message: string;
  timestamp: string;
  metadata?: {
    ruleName?: string;
    propertyName?: string;
  };
}

interface RecentActivityFeedProps {
  data: ActivityEvent[];
}

const eventConfig = {
  rule_approved: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  drift_detected: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  rule_created: {
    icon: FileText,
    color: 'text-primary',
    bgColor: 'bg-primary/5',
  },
  review_pending: {
    icon: Clock,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
};

export default function RecentActivityFeed({ data }: RecentActivityFeedProps) {
  return (
    <Surface variant="neomorphic" className="p-6 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-white/60" />
      
      <div className="space-y-4">
        <Heading variant="m">Recent Activity</Heading>
        
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {data.map((event) => {
            const config = eventConfig[event.type];
            const Icon = config.icon;
            
            return (
              <div
                key={event.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-paper/50 transition-colors"
              >
                <div className={`p-2 rounded-lg ${config.bgColor}`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <Text variant="body" className="text-neutral-800">
                    {event.message}
                  </Text>
                  {event.metadata && (
                    <div className="mt-1 space-y-0.5">
                      {event.metadata.ruleName && (
                        <Text variant="caption" className="text-neutral-600">
                          Rule: {event.metadata.ruleName}
                        </Text>
                      )}
                      {event.metadata.propertyName && (
                        <Text variant="caption" className="text-neutral-600">
                          Property: {event.metadata.propertyName}
                        </Text>
                      )}
                    </div>
                  )}
                  <Text variant="caption" className="text-neutral-500 mt-1">
                    {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                  </Text>
                </div>
              </div>
            );
          })}
        </div>

        {data.length === 0 && (
          <div className="text-center py-8">
            <Text variant="body" className="text-neutral-500">
              No recent activity
            </Text>
          </div>
        )}
      </div>
    </Surface>
  );
}
