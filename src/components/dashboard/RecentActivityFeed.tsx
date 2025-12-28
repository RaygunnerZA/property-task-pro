import { Card, CardContent } from '@/components/ui/card';
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
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  drift_detected: {
    icon: AlertTriangle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  rule_created: {
    icon: FileText,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  review_pending: {
    icon: Clock,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
};

export default function RecentActivityFeed({ data }: RecentActivityFeedProps) {
  return (
    <Card className="shadow-e1">
      <CardContent className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {data.map((event) => {
              const config = eventConfig[event.type];
              const Icon = config.icon;
              
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-card/50 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${config.bgColor}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      {event.message}
                    </p>
                    {event.metadata && (
                      <div className="mt-1 space-y-0.5">
                        {event.metadata.ruleName && (
                          <p className="text-xs text-muted-foreground">
                            Rule: {event.metadata.ruleName}
                          </p>
                        )}
                        {event.metadata.propertyName && (
                          <p className="text-xs text-muted-foreground">
                            Property: {event.metadata.propertyName}
                          </p>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {data.length === 0 && (
            <div className="py-8">
              <p className="text-sm text-muted-foreground">
                No recent activity
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
