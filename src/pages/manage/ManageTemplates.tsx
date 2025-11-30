import { Surface, Heading, Text } from '@/components/filla';
import { FileStack } from 'lucide-react';

export default function ManageTemplates() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Heading variant="l" className="mb-6">Templates</Heading>
      
      <Surface variant="neomorphic" className="p-12 text-center">
        <FileStack className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-40" />
        <Heading variant="m" className="mb-2">Task templates</Heading>
        <Text variant="muted">
          Create reusable task templates and checklists
        </Text>
      </Surface>
    </div>
  );
}
