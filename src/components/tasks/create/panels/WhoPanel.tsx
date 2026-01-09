/**
 * WhoPanel - Task Context Resolver for assignment
 * 
 * Design Constraints:
 * - Uses ContextResolver wrapper
 * - Separates Person and Team assignment
 * - Chips below perforation = commitment
 */

import { useState, useRef } from "react";
import { User, Users, Plus } from "lucide-react";
import { StandardChip } from "@/components/chips/StandardChip";
import { useTeams } from "@/hooks/useTeams";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { ContextResolver } from "../ContextResolver";
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
}

export function WhoPanel({
  assignedUserId,
  assignedTeamIds,
  onUserChange,
  onTeamsChange,
  suggestedPeople = [],
  pendingInvitations = [],
  onPendingInvitationsChange
}: WhoPanelProps) {
  const { members } = useOrgMembers();
  const { teams } = useTeams();

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
                    <StandardChip
                      key={member.user_id}
                      label={member.display_name}
                      selected={assignedUserId === member.user_id}
                      onSelect={() => handlePersonSelect(member.user_id)}
                      className="shrink-0"
                    />
                  ))}
                  
                  {pendingInvitations.map(inv => (
                    <StandardChip
                      key={inv.id}
                      label={inv.displayName}
                      selected={assignedUserId === inv.id}
                      onSelect={() => handlePersonSelect(inv.id)}
                      className="shrink-0 border-dashed"
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
                  <StandardChip
                    key={team.id}
                    label={team.name || 'Unnamed Team'}
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

