import React from 'react';
import { Surface, Text, Button } from '@/components/filla';
import { User, Users, Plus } from 'lucide-react';

interface AssignmentPanelProps {
  assignedUser?: {
    id: string;
    name: string;
  };
  assignedTeam?: {
    id: string;
    name: string;
  };
  onAssign?: () => void;
}

export const AssignmentPanel: React.FC<AssignmentPanelProps> = ({
  assignedUser,
  assignedTeam,
  onAssign
}) => {
  return (
    <Surface variant="neomorphic" className="p-4 border-t border-white/60">
      <div className="flex items-center justify-between mb-3">
        <Text variant="label">Assignment</Text>
        {onAssign && (
          <Button variant="ghost" size="sm" onClick={onAssign}>
            <Plus className="w-3 h-3 mr-1" />
            Assign
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {assignedUser && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
            <User className="w-4 h-4 text-muted-foreground" />
            <Text variant="body">{assignedUser.name}</Text>
          </div>
        )}

        {assignedTeam && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
            <Users className="w-4 h-4 text-muted-foreground" />
            <Text variant="body">{assignedTeam.name}</Text>
          </div>
        )}

        {!assignedUser && !assignedTeam && (
          <Text variant="caption" className="text-center py-4">
            No assignment yet
          </Text>
        )}
      </div>
    </Surface>
  );
};
