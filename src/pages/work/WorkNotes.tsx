import { Surface, Heading, Text } from '@/components/filla';
import { FileText } from 'lucide-react';

export default function WorkNotes() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Heading variant="l" className="mb-6">Notes</Heading>
      
      <Surface variant="neomorphic" className="p-12 text-center">
        <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-40" />
        <Heading variant="m" className="mb-2">Notes coming soon</Heading>
        <Text variant="muted">
          Create and organize notes for your properties and tasks
        </Text>
      </Surface>
    </div>
  );
}
