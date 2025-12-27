import { Users } from 'lucide-react';
import { StandardPage } from '@/components/design-system/StandardPage';
import { EmptyState } from '@/components/design-system/EmptyState';

export default function ManagePeople() {
  return (
    <StandardPage
      title="People & Teams"
      icon={<Users className="h-6 w-6" />}
      maxWidth="lg"
    >
      <EmptyState
        icon={Users}
        title="Manage your team"
        description="Add team members, assign roles, and manage permissions"
      />
    </StandardPage>
  );
}
