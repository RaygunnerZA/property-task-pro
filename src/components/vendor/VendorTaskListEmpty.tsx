import React from 'react';
import { Surface, Text } from '@/components/filla';
import { ClipboardList } from 'lucide-react';

export const VendorTaskListEmpty: React.FC = () => {
  return (
    <Surface variant="neomorphic" className="p-8 text-center">
      <ClipboardList className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
      <Text variant="muted">No tasks assigned yet</Text>
      <Text variant="caption" className="mt-2">
        New tasks will appear here when assigned to you
      </Text>
    </Surface>
  );
};
