import { Surface, Heading, Text, Badge } from '@/components/filla';
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
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  pending: {
    label: 'Pending',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  non_compliant: {
    label: 'Non-Compliant',
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-200',
  },
};

export default function PropertyDriftHeatmap({ data }: PropertyDriftHeatmapProps) {
  return (
    <Surface variant="neomorphic" className="p-6 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-white/60" />
      
      <div className="space-y-4">
        <Heading variant="m">Property Compliance Status</Heading>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.map((property) => {
            const config = statusConfig[property.status];
            return (
              <div
                key={property.id}
                className={`p-3 rounded-lg border ${config.border} ${config.bg} transition-all hover:shadow-e1 cursor-pointer relative overflow-hidden`}
              >
                <div className="absolute inset-x-0 top-0 h-px bg-white/40" />
                
                <div className="flex items-start gap-2">
                  <Building2 className={`w-4 h-4 ${config.text} mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <Text variant="caption" className={`${config.text} font-medium truncate block`}>
                      {property.name}
                    </Text>
                    {property.driftCount > 0 && (
                      <Text variant="caption" className="text-neutral-600 mt-1">
                        {property.driftCount} drift{property.driftCount !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {data.length === 0 && (
          <div className="text-center py-8">
            <Text variant="body" className="text-neutral-500">
              No properties to display
            </Text>
          </div>
        )}
      </div>
    </Surface>
  );
}
