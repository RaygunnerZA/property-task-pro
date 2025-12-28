import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2 } from 'lucide-react';

interface PropertyStatus {
  id: string;
  name: string;
  status: 'compliant' | 'pending' | 'non_compliant';
  driftCount: number;
}

interface PropertyDriftHeatmapProps {
  data: PropertyStatus[];
}

const statusConfig = {
  compliant: {
    label: 'Compliant',
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/20',
  },
  pending: {
    label: 'Pending',
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/20',
  },
  non_compliant: {
    label: 'Non-Compliant',
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/20',
  },
};

export default function PropertyDriftHeatmap({ data }: PropertyDriftHeatmapProps) {
  return (
    <Card className="shadow-e1">
      <CardContent className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Property Compliance Status</h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.map((property) => {
              const config = statusConfig[property.status];
              return (
                <div
                  key={property.id}
                  className={`p-3 rounded-lg border ${config.border} ${config.bg} transition-all hover:shadow-e1 cursor-pointer`}
                >
                  <div className="flex items-start gap-2">
                    <Building2 className={`h-4 w-4 ${config.text} mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${config.text} truncate`}>
                        {property.name}
                      </p>
                      {property.driftCount > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {property.driftCount} drift{property.driftCount !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {data.length === 0 && (
            <div className="py-8">
              <p className="text-sm text-muted-foreground">
                No properties to display
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
