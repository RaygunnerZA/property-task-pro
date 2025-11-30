import { Surface, Heading, Text } from '@/components/filla';
import { Users } from 'lucide-react';

export default function ManagePeople() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Heading variant="l" className="mb-6">People & Teams</Heading>
      
      <Surface variant="neomorphic" className="p-12 text-center">
        <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-40" />
        <Heading variant="m" className="mb-2">Manage your team</Heading>
        <Text variant="muted">
          Add team members, assign roles, and manage permissions
        </Text>
      </Surface>
    </div>
  );
}
