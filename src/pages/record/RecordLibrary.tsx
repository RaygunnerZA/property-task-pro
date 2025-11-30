import { Surface, Heading, Text } from '@/components/filla';
import { Archive } from 'lucide-react';

export default function RecordLibrary() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Heading variant="l" className="mb-6">Library</Heading>
      
      <Surface variant="neomorphic" className="p-12 text-center">
        <Archive className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-40" />
        <Heading variant="m" className="mb-2">Asset library</Heading>
        <Text variant="muted">
          Attachments, insurance documents, and warranties
        </Text>
      </Surface>
    </div>
  );
}
