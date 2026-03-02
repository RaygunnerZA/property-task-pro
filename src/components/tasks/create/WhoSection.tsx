/**
 * WhoSection - Create Task "Who" row with SemanticChip system
 *
 * Layout: icon | [FACT] [FACT] [INPUT] [PROPOSAL] [PROPOSAL]
 * Create Team flow: CREATE chip → proposal chip → secondary row (ADD PEOPLE) → fact when member added
 * ADD PEOPLE chip: clickable, becomes input (like instruction chip)
 * Team fact chip: dropdown with members + ADD PERSON
 */

import React, { useState, useRef, useEffect, useMemo } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { SemanticChip } from "@/components/chips/semantic";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useTeams } from "@/hooks/useTeams";
import { useWhoSuggestions, type WhoProposal } from "@/hooks/useWhoSuggestions";
import type { PendingInvitation } from "./tabs/WhoTab";
import type { SuggestedChip } from "@/types/chip-suggestions";

interface WhoSectionProps {
  isActive: boolean;
  onActivate: () => void;
  assignedUserId?: string;
  assignedTeamIds: string[];
  onUserChange: (userId: string | undefined) => void;
  onTeamsChange: (teamIds: string[]) => void;
  pendingInvitations?: PendingInvitation[];
  onPendingInvitationsChange?: (invitations: PendingInvitation[]) => void;
  /** Called to open Invite User modal. Optional prefill from "Invite [Name]" proposal. */
  onInviteToOrg?: (prefill?: { firstName?: string; lastName?: string }) => void;
  onAddAsContractor?: () => void;
  hasUnresolved?: boolean;
  children?: React.ReactNode;
  /** AI-suggested chips from useChipSuggestions (person / team types) */
  suggestedChips?: SuggestedChip[];
  /** Called when user taps an AI suggestion chip */
  onSuggestionClick?: (chip: SuggestedChip) => void;
}

const PERSON_LABEL = "+ Person";
const TEAM_LABEL = "+ Team";
const ADD_PERSON_LABEL = "Add person";
const INPUT_MIN_WIDTH = 100;
const INPUT_MAX_WIDTH = 240;
const INPUT_CH_WIDTH = 8;

