import { Surface, Heading, Text } from '@/components/filla';
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
      color: 'text-green-600' 
    },
    { 
      label: 'Pending', 
      value: data.pending, 
      icon: Clock,
      color: 'text-amber-600' 
    },
    { 
      label: 'Drift', 
      value: data.drift, 
      icon: AlertTriangle,
      color: 'text-red-600' 
    },
  ];

  return (
    <Surface variant="floating" className="p-6 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-white/60" />
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Heading variant="m">Compliance Overview</Heading>
          <Text variant="caption" className="text-neutral-500">
            Updated {data.lastUpdated}
          </Text>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                  <Text variant="caption" className="text-neutral-600">
                    {stat.label}
                  </Text>
                </div>
                <Heading variant="l" className={stat.color}>
                  {stat.value}
                </Heading>
              </div>
            );
          })}
        </div>
      </div>
    </Surface>
  );
}
