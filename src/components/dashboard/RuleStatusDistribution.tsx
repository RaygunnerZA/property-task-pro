import { Surface, Heading, Text } from '@/components/filla';

interface StatusData {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

interface RuleStatusDistributionProps {
  data: StatusData[];
}

export default function RuleStatusDistribution({ data }: RuleStatusDistributionProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Surface variant="neomorphic" className="p-6 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-white/60" />
      
      <div className="space-y-4">
        <Heading variant="m">Rule Status Distribution</Heading>
        
        {/* Horizontal bar */}
        <div className="h-8 rounded-lg overflow-hidden flex shadow-engraved">
          {data.map((item, index) => (
            <div
              key={item.status}
              className="relative transition-all hover:brightness-110"
              style={{
                width: `${item.percentage}%`,
                backgroundColor: item.color,
              }}
              title={`${item.status}: ${item.count} (${item.percentage}%)`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-3">
          {data.map((item) => (
            <div key={item.status} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex-1 min-w-0">
                <Text variant="caption" className="text-neutral-600 truncate">
                  {item.status}
                </Text>
                <div className="flex items-baseline gap-2">
                  <Text variant="body" className="font-medium">
                    {item.count}
                  </Text>
                  <Text variant="caption" className="text-neutral-500">
                    ({item.percentage}%)
                  </Text>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Surface>
  );
}