export function WhoSection({
  isActive,
  onActivate,
  assignedUserId,
  assignedTeamIds,
  onUserChange,
  onTeamsChange,
  pendingInvitations = [],
  onPendingInvitationsChange,
  onInviteToOrg,
  onAddAsContractor,
  hasUnresolved = false,
  children,
  suggestedChips = [],
  onSuggestionClick,
}: WhoSectionProps) {
  const { members } = useOrgMembers();
  const { teams, refresh: refreshTeams } = useTeams();
  const { orgId } = useActiveOrg();
  const { toast } = useToast();
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [entryMode, setEntryMode] = useState<"person" | "team">("person");
  const inputRef = useRef<HTMLInputElement>(null);

  /** Pending team: user clicked CREATE but hasn't added members yet. Not in DB. */
  const [pendingTeam, setPendingTeam] = useState<{ name: string } | null>(null);
  /** Members added to pending team. Team becomes fact when length >= 1. */
  const [pendingTeamMemberIds, setPendingTeamMemberIds] = useState<string[]>([]);

  /** ADD PEOPLE chip: when clicked, becomes input. */
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [addMembersInputValue, setAddMembersInputValue] = useState("");
  const addMembersInputRef = useRef<HTMLInputElement>(null);
  /** When adding to existing team (from dropdown ADD PERSON), which team. */
  const [addingMembersForTeamId, setAddingMembersForTeamId] = useState<string | null>(null);

  /** Team members per team (teamId -> userIds). For dropdown display. */
  const [teamMembersMap, setTeamMembersMap] = useState<Record<string, string[]>>({});

  const proposals = useWhoSuggestions(inputValue, isEditing);
  const visibleProposals = useMemo(() => {
    if (!isEditing) return [];
    if (entryMode === "person") {
      return proposals.filter((p) => p.type === "person" || p.type === "invite");
    }
    return proposals.filter((p) => p.type === "team" || p.type === "create_team");
  }, [proposals, isEditing, entryMode]);

  /** Filter members by search for add-members input (person-only) */
  const memberProposals = useMemo(() => {
    if (!addMembersInputValue.trim()) return members;
    const q = addMembersInputValue.toLowerCase().trim();
    return members.filter((m) =>
      m.display_name.toLowerCase().includes(q)
    );
  }, [members, addMembersInputValue]);

  const assignedPerson = assignedUserId
    ? members.find((m) => m.user_id === assignedUserId)
    : null;
  const assignedTeams = teams.filter((t) => assignedTeamIds.includes(t.id));

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isAddingMembers && addMembersInputRef.current) {
      addMembersInputRef.current.focus();
    }
  }, [isAddingMembers]);

  useEffect(() => {
    if (!isActive) {
      setIsEditing(false);
      setInputValue("");
      setIsAddingMembers(false);
      setAddMembersInputValue("");
      if (pendingTeam && pendingTeamMemberIds.length === 0) {
        setPendingTeam(null);
      }
    }
  }, [isActive]);

  const factChips = [
    ...(assignedPerson
      ? [
          {
            id: `person-${assignedPerson.user_id}`,
            label: assignedPerson.display_name.toUpperCase(),
            onRemove: () => onUserChange(undefined),
          },
        ]
      : []),
    ...assignedTeams.map((team) => ({
      id: `team-${team.id}`,
      label: (team.name || "Unnamed Team").toUpperCase(),
      onRemove: () => onTeamsChange(assignedTeamIds.filter((id) => id !== team.id)),
    })),
    ...pendingInvitations.map((inv) => ({
      id: inv.id,
      label: inv.displayName.toUpperCase(),
      onRemove: () => {
        onUserChange(undefined);
        onPendingInvitationsChange?.(
          pendingInvitations.filter((i) => i.id !== inv.id)
        );
      },
    })),
  ];

  const handleAddPersonClick = () => {
    if (!isActive) onActivate();
    setEntryMode("person");
    setIsEditing(true);
    setInputValue("");
  };

  const handleAddTeamClick = () => {
    if (!isActive) onActivate();
    setEntryMode("team");
    setIsEditing(true);
    setInputValue("");
  };

  const handleAddPeopleClick = () => {
    if (!isActive) onActivate();
    setIsAddingMembers(true);
    setAddMembersInputValue("");
  };

  const handleProposalClick = (proposal: WhoProposal) => {
    if (proposal.type === "person" && proposal.entityId) {
      onUserChange(proposal.entityId);
      setInputValue("");
      setIsEditing(false);
    } else if (proposal.type === "team" && proposal.entityId) {
      if (!assignedTeamIds.includes(proposal.entityId)) {
        onTeamsChange([...assignedTeamIds, proposal.entityId]);
      }
      setInputValue("");
      setIsEditing(false);
    } else if (proposal.type === "invite") {
      const nameParts = proposal.label.replace(/^Invite\s+/i, "").trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96e1a6'},body:JSON.stringify({sessionId:'96e1a6',runId:'invite-modal-baseline',hypothesisId:'H1',location:'WhoSection.tsx:handleProposalClick:invite',message:'who section invite proposal pressed',data:{proposalLabel:proposal.label,hasInviteCallback:!!onInviteToOrg,firstName,lastName},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      onInviteToOrg?.({ firstName, lastName });
      setInputValue("");
      setIsEditing(false);
    } else if (proposal.type === "create_team") {
      const name = proposal.label.replace(/^Add\s+/, "").trim();
      if (!name) return;
      setPendingTeam({ name });
      setInputValue("");
      setIsEditing(false);
      setPendingTeamMemberIds([]);
    }
  };

  const handleAddMemberToPendingTeam = (userId: string) => {
    if (!pendingTeam || !orgId) return;
    const newMemberIds = [...pendingTeamMemberIds, userId];
    setPendingTeamMemberIds(newMemberIds);
    if (newMemberIds.length >= 1) {
      supabase
        .from("teams")
        .insert({ org_id: orgId, name: pendingTeam.name })
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          if (data) {
            onTeamsChange([...assignedTeamIds, data.id]);
            onUserChange(newMemberIds[0]);
            setTeamMembersMap((prev) => ({ ...prev, [data.id]: newMemberIds }));
            refreshTeams();
            setPendingTeam(null);
            setPendingTeamMemberIds([]);
            toast({ title: "Team created", description: `${pendingTeam.name} has been created and assigned.` });
          }
        })
        .catch((err: Error) => {
          toast({ title: "Couldn't create team", description: err.message, variant: "destructive" });
        });
    }
  };

  const handleAddMemberToExistingTeam = (teamId: string, userId: string) => {
    const current = teamMembersMap[teamId] ?? [];
    if (current.includes(userId)) return;
    const next = [...current, userId];
    setTeamMembersMap((prev) => ({ ...prev, [teamId]: next }));
    if (!assignedUserId) onUserChange(userId);
  };

  const handleRemoveMemberFromTeam = (teamId: string, userId: string) => {
    const current = teamMembersMap[teamId] ?? [];
    const next = current.filter((id) => id !== userId);
    setTeamMembersMap((prev) => ({ ...prev, [teamId]: next }));
    if (assignedUserId === userId) {
      onUserChange(next[0]);
    }
    if (next.length === 0) {
      onTeamsChange(assignedTeamIds.filter((id) => id !== teamId));
    }
  };

  const handleRemoveMemberFromPendingTeam = (userId: string) => {
    const next = pendingTeamMemberIds.filter((id) => id !== userId);
    setPendingTeamMemberIds(next);
    if (next.length === 0) {
      setPendingTeam(null);
    }
  };

  const handleAddMembersInputBlur = () => {
    setTimeout(() => {
      setIsAddingMembers(false);
      setAddMembersInputValue("");
      setAddingMembersForTeamId(null);
    }, 150);
  };

  const handleInputBlur = () => {
    if (visibleProposals.length === 0 && !pendingTeam) {
      setTimeout(() => {
        setIsEditing(false);
        setInputValue("");
      }, 150);
    }
  };

  const inputWidth = Math.min(INPUT_MAX_WIDTH, Math.max(
    INPUT_MIN_WIDTH,
    (inputValue.length + 2) * INPUT_CH_WIDTH
  ));
  const addMembersInputWidth = Math.min(INPUT_MAX_WIDTH, Math.max(
    INPUT_MIN_WIDTH,
    (addMembersInputValue.length + 2) * INPUT_CH_WIDTH
  ));

  const showSecondaryRow = pendingTeam !== null || addingMembersForTeamId !== null;
  const secondaryRowTeamName =
    pendingTeam?.name ?? (addingMembersForTeamId ? teams.find((t) => t.id === addingMembersForTeamId)?.name : null);

  const handleAddPersonFromDropdown = (teamId: string) => {
    setAddingMembersForTeamId(teamId);
    setIsAddingMembers(true);
    setAddMembersInputValue("");
  };

  const handleSelectMemberForAddFlow = (userId: string) => {
    if (pendingTeam) {
      handleAddMemberToPendingTeam(userId);
    } else if (addingMembersForTeamId) {
      handleAddMemberToExistingTeam(addingMembersForTeamId, userId);
      setIsAddingMembers(false);
      setAddMembersInputValue("");
      setAddingMembersForTeamId(null);
    }
  };

  const renderTeamDropdownContent = (teamId: string, teamName: string) => {
    const teamMemberIds = teamMembersMap[teamId] ?? [];
    const hasAssignedPerson = assignedUserId && teamMemberIds.includes(assignedUserId);
    const displayMemberIds = teamMemberIds.length > 0
      ? teamMemberIds
      : assignedUserId
        ? [assignedUserId]
        : [];

    return (
      <div className="p-1.5 min-w-[180px]">
        <div className="space-y-1">
          {displayMemberIds.map((userId) => {
            const m = members.find((x) => x.user_id === userId);
            return m ? (
              <div key={userId} className="flex items-center justify-between gap-2 group">
                <span className="text-[11px] font-mono uppercase truncate flex-1">
                  {m.display_name}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveMemberFromTeam(teamId, userId)}
                  className="opacity-0 group-hover:opacity-70 hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </div>
            ) : null;
          })}
        </div>
        <button
          type="button"
          onClick={() => handleAddPersonFromDropdown(teamId)}
          className="mt-2 w-full py-1.5 px-2 rounded-[6px] text-[11px] font-mono uppercase bg-muted/50 hover:bg-muted transition-colors"
        >
          {ADD_PERSON_LABEL.toUpperCase()}
        </button>
      </div>
    );
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "flex flex-col rounded-[8px] transition-all duration-200",
        !isActive && "hover:bg-muted/30"
      )}
    >
      <div className="flex items-center gap-2 h-[36px] min-w-0">
        <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-[8px] bg-background">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>

        <div
          className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden no-scrollbar"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap pr-[6px]">
          {factChips.map((chip) => {
            const isTeamChip = chip.id.startsWith("team-");
            const teamId = isTeamChip ? chip.id.replace("team-", "") : null;
            const team = teamId ? teams.find((t) => t.id === teamId) : null;

            if (isTeamChip && teamId && team) {
              return (
                <SemanticChip
                  key={chip.id}
                  epistemic="fact"
                  label={chip.label}
                  truncate={false}
                  removable
                  onRemove={chip.onRemove}
                  dropdown
                  dropdownContent={renderTeamDropdownContent(teamId, team.name || "Unnamed Team")}
                  className="shrink-0"
                />
              );
            }
            return (
              <SemanticChip
                key={chip.id}
                epistemic="fact"
                label={chip.label}
                truncate={false}
                removable
                onRemove={chip.onRemove}
                onPress={onActivate}
                className="shrink-0"
              />
            );
          })}

          {pendingTeam && (
            <SemanticChip
              epistemic="proposal"
              label={pendingTeam.name.toUpperCase()}
              truncate={false}
              className="shrink-0"
            />
          )}

          {/* AI-suggested chips — shown when no person/team is assigned yet */}
          {!assignedUserId && assignedTeamIds.length === 0 && !isEditing &&
            suggestedChips.map((chip) => {
              // Unknown person (not in org): show INVITE prefix — clicking opens InviteUserModal
              const isUnknownPerson = chip.type === 'person' && chip.blockingRequired && !chip.resolvedEntityId;
              const chipLabel = isUnknownPerson
                ? `INVITE ${chip.label.toUpperCase()}`
                : chip.label.toUpperCase();
              return (
                <SemanticChip
                  key={chip.id}
                  epistemic="proposal"
                  label={chipLabel}
                  truncate={false}
                  onPress={() => {
                    if (isUnknownPerson) {
                      const nameParts = chip.label.trim().split(/\s+/);
                      const firstName = nameParts[0] || "";
                      const lastName = nameParts.slice(1).join(" ") || "";
                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96e1a6'},body:JSON.stringify({sessionId:'96e1a6',runId:'invite-modal-baseline',hypothesisId:'H1',location:'WhoSection.tsx:suggestedChip:onPressInvite',message:'who section suggested invite chip pressed',data:{chipId:chip.id,chipLabel:chip.label,hasInviteCallback:!!onInviteToOrg,firstName,lastName},timestamp:Date.now()})}).catch(()=>{});
                      // #endregion
                      onInviteToOrg?.({ firstName, lastName });
                    } else {
                      onSuggestionClick?.(chip);
                    }
                  }}
                  className="shrink-0"
                />
              );
            })
          }

          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={handleInputBlur}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsEditing(false);
                  setInputValue("");
                }
                if (e.key === "Enter" && visibleProposals.length > 0) {
                  e.preventDefault();
                  handleProposalClick(visibleProposals[0]);
                }
              }}
              placeholder={entryMode === "team" ? TEAM_LABEL : PERSON_LABEL}
              className={cn(
                "h-[28px] rounded-[8px] px-2 py-1 shrink-0 flex-shrink-0",
                "font-mono text-[11px] uppercase tracking-wide",
                "bg-background text-muted-foreground/70 placeholder:text-muted-foreground/50",
                "shadow-inset outline-none cursor-text",
                "transition-[width] duration-150 ease-out"
              )}
              style={{ width: inputWidth, minWidth: INPUT_MIN_WIDTH }}
            />
          ) : isHovered && !pendingTeam ? (
            <>
              <SemanticChip
                epistemic="proposal"
                label={PERSON_LABEL}
                truncate={false}
                onPress={handleAddPersonClick}
                className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1"
              />
              <SemanticChip
                epistemic="proposal"
                label={TEAM_LABEL}
                truncate={false}
                onPress={handleAddTeamClick}
                className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1"
              />
            </>
          ) : null}

          {visibleProposals.map((proposal) => (
            <SemanticChip
              key={proposal.id}
              epistemic="proposal"
              label={proposal.label}
              truncate={false}
              onPress={() => handleProposalClick(proposal)}
              animateIn
              className="shrink-0"
            />
          ))}
          </div>
        </div>

        {hasUnresolved && !isActive && (
          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-500 border border-background" />
        )}
      </div>

      {/* Secondary row: ADD PEOPLE TO [TEAM] - when pending team or adding to existing team */}
      {showSecondaryRow && secondaryRowTeamName && (
        <div
          className={cn(
            "pl-[38px] pt-1 pb-2",
            "transition-all duration-150 ease-out"
          )}
        >
          <div className="flex items-center gap-1.5 h-[36px] flex-nowrap whitespace-nowrap min-w-0 no-scrollbar pr-[6px]">
            {isAddingMembers ? (
              <input
                ref={addMembersInputRef}
                type="text"
                value={addMembersInputValue}
                onChange={(e) => setAddMembersInputValue(e.target.value)}
                onBlur={handleAddMembersInputBlur}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsAddingMembers(false);
                    setAddMembersInputValue("");
                    setAddingMembersForTeamId(null);
                  }
                  if (e.key === "Enter" && memberProposals.length > 0) {
                    e.preventDefault();
                    handleSelectMemberForAddFlow(memberProposals[0].user_id);
                  }
                }}
                placeholder={`Add person to ${secondaryRowTeamName}`}
                className={cn(
                  "h-[28px] rounded-[8px] px-2 py-1 shrink-0",
                  "font-mono text-[11px] uppercase tracking-wide",
                  "bg-background text-muted-foreground/70 placeholder:text-muted-foreground/50",
                  "shadow-inset outline-none cursor-text",
                  "transition-[width] duration-150 ease-out"
                )}
                style={{ width: addMembersInputWidth, minWidth: INPUT_MIN_WIDTH }}
              />
            ) : (
              <SemanticChip
                epistemic="proposal"
                label={`ADD PEOPLE TO ${secondaryRowTeamName.toUpperCase()}`}
                truncate={false}
                onPress={handleAddPeopleClick}
                className="shrink-0"
              />
            )}
            {isAddingMembers &&
              memberProposals
                .filter(
                  (m) =>
                    pendingTeam
                      ? !pendingTeamMemberIds.includes(m.user_id)
                      : !(teamMembersMap[addingMembersForTeamId!] ?? []).includes(m.user_id)
                )
                .map((member) => (
                  <SemanticChip
                    key={member.user_id}
                    epistemic="proposal"
                    label={member.display_name.toUpperCase()}
                    truncate={false}
                    onPress={() => handleSelectMemberForAddFlow(member.user_id)}
                    className="shrink-0"
                  />
                ))}
            {pendingTeam &&
              pendingTeamMemberIds.map((userId) => {
                const m = members.find((x) => x.user_id === userId);
                return m ? (
                  <SemanticChip
                    key={userId}
                    epistemic="fact"
                    label={m.display_name.toUpperCase()}
                    truncate={false}
                    removable
                    onRemove={() => handleRemoveMemberFromPendingTeam(userId)}
                    className="shrink-0"
                  />
                ) : null;
              })}
            {addingMembersForTeamId &&
              (teamMembersMap[addingMembersForTeamId] ?? []).map((userId) => {
                const m = members.find((x) => x.user_id === userId);
                return m ? (
                  <SemanticChip
                    key={userId}
                    epistemic="fact"
                    label={m.display_name.toUpperCase()}
                    truncate={false}
                    removable
                    onRemove={() => handleRemoveMemberFromTeam(addingMembersForTeamId, userId)}
                    className="shrink-0"
                  />
                ) : null;
              })}
          </div>
        </div>
      )}

      {isActive && children && (
        <div className="pl-[22px] pt-2 pb-2">{children}</div>
      )}
    </div>
  );
}
