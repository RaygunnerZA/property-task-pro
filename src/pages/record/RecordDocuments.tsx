import { Surface, Heading, Text } from '@/components/filla';
import { FolderOpen } from 'lucide-react';

export default function RecordDocuments() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Heading variant="l" className="mb-6">Documents</Heading>
      
      <Surface variant="neomorphic" className="p-12 text-center">
        <FolderOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-40" />
        <Heading variant="m" className="mb-2">Document archive</Heading>
        <Text variant="muted">
          Access all property documents, certificates, and files
        </Text>
      </Surface>
    </div>
  );
}
