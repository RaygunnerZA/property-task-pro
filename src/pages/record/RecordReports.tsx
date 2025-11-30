import { Surface, Heading, Text } from '@/components/filla';
import { BarChart3 } from 'lucide-react';

export default function RecordReports() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Heading variant="l" className="mb-6">Reports</Heading>
      
      <Surface variant="neomorphic" className="p-12 text-center">
        <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-40" />
        <Heading variant="m" className="mb-2">Analytics & reports</Heading>
        <Text variant="muted">
          Generate reports and view property analytics
        </Text>
      </Surface>
    </div>
  );
}
