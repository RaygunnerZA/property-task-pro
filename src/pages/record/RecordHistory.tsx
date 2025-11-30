import { Surface, Heading, Text } from '@/components/filla';
import { History } from 'lucide-react';

export default function RecordHistory() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Heading variant="l" className="mb-6">History</Heading>
      
      <Surface variant="neomorphic" className="p-12 text-center">
        <History className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-40" />
        <Heading variant="m" className="mb-2">Task history</Heading>
        <Text variant="muted">
          View completed tasks and past activity
        </Text>
      </Surface>
    </div>
  );
}
