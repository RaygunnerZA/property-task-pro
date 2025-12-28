import { Card, CardContent } from '@/components/ui/card';

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
    <Card className="shadow-e1">
      <CardContent className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Rule Status Distribution</h3>
          
          {/* Horizontal bar */}
          <div className="h-8 rounded-lg overflow-hidden flex shadow-engraved">
            {data.map((item) => (
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
                  <p className="text-xs text-muted-foreground truncate">
                    {item.status}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {item.count}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ({item.percentage}%)
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
