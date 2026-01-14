/**
 * WhoPanel - Task Context Resolver for assignment
 * 
 * Design Constraints:
 * - Uses ContextResolver wrapper
 * - Separates Person and Team assignment
 * - Chips below perforation = commitment
 */

import { useState, useRef, useEffect } from "react";
import { User, Users, Plus } from "lucide-react";
import { Chip } from "@/components/chips/Chip";
import { useTeams } from "@/hooks/useTeams";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { ContextResolver } from "../ContextResolver";
import { InstructionBlock } from "../InstructionBlock";
import { cn } from "@/lib/utils";

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
  const { teams } = useTeams();
  
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

  const filteredMembers = members;
  const filteredTeams = teams;

  const handlePersonSelect = (userId: string) => {
    if (assignedUserId === userId) {
      onUserChange(undefined);
    } else {
      onUserChange(userId);
    }
  };

  const handleTeamSelect = (teamId: string) => {
    if (assignedTeamIds.includes(teamId)) {
      onTeamsChange(assignedTeamIds.filter(id => id !== teamId));
    } else {
      onTeamsChange([...assignedTeamIds, teamId]);
    }
  };

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
              onClick: () => {
                onInviteToOrg?.();
                // Instruction block will dismiss when person is added
              },
            },
            {
              label: "Add as contractor",
              helperText: "Best for external suppliers",
              onClick: () => {
                onAddAsContractor?.();
                // Instruction block will dismiss when person is added
              },
            },
          ]}
          onDismiss={onInstructionDismiss}
        />
      )}
      
      {/* Person Assignment */}
      <ContextResolver
        title=""
        helperText=""
      >
        <div className="flex items-center gap-2 w-full min-w-0">
          {/* PERSON + chip - Fixed on left */}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 pl-[9px] pr-1.5 py-1.5 rounded-[8px] h-[29px] bg-background text-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] shrink-0 font-mono transition-all duration-150 cursor-pointer"
          >
            <span className="text-[12px] uppercase leading-[16px]">PERSON</span>
            <Plus className="h-3.5 w-3.5" />
          </button>
          
          {/* Scrollable middle section with person chips */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden min-w-0 no-scrollbar">
            <div className="flex items-center gap-2 h-[40px]">
              {filteredMembers.length > 0 || pendingInvitations.length > 0 ? (
                <>
                  {filteredMembers.map(member => (
                    <Chip
                      key={member.user_id}
                      role="filter"
                      label={member.display_name.toUpperCase()}
                      selected={assignedUserId === member.user_id}
                      onSelect={() => handlePersonSelect(member.user_id)}
                      className="shrink-0"
                    />
                  ))}
                  
                  {pendingInvitations.map(inv => (
                    <Chip
                      key={inv.id}
                      role="filter"
                      label={inv.displayName.toUpperCase()}
                      selected={assignedUserId === inv.id}
                      onSelect={() => handlePersonSelect(inv.id)}
                      className="shrink-0"
                    />
                  ))}
                </>
              ) : (
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  No people yet
                </p>
              )}
            </div>
          </div>
        </div>
      </ContextResolver>

      {/* Team Assignment */}
      <ContextResolver
        title=""
        helperText=""
      >
        <div className="flex items-center gap-2 w-full min-w-0">
          {/* TEAMS + chip - Fixed on left */}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 pl-[9px] pr-1.5 py-1.5 rounded-[8px] h-[29px] bg-background text-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] shrink-0 font-mono transition-all duration-150 cursor-pointer"
          >
            <span className="text-[12px] uppercase leading-[16px]">TEAMS</span>
            <Plus className="h-3.5 w-3.5" />
          </button>
          
          {/* Scrollable middle section with team chips */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden min-w-0 no-scrollbar">
            <div className="flex items-center gap-2 h-[40px]">
              {filteredTeams.length > 0 ? (
                filteredTeams.map(team => (
                  <Chip
                    key={team.id}
                    role="filter"
                    label={(team.name || 'Unnamed Team').toUpperCase()}
                    selected={assignedTeamIds.includes(team.id)}
                    onSelect={() => handleTeamSelect(team.id)}
                    className="shrink-0"
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  No teams yet
                </p>
              )}
            </div>
          </div>
        </div>
      </ContextResolver>
    </div>
  );
}

