import { Card, CardContent } from '@/components/ui/card';
import { FileText, Building2, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface ComplianceOverviewData {
  totalRules: number;
  totalProperties: number;
  compliant: number;
  pending: number;
  drift: number;
  lastUpdated: string;
}

interface ComplianceOverviewCardProps {
  data: ComplianceOverviewData;
}

export default function ComplianceOverviewCard({ data }: ComplianceOverviewCardProps) {
  const stats = [
    { 
      label: 'Total Rules', 
      value: data.totalRules, 
      icon: FileText,
      color: 'text-primary' 
    },
    { 
      label: 'Total Properties', 
      value: data.totalProperties, 
      icon: Building2,
      color: 'text-accent' 
    },
    { 
      label: 'Compliant', 
      value: data.compliant, 
      icon: CheckCircle2,
      color: 'text-success' 
    },
    { 
      label: 'Pending', 
      value: data.pending, 
      icon: Clock,
      color: 'text-warning' 
    },
    { 
      label: 'Drift', 
      value: data.drift, 
      icon: AlertTriangle,
      color: 'text-destructive' 
    },
  ];

  return (
    <Card className="shadow-e1">
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Compliance Overview</h3>
            <p className="text-sm text-muted-foreground">
              Updated {data.lastUpdated}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                    <p className="text-xs text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                  <p className={`text-2xl font-bold ${stat.color}`}>
                    {stat.value}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
