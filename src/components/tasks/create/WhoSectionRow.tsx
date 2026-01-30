/**
 * WhoSectionRow - Single-line stacked row for Who section
 * 
 * Default state: Display only resolved fact chips (people + teams)
 * Hover state: Prepend "Add person or team"
 * Interaction: Clicking anywhere replaces action text with inline text input
 * Typing: Auto-matches existing people/teams or shows INVITE/CREATE action chips
 */

import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { useTeams } from '@/hooks/useTeams';
import { useActiveOrg } from '@/hooks/useActiveOrg';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PendingInvitation } from './tabs/WhoTab';

interface WhoSectionRowProps {
  assignedUserId?: string;
  assignedTeamIds: string[];
  onUserChange: (userId: string | undefined) => void;
  onTeamsChange: (teamIds: string[]) => void;
  pendingInvitations?: PendingInvitation[];
  onPendingInvitationsChange?: (invitations: PendingInvitation[]) => void;
  onInviteToOrg?: () => void;
  onAddAsContractor?: () => void;
  additionalFactChips?: Array<{ id: string; label: string; onRemove?: () => void }>;
}

export function WhoSectionRow({
  assignedUserId,
  assignedTeamIds,
  onUserChange,
  onTeamsChange,
  pendingInvitations = [],
  onPendingInvitationsChange,
  onInviteToOrg,
  onAddAsContractor,
  additionalFactChips = []
}: WhoSectionRowProps) {
  const { members } = useOrgMembers();
  const { teams } = useTeams();
  const { orgId } = useActiveOrg();
  const { toast } = useToast();
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showInviteAction, setShowInviteAction] = useState(false);
  const [showCreateTeamAction, setShowCreateTeamAction] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get assigned person and teams
  const assignedPerson = assignedUserId ? members.find(m => m.user_id === assignedUserId) : null;
  const assignedTeams = teams.filter(t => assignedTeamIds.includes(t.id));

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Check if input matches existing person or team
  useEffect(() => {
    if (!inputValue.trim() || !isEditing) {
      setShowInviteAction(false);
      setShowCreateTeamAction(false);
      return;
    }

    const lowerInput = inputValue.toLowerCase().trim();
    
    // Check for person match
    const personMatch = members.find(m => 
      m.display_name.toLowerCase() === lowerInput
    );
    
    // Check for team match
    const teamMatch = teams.find(t => 
      (t.name || '').toLowerCase() === lowerInput
    );

    if (personMatch) {
      // Auto-select matched person
      onUserChange(personMatch.user_id);
      setInputValue('');
      setIsEditing(false);
      setShowInviteAction(false);
      setShowCreateTeamAction(false);
    } else if (teamMatch) {
      // Auto-select matched team
      if (!assignedTeamIds.includes(teamMatch.id)) {
        onTeamsChange([...assignedTeamIds, teamMatch.id]);
      }
      setInputValue('');
      setIsEditing(false);
      setShowInviteAction(false);
      setShowCreateTeamAction(false);
    } else {
      // Show action chips based on input
      // Simple heuristic: if it looks like a name (has space or is single word), show INVITE
      // Otherwise show CREATE TEAM
      const hasSpace = lowerInput.includes(' ');
      setShowInviteAction(hasSpace || lowerInput.split(' ').length === 1);
      setShowCreateTeamAction(!hasSpace && lowerInput.length > 2);
    }
  }, [inputValue, isEditing, members, teams, assignedTeamIds, onUserChange, onTeamsChange]);

  const handleRowClick = () => {
    if (!isEditing) {
      setIsEditing(true);
      setInputValue('');
    }
  };

  const handleInputBlur = () => {
    // Don't close if action chips are showing
    if (!showInviteAction && !showCreateTeamAction) {
      setIsEditing(false);
      setInputValue('');
    }
  };

  const handleInviteClick = () => {
    const name = inputValue.trim();
    if (!name) return;
    
    // Split name into first/last
    const parts = name.split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    
    // Create pending invitation
    const pendingInv: PendingInvitation = {
      id: `pending-${Date.now()}`,
      firstName,
      lastName,
      email: '', // Will be filled in modal
      displayName: name
    };
    
    // Store name temporarily - the invite modal will handle the rest
    // For now, just open the invite modal
    onInviteToOrg?.();
    
    setInputValue('');
    setIsEditing(false);
    setShowInviteAction(false);
  };

  const handleCreateTeamClick = async () => {
    const name = inputValue.trim();
    if (!name || !orgId) return;
    
    try {
      await supabase.auth.refreshSession();
      
      const { data, error } = await supabase
        .from('teams')
        .insert({
          org_id: orgId,
          name: name
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Add to assigned teams
      onTeamsChange([...assignedTeamIds, data.id]);
      
      setInputValue('');
      setIsEditing(false);
      setShowCreateTeamAction(false);
      
      toast({
        title: "Team created",
        description: `${name} has been created and assigned.`
      });
    } catch (err: any) {
      toast({
        title: "Couldn't create team",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleRemovePerson = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUserChange(undefined);
  };

  const handleRemoveTeam = (teamId: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onTeamsChange(assignedTeamIds.filter(id => id !== teamId));
  };

  const factChips = [
    ...(assignedPerson ? [{
      id: `person-${assignedPerson.user_id}`,
      label: assignedPerson.display_name.toUpperCase(),
      onRemove: handleRemovePerson
    }] : []),
    ...assignedTeams.map(team => ({
      id: `team-${team.id}`,
      label: (team.name || 'Unnamed Team').toUpperCase(),
      onRemove: handleRemoveTeam(team.id)
    })),
    ...additionalFactChips
  ];

  return (
    <div
      className={cn(
        'flex-1 h-8 flex items-center gap-1.5 px-2 rounded-[5px]',
        'transition-all duration-150',
        'bg-background',
        'hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] hover:bg-card',
        'cursor-pointer relative'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleRowClick}
    >
      {/* Show "Add person or team" on hover when not editing and no facts */}
      {!isEditing && factChips.length === 0 && isHovered && (
        <span className="text-sm text-muted-foreground">Add person or team</span>
      )}

      {/* Show fact chips when not editing */}
      {!isEditing && factChips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
          {factChips.map((chip, index) => {
            // Check if this is an invite chip (starts with "INVITE")
            const isInviteChip = chip.label.startsWith('INVITE ');
            
            return (
              <div
                key={chip.id}
                className={cn(
                  "group flex items-center gap-1.5 shrink-0",
                  isInviteChip && "px-2 py-0.5 rounded-[5px] bg-white font-mono text-xs"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <span className={cn(
                  "text-sm truncate",
                  isInviteChip ? "text-foreground font-mono" : "text-foreground/80"
                )}>
                  {chip.label}
                </span>
                {chip.onRemove && (
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-3 w-3 flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                {index < factChips.length - 1 && (
                  <span className="text-xs text-muted-foreground shrink-0">·</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Show input when editing */}
      {isEditing && (
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleInputBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (showInviteAction) {
                  handleInviteClick();
                } else if (showCreateTeamAction) {
                  handleCreateTeamClick();
                }
              } else if (e.key === 'Escape') {
                setIsEditing(false);
                setInputValue('');
                setShowInviteAction(false);
                setShowCreateTeamAction(false);
              }
            }}
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
            placeholder="Type a name..."
            onClick={(e) => e.stopPropagation()}
          />
          
          {/* Show action chips */}
          {showInviteAction && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleInviteClick();
              }}
              className="text-sm text-foreground/80 hover:text-foreground px-1.5 py-0.5 rounded bg-muted/50 hover:bg-muted transition-colors"
            >
              INVITE {inputValue.trim().toUpperCase()}
            </button>
          )}
          
          {showCreateTeamAction && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCreateTeamClick();
              }}
              className="text-sm text-foreground/80 hover:text-foreground px-1.5 py-0.5 rounded bg-muted/50 hover:bg-muted transition-colors"
            >
              CREATE {inputValue.trim().toUpperCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
