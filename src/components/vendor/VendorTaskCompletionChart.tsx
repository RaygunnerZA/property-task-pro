import React from 'react';
import { Surface, Text, Heading } from '@/components/filla';
import { TrendingUp } from 'lucide-react';

interface CompletionData {
  date: string;
  completed: number;
}

interface VendorTaskCompletionChartProps {
  completion: CompletionData[];
}

export const VendorTaskCompletionChart: React.FC<VendorTaskCompletionChartProps> = ({ completion }) => {
  const maxCompleted = Math.max(...completion.map(d => d.completed));

  return (
    <Surface variant="neomorphic" className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        <Heading variant="m">Task Completion Timeline</Heading>
      </div>

      <div className="space-y-3">
        {completion.map((item, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between">
              <Text variant="caption">
                {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
              <Text variant="label">{item.completed}</Text>
            </div>
            <div className="h-2 bg-concrete rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(item.completed / maxCompleted) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
};
