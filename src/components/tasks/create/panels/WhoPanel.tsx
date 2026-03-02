/**
 * WhoPanel - Task Context Resolver for assignment
 * 
 * Design Constraints:
 * - Uses ContextResolver wrapper
 * - Separates Person and Team assignment
 * - Chips below perforation = commitment
 */

import { useEffect } from "react";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { InstructionBlock } from "../InstructionBlock";

export interface PendingInvitation {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  displayName: string;
}

interface WhoPanelProps {
  assignedUserId?: string;
  assignedTeamIds: string[];
  onUserChange: (userId: string | undefined) => void;
  onTeamsChange: (teamIds: string[]) => void;
  suggestedPeople?: string[];
  pendingInvitations?: PendingInvitation[];
  onPendingInvitationsChange?: (invitations: PendingInvitation[]) => void;
  instructionBlock?: { section: string; entityName: string; entityType: string } | null;
  onInstructionDismiss?: () => void;
  onInviteToOrg?: () => void;
  onAddAsContractor?: () => void;
}

export function WhoPanel({
  assignedUserId,
  assignedTeamIds,
  onUserChange,
  onTeamsChange,
  suggestedPeople = [],
  pendingInvitations = [],
  onPendingInvitationsChange,
  instructionBlock,
  onInstructionDismiss,
  onInviteToOrg,
  onAddAsContractor
}: WhoPanelProps) {
  const { members } = useOrgMembers();

  // Check if instruction block should be shown (only for 'who' section and 'person' type)
  const showInstruction = instructionBlock?.section === 'who' && instructionBlock?.entityType === 'person';
  const personName = instructionBlock?.entityName;

  // Check if entity is now resolved (person exists or was invited)
  const isResolved = personName ? (
    members.some(m => m.display_name.toLowerCase() === personName.toLowerCase()) ||
    pendingInvitations.some(inv => inv.displayName.toLowerCase() === personName.toLowerCase())
  ) : false;

  // Auto-dismiss instruction block when resolved
  useEffect(() => {
    if (showInstruction && isResolved && onInstructionDismiss) {
      onInstructionDismiss();
    }
  }, [showInstruction, isResolved, onInstructionDismiss]);

  return (
    <div className="space-y-6">
      {/* Instruction Block - Show when entity is not in system */}
      {showInstruction && !isResolved && personName && (
        <InstructionBlock
          message={`${personName} isn't in the system yet. Choose how you'd like to add them.`}
          buttons={[
            {
              label: "Invite to your organisation",
              helperText: "Best for staff or team members",
              onClick: () => onInviteToOrg?.(),
            },
            {
              label: "Add as contractor",
              helperText: "Best for external suppliers",
              onClick: () => onAddAsContractor?.(),
            },
          ]}
          onDismiss={onInstructionDismiss}
        />
      )}
    </div>
  );
}

